import 'package:flutter/foundation.dart';

import '../api/page.dart';

/// 한 번에 받아 온 묶음. [hasMore]가 false면 더 받을 것이 없다
typedef PageChunk<T> = ({List<T> items, bool hasMore});

/// 목록의 다음 묶음을 주는 쪽.
///
/// 어디까지 받았는지는 이 객체가 기억한다. 처음부터 다시 받을 때(당겨서
/// 새로고침)는 새로 만든다 — [PagedList]가 그렇게 쓴다.
abstract interface class PageSource<T> {
  /// 실패하면 던진다. 그때 **어디까지 받았는지는 그대로**여야 다시 시도가 같은
  /// 묶음을 다시 받는다
  Future<PageChunk<T>> next();
}

/// `page=0, 1, 2…`로 넘기는 보통 목록 (SPEC_API §1.1)
class NumberedPageSource<T> implements PageSource<T> {
  NumberedPageSource(this._fetch);

  final Future<PageResult<T>> Function(int page) _fetch;
  var _page = 0;

  @override
  Future<PageChunk<T>> next() async {
    final result = await _fetch(_page);
    // 성공한 뒤에만 넘긴다 — 실패한 페이지를 건너뛰지 않게
    _page++;
    return (items: result.items, hasMore: result.hasNext);
  }
}

/// 끝까지 내리면 더 받는 목록의 상태.
///
/// 웹 `/news`·`/documents`는 첫 20건만 받고 멈추는 결함이 있었다(점검 🟠-5).
/// 앱은 `hasNext`가 false일 때까지 이어서 받는다 (기획안 §1).
class PagedList<T> extends ChangeNotifier {
  PagedList(this._newSource) : _source = _newSource();

  final PageSource<T> Function() _newSource;
  PageSource<T> _source;

  List<T> _items = const [];
  var _hasMore = true;
  var _loading = false;
  Object? _error;

  /// 새로고침이 시작되면 늘어난다. 그 전에 출발한 응답은 늦게 도착해도 버린다
  var _generation = 0;
  var _disposed = false;

  List<T> get items => _items;
  bool get hasMore => _hasMore;
  bool get isLoading => _loading;

  /// 마지막 요청의 실패. 다음 요청이 시작되면 지운다
  Object? get error => _error;

  /// 다음 묶음을 받는다. 이미 받는 중이거나 끝까지 받았으면 아무것도 하지 않는다
  Future<void> loadMore() async {
    if (_loading || !_hasMore) return;
    final generation = _generation;
    _loading = true;
    _error = null;
    _notify();
    try {
      final chunk = await _source.next();
      if (generation != _generation) return;
      _items = [..._items, ...chunk.items];
      _hasMore = chunk.hasMore;
    } catch (error) {
      if (generation != _generation) return;
      _error = error;
    } finally {
      if (generation == _generation) {
        _loading = false;
        _notify();
      }
    }
  }

  /// 처음부터 다시 받는다. 받는 동안 지금 목록은 그대로 둔다 — 당겨서
  /// 새로고침할 때 화면이 비었다가 다시 차면 읽던 자리를 잃는다.
  /// 실패하면 지금 목록을 남기고 [error]만 채운다.
  Future<void> refresh() async {
    final generation = ++_generation;
    final source = _newSource();
    _loading = true;
    _error = null;
    _notify();
    try {
      final chunk = await source.next();
      if (generation != _generation) return;
      _source = source;
      _items = chunk.items;
      _hasMore = chunk.hasMore;
    } catch (error) {
      if (generation != _generation) return;
      _error = error;
    } finally {
      if (generation == _generation) {
        _loading = false;
        _notify();
      }
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
