import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../content/location.dart';
import '../../content/parking.dart';
import 'info_widgets.dart';

/// 오시는 길 (웹 `/location`, WIREFRAME §8, 기획안 §3).
///
/// 위에서부터 **경고 → 주소 · 지도 앱 → 걸어서 → 도착 → 주차** 순서다.
/// 가장 자주 놓치는 "본당이 아니다"를 맨 위에 두는 것은 웹과 같은 판단이다.
/// 모양은 디자인 시안(Stitch "Warm Fellowship")을 따른다.
///
/// 웹의 약도 그림(SVG)은 아직 옮기지 않았다. 지도는 설치된 카카오맵 ·
/// 네이버지도 앱으로 연다 (없으면 브라우저). 대중교통은 웹도 ❓라 뺐다.
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
          onKakao: () => openExternal(kakaoMapUrl),
          onNaver: () => openExternal(naverMapUrl),
        ),
        const InfoSection(
          title: '걸어서 — 본당에서',
          children: [
            InfoCard(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    IconBadge(Icons.directions_walk),
                    SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TagPill('도보 $walkMinutes분 · ${walkMeters}m'),
                          SizedBox(height: 8),
                          InfoText(
                            '본당 앞에서 남쪽으로 95m 내려가, 김해합성초등학교가 끝나는 '
                            '곳에서 오른쪽으로 39m. 갈림길이 없어 한 번만 꺾으면 됩니다.',
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        const InfoSection(
          title: '도착 — 이 건물입니다',
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
          title: '차로 — 주차 안내',
          children: [
            const InfoText(
              '드림센터 전용 주차장은 없고 김해교회 주차장 세 곳을 함께 씁니다. '
              '세 곳 중 두 곳은 주일에만 주차할 수 있습니다.',
              muted: true,
            ),
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

/// 주소 + [복사] + 지도 앱 두 개. 내비에 찍거나 남에게 보낼 때 쓴다
class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.onCopy,
    required this.onKakao,
    required this.onNaver,
  });

  final VoidCallback onCopy;
  final VoidCallback onKakao;
  final VoidCallback onNaver;

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
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: onKakao,
                style: pillButtonStyle(context),
                icon: const Icon(Icons.map_outlined, size: 20),
                label: const Text('카카오맵'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: onNaver,
                style: pillButtonStyle(context, primary: false),
                icon: const Icon(Icons.map_outlined, size: 20),
                label: const Text('네이버지도'),
              ),
            ),
          ],
        ),
      ],
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
