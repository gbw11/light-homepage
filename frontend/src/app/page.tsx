/**
 * 임시 홈. 실제 화면은 docs/WIREFRAME.md §1 (HOME)에 따라 구현한다.
 * 이 파일은 초기화 확인용 플레이스홀더다.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm tracking-[0.3em] text-zinc-500">LIGHT</p>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        김해교회 청년교회
      </h1>

      <p className="max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        청년예배 주일 14:00 · 드림센터 4층
        <br />
        마을모임 예배 후 15:30~16:00
      </p>

      <p className="mt-8 text-xs text-zinc-400">
        초기 설정 완료 — 화면 구현은 docs/WIREFRAME.md 참조
      </p>
    </main>
  );
}
