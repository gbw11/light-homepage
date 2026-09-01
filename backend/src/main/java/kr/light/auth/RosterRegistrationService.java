package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.common.Passwords;
import kr.light.common.PhoneNumbers;
import kr.light.common.SecureTokens;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import kr.light.roster.RosterEntry;
import kr.light.roster.RosterEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * 명단 대조 가입 (SPEC_API.md §2.1 · §2.2).
 *
 * <h2>실패를 구분해 알려주지 않는다</h2>
 * 이름이 틀렸는지, 생년월일이 틀렸는지, 명단에 없는지, 이미 계정이 있는지를
 * <b>전부 같은 401 하나</b>로 답한다 (§2.1). 구분해 주면 값을 하나씩 바꿔가며
 * "이 조합은 명단에 있다"를 알아낼 수 있고, 그것이 곧 교인 명부다.
 *
 * <p>그래서 이 클래스의 코드는 대부분 "무엇을 알려주지 않을지"에 관한 것이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RosterRegistrationService {

    /** 증표의 수명 (§2.1). 대조 → 아이디·비밀번호 입력 한 화면이면 충분하다 */
    private static final Duration TOKEN_TTL = Duration.ofMinutes(5);

    private final RosterEntryRepository rosterRepository;
    private final RegistrationTokenRepository tokenRepository;
    private final MemberRepository memberRepository;
    private final VerifyRosterRateLimiter rateLimiter;
    private final PasswordEncoder passwordEncoder;

    // ── 1단계: 명단 확인 ─────────────────────────────────────────────

    /**
     * 명단 대조 (SPEC_API.md §2.1).
     *
     * @param clientKey 시도 제한의 기준 (클라이언트 IP)
     */
    @Transactional
    public VerifyRosterResponse verify(VerifyRosterRequest request, String clientKey, Instant now) {
        // ⚠️ 초과해도 429가 아니라 일반 실패와 같은 401이다 (§9-G).
        if (!rateLimiter.tryAcquire(clientKey, now)) {
            log.debug("명단 대조 시도 제한 초과");   // 어떤 값이었는지는 남기지 않는다
            throw notInRoster();
        }

        LocalDate birthDate = parseBirthDate(request.birthDate());
        String phone = normalizePhone(request.phone());

        List<RosterEntry> matches = rosterRepository
                .findByNameAndBirthDateAndPhoneNormalized(request.name().trim(), birthDate, phone);

        if (matches.size() > 1) {
            // DB의 UNIQUE가 막고 있어 정상적으로는 오지 않는다. 그래도 계약에
            // 있는 분기다 — 여기서 예외가 터지면 사용자는 안내 대신 500을 본다.
            log.warn("명단에 같은 사람이 {}건 있습니다 — 명단 정리가 필요합니다", matches.size());
            throw ApiException.validation("name", "동명이인이 확인되었습니다. 임원에게 문의해 주세요.");
        }

        RosterEntry entry = matches.stream()
                .findFirst()
                // 명단에 없음 · 이름이 틀림 · 생년월일이 틀림 · 전화번호가 틀림 —
                // 전부 여기로 온다. 어느 쪽인지 알려주지 않는다.
                .orElseThrow(this::notInRoster);

        // ⚠️ "이미 계정이 있습니다"도 같은 응답이다. 알려주면 "이 사람은
        //    가입돼 있다"가 새어나가고, 그것만으로 명단의 존재가 확인된다.
        //    진짜 본인이 여기 걸리면 전도사가 §8.2로 계정을 지워 다시 연다.
        if (!entry.isClaimable()) {
            log.debug("이미 계정이 있거나 비활성인 명단 행");
            throw notInRoster();
        }

        return new VerifyRosterResponse(issueToken(entry, now), entry.getName(), TOKEN_TTL.toSeconds());
    }

    // ── 2단계: 계정 생성 ─────────────────────────────────────────────

    /**
     * 계정 생성 (SPEC_API.md §2.2) — 승인 없이 즉시 {@code MEMBER}.
     *
     * <p>세션 쿠키를 함께 발급하지 않는다 (2026-09-01 확정). FE가 가입 완료
     * 화면에서 로그인으로 유도한다.
     */
    @Transactional
    public RegisterResponse register(RegisterRequest request, Instant now) {
        RegistrationToken token = tokenRepository
                .findByTokenHash(SecureTokens.hash(request.registrationToken()))
                .filter(t -> t.isUsable(now))
                // 없는 토큰 · 이미 쓴 토큰 · 만료된 토큰 — 전부 같은 401이다
                .orElseThrow(ApiException::unauthorized);

        RosterEntry entry = token.getRosterEntry();

        // 대조와 가입 사이에 누군가 먼저 가져갔을 수 있다. 증표가 유효하다는
        // 것과 명단 행이 아직 비어 있다는 것은 다른 사실이다.
        if (!entry.isClaimable()) {
            throw ApiException.unauthorized();
        }

        String loginId = request.loginId().trim();
        if (memberRepository.existsByLoginId(loginId)) {
            // ⚠️ 여기는 알려준다. 아이디는 사용자가 방금 정한 값이라 중복을
            //    숨기면 다음에 뭘 해야 할지 알 수 없다. 명단과 달리 이 사실은
            //    개인정보가 아니다.
            throw ApiException.duplicate("loginId", "이미 사용 중인 아이디입니다.");
        }

        Passwords.assertWithinBcryptLimit(request.password());
        rejectPasswordMadeOfPersonalData(request.password(), entry);

        Member member = memberRepository.save(Member.registerFromRoster(
                entry, loginId, passwordEncoder.encode(request.password())));

        entry.claimBy(member, now);
        token.markUsed(now);

        return RegisterResponse.of(member);
    }

    // ── 내부 ─────────────────────────────────────────────────────────

    private String issueToken(RosterEntry entry, Instant now) {
        // 다시 대조하면 이전 증표는 즉시 못 쓰게 된다 — 살아 있는 증표는 하나뿐
        tokenRepository.invalidateAllFor(entry, now);

        String raw = SecureTokens.randomToken();
        tokenRepository.save(RegistrationToken.builder()
                .rosterEntry(entry)
                .tokenHash(SecureTokens.hash(raw))
                .expiresAt(now.plus(TOKEN_TTL))
                .build());

        return raw;
    }

    /**
     * 생년월일·전화번호를 비밀번호로 쓰지 못하게 한다 (SPEC_API.md §2.2).
     *
     * <p>가입 직전에 그 두 값을 화면에 입력했기 때문에 <b>가장 손이 가는
     * 비밀번호</b>다. 그런데 그 둘은 이 서비스에서 "본인임을 증명하는 값"이라,
     * 아는 사람이라면 비밀번호까지 아는 것이 된다.
     */
    private void rejectPasswordMadeOfPersonalData(String password, RosterEntry entry) {
        String digits = password.replaceAll("\\D", "");
        LocalDate birth = entry.getBirthDate();

        boolean isBirthDate = !digits.isEmpty() && List.of(
                        "%04d%02d%02d".formatted(birth.getYear(), birth.getMonthValue(), birth.getDayOfMonth()),
                        "%02d%02d%02d".formatted(birth.getYear() % 100, birth.getMonthValue(), birth.getDayOfMonth()))
                .contains(digits);

        boolean isPhone = !digits.isEmpty() && digits.equals(entry.getPhoneNormalized());

        if (isBirthDate || isPhone) {
            throw ApiException.validation("password",
                    "생년월일·전화번호는 비밀번호로 쓸 수 없습니다.");
        }
    }

    /**
     * 대조 실패 — <b>모든 이유가 이 하나로 모인다.</b>
     *
     * <p>메시지도 하나뿐이다. 이유마다 문구가 다르면 문구 자체가 답을 알려준다.
     */
    private ApiException notInRoster() {
        return ApiException.unauthorized("명단에서 확인되지 않습니다.");
    }

    /**
     * 형식 오류는 알려준다 — 명단의 내용을 흘리지 않기 때문이다.
     *
     * <p>"2001-13-45는 날짜가 아니다"는 명단을 보지 않고도 알 수 있는 사실이다.
     */
    private LocalDate parseBirthDate(String raw) {
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw ApiException.validation("birthDate", "생년월일을 확인해주세요.");
        }
    }

    private String normalizePhone(String raw) {
        String normalized = PhoneNumbers.normalize(raw);
        if (normalized == null) {
            throw ApiException.validation("phone", "전화번호를 확인해주세요.");
        }
        return normalized;
    }
}
