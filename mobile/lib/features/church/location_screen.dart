import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../content/location.dart';
import '../../content/parking.dart';
import 'info_widgets.dart';
import 'route_map.dart';

/// 오시는 길 (웹 `/location`, WIREFRAME §8, 기획안 §3).
///
/// 위에서부터 **경고 → 주소 · 지도 앱 → 본당에서(약도) → 건물 안내 → 주차(약도)** 순서다.
/// 가장 자주 놓치는 "본당이 아니다"를 맨 위에 두는 것은 웹과 같은 판단이다.
/// 모양은 디자인 시안(Stitch "Warm Fellowship")을 따른다.
///
/// 약도 두 장은 웹 `RouteMap.tsx`의 SVG를 그대로 옮겨 그린 것이다 ([RouteMap] ·
/// [ParkingMap]) — 누르면 전체 화면에서 확대한다. 실제 지도는 설치된 카카오맵 ·
/// 네이버지도 · 구글 지도 앱으로 바로 연다 (없으면 웹 지도). 대중교통은 웹도 ❓라 뺐다.
/// 웹의 건물 그림(`BuildingSketch`)은 아직 옮기지 않았다.
class LocationScreen extends StatelessWidget {
  const LocationScreen({
    super.key,
    required this.openExternal,
    required this.onFirstVisit,
  });

  final void Function(String url) openExternal;
  final VoidCallback onFirstVisit;

  Future<void> _copyAddress(BuildContext context) async {
    await Clipboard.setData(const ClipboardData(text: address));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('주소를 복사했어요.')));
  }

  @override
  Widget build(BuildContext context) {
    return InfoPage(
      title: '오시는 길',
      children: [
        const SizedBox(height: 8),
        const VenueWarning(),
        const SizedBox(height: 16),
        _AddressCard(
          onCopy: () => _copyAddress(context),
          onKakao: () => openExternal(kakaoMapAppUrl),
          onNaver: () => openExternal(naverMapAppUrl),
          onGoogle: () => openExternal(googleMapUrl),
        ),
        // 약도만 둔다 — 아래 설명 글은 뺐다 (사용자 결정 2026-10-14)
        const InfoSection(
          title: '본당에서',
          children: [MapFigure(title: '본당에서 오는 길', map: RouteMap())],
        ),
        const InfoSection(
          title: '건물 안내',
          children: [
            InfoCard(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconBadge(Icons.apartment),
                    SizedBox(width: 14),
                    Expanded(
                      child: InfoText(
                        '모퉁이에 서 있는 노출 콘크리트 4층 건물이고, 옥상 왼쪽에 '
                        '계단탑이 솟아 있어 멀리서도 구분됩니다. 1층 가운데 입구로 '
                        '들어와 4층으로 올라오세요.',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        InfoSection(
          title: '주차 안내',
          children: [
            const InfoText(
              '드림센터 전용 주차장은 없고 김해교회 주차장 세 곳을 함께 씁니다. '
              '세 곳 중 두 곳은 주일에만 주차할 수 있습니다. '
              'P3(합성초)가 가장 가깝습니다.',
              muted: true,
            ),
            const SizedBox(height: 14),
            const MapFigure(title: '주차장에서 오는 길', map: ParkingMap()),
            const SizedBox(height: 14),
            for (final lot in parkingLots) ...[
              _ParkingCard(lot),
              const SizedBox(height: 12),
            ],
            const WarningBox(child: InfoText(parkingCaution)),
            const SizedBox(height: 12),
            const InfoText(
              '김해교회 공식 안내를 옮긴 것입니다. 찬양대별 지정 주차 등 전체 규칙은 '
              '교회 주차안내에서 확인하세요.',
              muted: true,
            ),
            InfoLink(
              '교회 주차안내 열기',
              onPressed: () => openExternal(parkingSourceUrl),
            ),
          ],
        ),
        const SizedBox(height: 28),
        SoftCard(
          child: InfoTile(
            icon: Icons.waving_hand_outlined,
            title: '처음 오시는 분',
            subtitle: '예배 흐름 · 자주 묻는 질문',
            onTap: onFirstVisit,
          ),
        ),
      ],
    );
  }
}

/// 주소 + [복사] + 지도 앱(카카오 · 네이버 · 구글). 내비에 찍거나 남에게 보낼 때 쓴다
class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.onCopy,
    required this.onKakao,
    required this.onNaver,
    required this.onGoogle,
  });

  final VoidCallback onCopy;
  final VoidCallback onKakao;
  final VoidCallback onNaver;
  final VoidCallback onGoogle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      children: [
        Row(
          children: [
            const IconBadge(Icons.place_outlined),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    address,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    venue,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onCopy,
              tooltip: '주소 복사',
              icon: const Icon(Icons.copy_outlined),
            ),
          ],
        ),
        const SizedBox(height: 16),
        // 세 지도 앱을 같은 크기로 한 줄에 — 각 앱의 아이콘 + 아래 이름
        // (2026-10-19 사용자 결정. 전에는 카카오 · 네이버만 버튼이고 구글은 작은
        // 글자 링크였다). 폰 홈 화면의 앱 아이콘과 같은 모양이라 무엇을 여는지
        // 한눈에 안다
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final (label, asset, onPressed) in [
              ('카카오맵', 'kakao_map', onKakao),
              ('네이버지도', 'naver_map', onNaver),
              ('구글지도', 'google_map', onGoogle),
            ])
              Expanded(
                child: _MapAppButton(
                  label: label,
                  asset: 'assets/images/map_apps/$asset.webp',
                  onPressed: onPressed,
                ),
              ),
          ],
        ),
        // 버튼 아래 안내 글(「약도는 길을 알려주는 그림입니다…」)은 뺐다
        // (2026-10-19 사용자 결정)
      ],
    );
  }
}

/// 지도 앱 하나 — 둥근 네모 앱 아이콘 + 아래 이름. 누르는 범위는 아이콘과 이름 전체다
class _MapAppButton extends StatelessWidget {
  const _MapAppButton({
    required this.label,
    required this.asset,
    required this.onPressed,
  });

  final String label;
  final String asset;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      // 「~으로 열기」는 받침에 따라 조사가 달라진다 — 조사 없이 쓴다
      label: '$label 열기',
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Column(
            children: [
              // 폰 홈 화면의 앱 아이콘처럼 흰 둥근 네모 칸 위에 둔다 — 네이버 ·
              // 구글 아이콘은 배경이 투명하다. 테두리는 두지 않는다 (2026-10-19
              // 사용자 결정)
              Container(
                width: 56,
                height: 56,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Image.asset(asset, fit: BoxFit.cover),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 주차장 한 곳 — 번호 동그라미 · 이름 · **언제 댈 수 있나**(알약) · 위치 · 준비물
class _ParkingCard extends StatelessWidget {
  const _ParkingCard(this.lot);

  final ParkingLot lot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return InfoCard(
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: scheme.primary,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${lot.no}',
                style: theme.textTheme.titleSmall?.copyWith(
                  color: scheme.onPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: InfoText('${lot.name} (${lot.no}주차장)', bold: true)),
          ],
        ),
        const SizedBox(height: 12),
        // "언제 댈 수 있나"를 가장 눈에 띄게 — 평일에 왔다가 헛걸음하는 게
        // 가장 흔한 사고다 (웹 주석)
        Align(alignment: Alignment.centerLeft, child: TagPill(lot.when)),
        const SizedBox(height: 8),
        InfoText(lot.toVenue),
        if (lot.needs case final needs?) ...[
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Icon(
                  Icons.info_outline,
                  size: 18,
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(child: InfoText(needs, muted: true)),
            ],
          ),
        ],
      ],
    );
  }
}
