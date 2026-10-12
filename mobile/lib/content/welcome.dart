// 원본: frontend/src/app/welcome/page.tsx 의 `TIMELINE` · `FAQ_ITEMS` — 바뀌면 두 곳을
// 함께 고친다 (기획안 결정 D6). 웹에서 ❓(확인 필요)로 남은 항목은 옮기지 않았다.

/// 주일 흐름의 한 칸
typedef TimelineStep = ({String time, String label, String? detail});

const sundayTimeline = <TimelineStep>[
  (time: '~13:50', label: '도착', detail: '입구에서 안내받기'),
  (time: '14:00', label: '청년예배', detail: '드림센터 4층'),
  (time: '~15:20', label: '예배 종료 · 교제', detail: null),
  (time: '15:30', label: '마을모임 (30분)', detail: '처음이면 새가족마을'),
  (time: '16:00', label: '마치고 자유롭게', detail: null),
];

typedef Faq = ({String question, String answer});

const welcomeFaq = <Faq>[
  (question: '몇 살까지 청년교회인가요?', answer: '20세~39세 또는 결혼 전까지입니다.'),
  (question: '뭘 입고 가야 하나요?', answer: '편한 차림으로 오시면 됩니다.'),
  (question: '혼자 가도 괜찮을까요?', answer: '네, 혼자 오셔도 전혀 괜찮습니다.'),
  (question: '헌금을 해야 하나요?', answer: '필수가 아닙니다. 부담 없이 오세요.'),
  (question: '마을에 꼭 들어가야 하나요?', answer: '예배만 참석하고 가셔도 괜찮습니다.'),
];
