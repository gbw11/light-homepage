import '../../core/api/api_client.dart';

/// 안 읽은 새가족 신청 한 건 (SPEC_API §14.1 `items[]`).
/// 문장은 서버가 만들지 않는다 — 화면이 `type`을 보고 붙인다
typedef AdminNotification = ({
  String type,
  String refId,

  /// 신청자 이름
  String? subject,
  DateTime createdAt,
});

/// 안 읽은 알림 — 서버가 사람마다 읽음을 기억한다 (SPEC_API §14.3)
typedef AdminUnread = ({
  /// 배지 수. [items]는 20건에서 잘리므로 길이를 세지 않는다
  int unreadCount,
  List<AdminNotification> items,

  /// [AdminNotificationsApi.markRead]에 그대로 돌려준다. 안 읽은 것이 없으면 null
  String? readMarker,
});

/// 전도사 · 임원 알림 (SPEC_API §14, 권한 L) — 지금은 새가족 신청뿐이다
class AdminNotificationsApi {
  const AdminNotificationsApi(this._client);

  final ApiClient _client;

  Future<AdminUnread> unread() => _client.get(
    '/admin/notifications',
    decode: (data) {
      final json = data as Map<String, dynamic>;
      return (
        unreadCount: json['unreadCount'] as int,
        items: [
          for (final item in json['items'] as List<dynamic>)
            (
              type: (item as Map<String, dynamic>)['type'] as String,
              refId: item['refId'] as String,
              subject: item['subject'] as String?,
              createdAt: DateTime.parse(item['createdAt'] as String),
            ),
        ],
        readMarker: json['readMarker'] as String?,
      );
    },
  );

  /// [until]은 [unread]의 `readMarker` — 목록을 본 뒤 들어온 신청은 안 읽음으로
  /// 남는다 (SPEC_API §14.2)
  Future<void> markRead(String until) => _client.post(
    '/admin/notifications/read',
    body: {'until': until},
    decode: (_) {},
  );
}
