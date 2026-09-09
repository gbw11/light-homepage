import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { CHURCH_PHONE, CHURCH_PHONE_TEL } from "@/content/contact";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "LIGHT 청년교회 홈페이지가 수집하는 개인정보 항목·목적·보유 기간 안내.",
};

/**
 * 개인정보 처리방침 — 초안 (PM 결정 2026-09-09, `docs/records/DECISIONS.md`).
 *
 * ⚠️ **아직 게시(정식 공개) 전 초안이다.** 실제 오픈 직전에 PM이 최종 검토 후
 * "게시" 여부를 확정한다(`LIGHT-185`). 내용은 코드에 실제로 있는 수집 항목만
 * 옮겼다 — 없는 기능을 적어 넣지 않았다.
 *
 * 근거 파일:
 * - 새가족 등록: `welcome/register/RegisterForm.tsx` (이름·연락처, 1년 보유,
 *   이미 화면에 같은 문구가 있다 — 이 페이지는 그 문구를 반박하지 않고 같은
 *   근거로 확장한다)
 * - 회원가입: `signup/SignupFlow.tsx` (이름·생년월일·전화번호는 명단 대조용 —
 *   welcome/register에서 이미 동의받은 값이며 여기서 새로 수집하지 않는다.
 *   새로 수집하는 것은 아이디·비밀번호뿐이다)
 * - 파일 저장: `backend/.../storage/R2Properties.java` (사진·주보·첨부는
 *   Cloudflare R2, 완전 비공개 버킷 · presigned URL만 접근)
 * - 감사 로그: `backend/.../common/AuditLog.java`
 */
export default function PrivacyPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">개인정보 처리방침</h1>
        <p className="mt-4 text-base text-[var(--color-gray-400)]">
          LIGHT 청년교회(이하 &ldquo;청년교회&rdquo;)는 홈페이지 이용자의
          개인정보를 다음과 같이 수집·이용합니다.
        </p>
        <p className="mt-2 text-sm font-bold text-[var(--color-red-500)]">
          ⚠️ 초안 — 아직 정식 게시 전입니다.
        </p>
      </Section>

      <Section title="1. 수집하는 개인정보 항목">
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-bold">새가족 등록 (/welcome/register)</p>
            <p className="mt-1 text-sm text-[var(--color-gray-400)]">
              필수: 이름, 연락처. 선택: 성별, 연령대, 방문 경로, 남기고 싶은 말.
            </p>
          </div>
          <div>
            <p className="font-bold">회원가입 (/signup)</p>
            <p className="mt-1 text-sm text-[var(--color-gray-400)]">
              명단 확인용(신규 수집 아님, 새가족 등록 시 이미 제공한 값과
              대조): 이름, 생년월일, 전화번호. 계정 생성 시 신규 수집: 아이디,
              비밀번호(암호화 저장 — 청년교회는 원문을 볼 수 없습니다).
            </p>
          </div>
          <div>
            <p className="font-bold">출석부 (마을모임)</p>
            <p className="mt-1 text-sm text-[var(--color-gray-400)]">
              이름, 소속 마을, 출석 여부 — 마을 리더 이상만 열람.
            </p>
          </div>
          <div>
            <p className="font-bold">사진·주보·문서</p>
            <p className="mt-1 text-sm text-[var(--color-gray-400)]">
              업로드한 사진·PDF 파일 자체(개인 식별 정보를 포함할 수 있음).
              파일은 비공개 저장소에 두고, 서버가 발급한 10분짜리 임시 링크로만
              접근합니다.
            </p>
          </div>
          <div>
            <p className="font-bold">자동 수집 (감사 로그)</p>
            <p className="mt-1 text-sm text-[var(--color-gray-400)]">
              관리 기능(회원·권한 변경 등) 사용 시 처리자 계정·시각·처리 내용을
              기록합니다. 방문자를 추적하는 분석 도구는 쓰지 않습니다.
            </p>
          </div>
        </div>
      </Section>

      <Section title="2. 수집 목적">
        <ul className="list-disc pl-5 text-base">
          <li>새가족 안내 및 정착 지원</li>
          <li>회원 계정 생성·본인 확인 및 권한별 콘텐츠 제공</li>
          <li>마을모임 출석 관리</li>
          <li>관리 기능 오남용 방지(감사 로그)</li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <ul className="list-disc pl-5 text-base">
          <li>새가족 등록 정보: 등록일로부터 1년 후 자동 삭제</li>
          <li>회원 계정 정보: 탈퇴 시 즉시 삭제(명단 재개방 처리 포함)</li>
          <li>감사 로그: 별도 삭제 전까지 보관(관리 기능 오남용 조사 목적)</li>
        </ul>
      </Section>

      <Section title="4. 제3자 제공 및 위탁">
        <p className="text-base">
          청년교회는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 파일
          저장을 위해 <strong>Cloudflare R2</strong>(비공개 저장소)를,
          카카오 로그인을 선택한 경우 <strong>카카오</strong>의 인증만
          이용합니다 — 두 서비스 모두 청년교회가 직접 그 안의 내용을 열람하지
          않습니다.
        </p>
      </Section>

      <Section title="5. 이용자의 권리">
        <p className="text-base">
          본인의 개인정보 열람·정정·삭제를 원하시면 아래 연락처로 문의해
          주세요. 회원은 <strong>/my</strong>에서 직접 정보 수정·탈퇴가
          가능합니다.
        </p>
      </Section>

      <Section title="6. 문의처">
        <p className="text-base">
          <a href={`tel:${CHURCH_PHONE_TEL}`} className="hover:underline">
            {CHURCH_PHONE}
          </a>{" "}
          (교회 사무실)
        </p>
      </Section>
    </main>
  );
}
