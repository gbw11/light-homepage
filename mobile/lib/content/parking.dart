// 원본: frontend/src/content/parking.ts — 모교회(김해교회) 공식 주차 안내를 옮긴 것.
// 값이 바뀌면 두 곳을 함께 고친다 (기획안 결정 D6). 찬양대별 지정 주차는 청년에게
// 해당하지 않아 웹도 옮기지 않았다 — 전문은 [parkingSourceUrl].

const parkingSourceUrl = 'https://www.gloria.or.kr/general-5';

typedef ParkingLot = ({
  int no,
  String name,

  /// 드림센터 기준 위치 — 방문자가 실제로 알고 싶은 것
  String toVenue,

  /// 언제 댈 수 있나. 세 곳 중 두 곳이 주일에만 열린다
  String when,

  /// 미리 준비해야 하는 것
  String? needs,
});

const parkingLots = <ParkingLot>[
  (
    no: 1,
    name: '교회 건너편 주차장',
    toVenue: '본당 맞은편. 드림센터까지는 본당에서 걷는 길과 같아 도보 2~3분',
    when: '주일·평일 모두',
    needs: '평일에 대려면 차단기 단말기가 필요합니다 (교회 사무실, 10,000원)',
  ),
  (
    no: 2,
    name: '농협 주차장',
    toVenue: '드림센터 남동쪽, 걸어서 금방',
    when: '주일 오후 4시 이전까지만 (평일·토요일 불가)',
    needs: '차량에 교회 스티커가 붙어 있어야 합니다 (교회 사무실 발부)',
  ),
  (
    no: 3,
    name: '합성초 주차장',
    toVenue: '드림센터 바로 옆. 세 곳 중 가장 가깝습니다',
    when: '주일만 (평일·토요일 불가)',
    needs: '주차라인에 맞춰 대주세요. 운동장은 주차할 수 없습니다',
  ),
];

/// 1주차장에만 붙는 주의 — 청년예배(14:00) 시간대에 그대로 걸린다
const parkingCaution =
    '예배 중에는 교회 주차장에서 차를 빼기 어렵습니다. 이중 주차를 하게 되면 연락처를 남기고 열쇠를 주차요원에게 맡겨 주세요.';
