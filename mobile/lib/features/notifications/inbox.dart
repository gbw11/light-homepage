import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/widgets.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/auth/auth_state.dart';
import '../bulletins/bulletin.dart';
import '../bulletins/bulletins_api.dart';
import '../posts/post_summary.dart';
import '../posts/posts_api.dart';
import 'admin_notifications_api.dart';

enum InboxKind { notice, memberNotice, bulletin, newcomer }

/// 알림함의 한 줄. 누르면 열 화면은 바깥(라우터)이 [kind] · [refId]로 정한다
class InboxItem {
  const InboxItem({
    required this.kind,
    required this.refId,
    required this.title,
    required this.at,
    required this.unread,
  });

  final InboxKind kind;

  /// 글 · 주보 · 새가족 신청의 id
  final String refId;
  final String title;

  /// 올라온 시각 (주보는 예배 날짜)
  final DateTime at;
  final bool unread;

  /// 이 폰에 "봤다"고 적어 두는 이름 — 글과 주보의 id는 서로 겹칠 수 있다
  String get key => '${kind.name}:$refId';

  InboxItem asRead() =>
      InboxItem(kind: kind, refId: refId, title: title, at: at, unread: false);
}

/// 이 폰에서 이미 본 알림. 공지 · 주보는 서버가 누가 봤는지 모른다
/// (새가족 신청만 서버가 기억한다 — SPEC_API §14.3)
typedef SeenState = ({
  /// 이보다 앞선 것은 본 것으로 친다 — 처음 켠 날의 [NotificationInbox.firstRunGrace] 전.
  /// 그러지 않으면 처음 켜자마자 지난 한 달 치가 전부 새 알림으로 뜬다
  DateTime since,

  /// 본 알림의 [InboxItem.key]. 최근 것이 뒤
  List<String> keys,
});

abstract interface class SeenStore {
  /// 처음이거나 읽지 못하면 null
  Future<SeenState?> load();
  Future<void> save(SeenState seen);
}

/// 앱 저장소의 파일 하나 (로그인 쿠키와 같은 곳)
class FileSeenStore implements SeenStore {
  Future<File> get _file async => File(
    '${(await getApplicationSupportDirectory()).path}/notifications_seen.json',
  );

  @override
  Future<SeenState?> load() async {
    final file = await _file;
    if (!await file.exists()) return null;
    final json = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
    return (
      since: DateTime.parse(json['since'] as String),
      keys: [for (final k in json['keys'] as List<dynamic>) k as String],
    );
  }

  @override
  Future<void> save(SeenState seen) async => (await _file).writeAsString(
    jsonEncode({'since': seen.since.toIso8601String(), 'keys': seen.keys}),
  );
}

/// 홈 종 아이콘의 알림함 — **마지막으로 본 뒤 올라온** 공지 · 주보 · 새가족 신청
/// (사용자 결정 2026-10-19).
///
/// 따로 쌓아 두는 서버 알림함이 없다. 기존 목록 API에서 최근 [window] 안의 것을
/// 받아, 이 폰에서 아직 안 본 것을 센다 — 그래서 푸시를 놓쳤거나 알림을 꺼 둔
/// 사람도 빠짐없이 보인다. 새가족 신청(임원 이상)은 서버의 읽음 표시(§14)를 쓴다.
///
/// 알림함은 덤이다 — 어느 목록이 실패해도 나머지로 센다.
class NotificationInbox extends ChangeNotifier {
  NotificationInbox({
    required this.posts,
    required this.bulletins,
    required this.admin,
    required this.auth,
    required this.store,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now {
    _userId = auth.user?.id;
    auth.addListener(_onAuthChanged);
  }

  final PostsApi posts;
  final BulletinsApi bulletins;
  final AdminNotificationsApi admin;
  final AuthState auth;
  final SeenStore store;
  final DateTime Function() _clock;

  /// 알림함에 보이는 기간
  static const window = Duration(days: 30);

  /// 처음 켰을 때 새 알림으로 치는 기간
  static const firstRunGrace = Duration(days: 7);

  /// 본 알림을 이만큼만 기억한다 — 목록 API가 주는 수보다 넉넉하면 된다
  static const maxSeenKeys = 300;

  static const _fetchSize = 20;

  var _items = const <InboxItem>[];
  var _unreadCount = 0;
  String? _readMarker;
  SeenState? _seen;
  String? _userId;

  /// 새로 고칠 때마다 늘어난다 — 늦게 끝난 옛 결과로 덮어쓰지 않으려고
  var _version = 0;

  /// 최근이 위
  List<InboxItem> get items => _items;
  int get unreadCount => _unreadCount;

  /// 로그인한 사람이 바뀌면 받을 수 있는 것(회원 공지 · 새가족 신청)도 바뀐다
  void _onAuthChanged() {
    final userId = auth.user?.id;
    if (userId == _userId) return;
    _userId = userId;
    refresh();
  }

  Future<void> refresh() async {
    final version = ++_version;
    final user = auth.user;
    final (public, member, bulletinList, newcomers) = await (
      _quietly(() => _posts(PostCategory.noticePublic)),
      user == null
          ? Future<List<PostSummary>?>.value()
          : _quietly(() => _posts(PostCategory.noticeMember)),
      _quietly(() => bulletins.list(size: _fetchSize).then((p) => p.items)),
      (user?.role.isLeader ?? false)
          ? _quietly(admin.unread)
          : Future<AdminUnread?>.value(),
    ).wait;
    final seen = _seen ??= await _loadSeen();
    if (version != _version) return;

    final from = _clock().subtract(window);
    bool isNew(InboxKind kind, String id, DateTime at) =>
        !at.isBefore(seen.since) && !seen.keys.contains('${kind.name}:$id');
    InboxItem item(InboxKind kind, String id, String title, DateTime at) =>
        InboxItem(
          kind: kind,
          refId: id,
          title: title,
          at: at,
          unread: isNew(kind, id, at),
        );

    final items = [
      for (final post in [...?public, ...?member])
        // 오래된 고정글도 목록 맨 위에 온다 — 날짜로 거른다
        if (post.publishedAt case final at? when at.isAfter(from))
          item(
            post.category == PostCategory.noticeMember
                ? InboxKind.memberNotice
                : InboxKind.notice,
            post.id,
            post.title,
            at,
          ),
      for (final bulletin in bulletinList ?? const <BulletinSummary>[])
        if (_serviceDay(bulletin.serviceDate) case final at
            when at.isAfter(from))
          item(
            InboxKind.bulletin,
            bulletin.id,
            '${at.month}월 ${at.day}일 주보',
            at,
          ),
      // 서버가 안 읽은 것만 준다
      for (final n in newcomers?.items ?? const <AdminNotification>[])
        InboxItem(
          kind: InboxKind.newcomer,
          refId: n.refId,
          title: n.subject ?? '새가족',
          at: n.createdAt,
          unread: true,
        ),
    ]..sort((a, b) => b.at.compareTo(a.at));

    _items = items;
    _readMarker = newcomers?.readMarker;
    _unreadCount =
        items.where((i) => i.unread && i.kind != InboxKind.newcomer).length +
        (newcomers?.unreadCount ?? 0);
    notifyListeners();
  }

  /// 알림함을 열었다 — 지금 보이는 것을 모두 읽음으로
  Future<void> markAllRead() async {
    final seen = _seen;
    if (seen == null) return;
    // 진행 중인 새로 고침은 읽기 전 상태로 셌다 — 버린다
    _version++;
    final current = {
      for (final i in _items)
        if (i.kind != InboxKind.newcomer) i.key,
    };
    final keys = [...seen.keys.where((k) => !current.contains(k)), ...current];
    _seen = (
      since: seen.since,
      keys: keys.sublist(max(0, keys.length - maxSeenKeys)),
    );
    final marker = _readMarker;
    _readMarker = null;
    _items = [for (final i in _items) i.unread ? i.asRead() : i];
    _unreadCount = 0;
    notifyListeners();

    await _quietly(() => store.save(_seen!));
    if (marker != null) await _quietly(() => admin.markRead(marker));
  }

  Future<List<PostSummary>> _posts(PostCategory category) => posts
      .list(category: category, size: _fetchSize)
      .then((page) => page.items);

  Future<SeenState> _loadSeen() async {
    if (await _quietly(store.load) case final seen?) return seen;
    final first = (since: _clock().subtract(firstRunGrace), keys: <String>[]);
    await _quietly(() => store.save(first));
    return first;
  }

  /// `YYYY-MM-DD` → 그날 0시 (기기 시간대). 주보는 시각 없이 날짜만 온다
  static DateTime _serviceDay(String ymd) {
    final [y, m, d] = [for (final part in ymd.split('-')) int.parse(part)];
    return DateTime(y, m, d);
  }

  static Future<T?> _quietly<T>(Future<T> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return null;
    }
  }

  @override
  void dispose() {
    _version++;
    auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}

/// [NotificationInbox]를 아래 화면들에 건넨다 — 수가 바뀌면 종 아이콘이 다시 그려진다
class InboxScope extends InheritedNotifier<NotificationInbox> {
  const InboxScope({
    super.key,
    required NotificationInbox inbox,
    required super.child,
  }) : super(notifier: inbox);

  /// 화면만 따로 띄울 때(테스트 등)나 알림함이 없으면 null
  static NotificationInbox? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<InboxScope>()?.notifier;
}
