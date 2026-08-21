export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--color-navy-100)] px-5 py-10 text-sm text-[var(--color-gray-400)]">
      <p className="text-base font-bold text-[var(--foreground)]">LIGHT</p>
      <p className="mt-1">Live In God, Help The other</p>

      <div className="mt-4 space-y-1">
        <p>주일 14:00 · 드림센터 4층</p>
        <p>경남 김해시 가락로 117</p>
        <p>055-333-6321</p>
      </div>

      <div className="mt-4 flex gap-4">
        <a href="https://instagram.com" target="_blank" rel="noreferrer">
          ▸ Instagram
        </a>
        <a href="https://youtube.com" target="_blank" rel="noreferrer">
          ▸ YouTube
        </a>
        <a href="https://gimhae.church" target="_blank" rel="noreferrer">
          ▸ 김해교회 홈페이지
        </a>
      </div>

      <p className="mt-6 border-t border-[var(--color-navy-100)] pt-4">
        © 김해교회 청년교회 LIGHT
      </p>
    </footer>
  );
}
