import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../content/location.dart';
import '../../content/parking.dart';
import 'info_widgets.dart';

/// 오시는 길 (웹 `/location`, WIREFRAME §8, 기획안 §3).
///
/// 위에서부터 **경고 → 걸어서 · 차로 → 지도 앱 → 주소 → 주차** 순서다.
/// 가장 자주 놓치는 "본당이 아니다"를 맨 위에 두는 것은 웹과 같은 판단이다.
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
        _AddressCard(onCopy: () => _copyAddress(context)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: () => openExternal(kakaoMapUrl),
                child: const Text('카카오맵'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: () => openExternal(naverMapUrl),
                child: const Text('네이버지도'),
              ),
            ),
          ],
        ),
        const InfoSection(
          title: '걸어서 — 본당에서',
          children: [
            InfoText(
              '본당 앞에서 남쪽으로 95m 내려가, 김해합성초등학교가 끝나는 곳에서 '
              '오른쪽으로 39m. 도보 $walkMinutes분입니다. 갈림길이 없어 한 번만 '
              '꺾으면 됩니다.',
            ),
          ],
        ),
        const InfoSection(
          title: '도착 — 이 건물입니다',
          children: [
            InfoText(
              '모퉁이에 서 있는 노출 콘크리트 4층 건물이고, 옥상 왼쪽에 계단탑이 '
              '솟아 있어 멀리서도 구분됩니다. 1층 가운데 입구로 들어와 4층으로 '
              '올라오세요.',
            ),
          ],
        ),
        InfoSection(
          title: '차로 — 주차 안내',
          children: [
            const InfoText(
              '드림센터 전용 주차장은 없고 김해교회 주차장 세 곳을 함께 씁니다. '
              '세 곳 중 두 곳은 주일에만 주차할 수 있습니다.',
            ),
            const SizedBox(height: 12),
            for (final lot in parkingLots) ...[
              _ParkingCard(lot),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 4),
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
        const SizedBox(height: 16),
        InfoLink('처음 오시는 분 (예배 흐름 · 자주 묻는 질문)', onPressed: onFirstVisit),
      ],
    );
  }
}

/// 주소 + [복사]. 내비에 찍거나 남에게 보낼 때 쓴다
class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.onCopy});

  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InfoCard(
      children: [
        Row(
          children: [
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
      ],
    );
  }
}

class _ParkingCard extends StatelessWidget {
  const _ParkingCard(this.lot);

  final ParkingLot lot;

  @override
  Widget build(BuildContext context) {
    return InfoCard(
      children: [
        InfoText('${lot.no}주차장 · ${lot.name}', bold: true),
        const SizedBox(height: 4),
        InfoText(lot.toVenue),
        const SizedBox(height: 8),
        // "언제 댈 수 있나"를 가장 눈에 띄게 — 평일에 왔다가 헛걸음하는 게
        // 가장 흔한 사고다 (웹 주석)
        InfoText(lot.when, bold: true),
        if (lot.needs case final needs?) ...[
          const SizedBox(height: 4),
          InfoText(needs, muted: true),
        ],
      ],
    );
  }
}
