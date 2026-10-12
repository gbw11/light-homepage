// 원본: frontend/src/app/worship/page.tsx 의 `SCHEDULE` — 예배 시간이 바뀌면 두 곳을
// 함께 고친다 (기획안 결정 D6).

/// 예배·모임 시간표의 한 줄
typedef ScheduleRow = ({String name, String time, String place});

const worshipSchedule = <ScheduleRow>[
  (name: '청년예배', time: '주일 14:00', place: '드림센터 4층'),
  (name: '마을모임', time: '예배 후 15:30~16:00', place: '드림센터 4층'),
];

/// 주일 청년예배 시각 — 라이브가 없을 때 "다음 예배"로 보여준다
final sundayWorshipTime = worshipSchedule.first.time;
