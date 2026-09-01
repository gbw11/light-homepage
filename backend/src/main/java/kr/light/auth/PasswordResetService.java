package kr.light.auth;

import kr.light.common.ApiException;
import kr.light.common.Passwords;
import kr.light.common.SecureTokens;
import kr.light.member.Member;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * 리셋 코드로 비밀번호 재설정 (SPEC_API.md §8.4 → §2.9).
 *
 * <h2>왜 메일이 아니라 사람이 전하는가</h2>
 * v1.3에서 이메일을 아예 수집하지 않기로 했다. 그래서 "본인에게만 닿는
 * 통로"가 없다 — 대신 <b>전도사가 명단의 전화번호로 본인을 확인하고</b>
 * 코드를 구두·문자로 전한다. 본인 확인의 근거는 시스템이 아니라 사람이고,
 * 그래서 발급이 감사로그에 남는다.
 *
 * <p>자력 수단은 카카오 로그인뿐이다 (§2.7).
 *
 * <h2>실패는 전부 같은 401이다</h2>
 * 없는 아이디 · 틀린 코드 · 만료된 코드 · 이미 쓴 코드 · 아이디와 코드의
 * 주인이 다름 — 구분해 주면 "이 아이디는 존재한다"와 "이 코드는 살아 있다"가
 * 새어나간다 (§2.9).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    /** 코드 수명 (§8.4). 사람이 전화로 전하고 받아 적는 시간이다 */
    private static final Duration CODE_TTL = Duration.ofMinutes(30);

    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * 리셋 코드 발급 (SPEC_API.md §8.4) — 전도사만 호출한다.
     *
     * <p><b>평문은 이 반환값에만 존재한다.</b> 서버는 해시만 갖고, 다시 알아낼
     * 방법이 없다. 전도사가 화면에서 놓치면 새로 발급해야 한다.
     *
     * <p>새로 발급하면 <b>이전 코드는 즉시 무효</b>가 된다 — 살아 있는 코드가
     * 항상 하나여야, 지난 문자에 남은 값으로 나중에 비밀번호가 바뀌지 않는다.
     */
    @Transactional
    public IssuedCode issue(Member member, Instant now) {
        // ⚠️ 카카오 전용 계정에는 발급하지 않는다. §2.9는 loginId로 대조하는데
        //    그 계정에는 loginId가 없어 코드를 받아도 쓸 방법이 없다 —
        //    전도사가 "줬는데 안 된다"는 상황을 겪게 된다.
        if (member.getLoginId() == null) {
            throw ApiException.validation("id",
                    "카카오로 가입한 계정입니다. 카카오 로그인으로 안내해 주세요.");
        }

        tokenRepository.invalidateAllFor(member, now);

        String code = ResetCodes.generate();
        Instant expiresAt = now.plus(CODE_TTL);

        tokenRepository.save(PasswordResetToken.builder()
                .member(member)
                .tokenHash(SecureTokens.hash(ResetCodes.normalize(code)))
                .expiresAt(expiresAt)
                .build());

        // ⚠️ 코드 평문을 로그에 남기지 않는다. 남의 비밀번호를 바꿀 수 있는 값이다.
        log.info("비밀번호 리셋 코드 발급: member={}", member.getId());

        return new IssuedCode(code, expiresAt);
    }

    /**
     * 코드로 새 비밀번호 설정 (SPEC_API.md §2.9).
     *
     * <p><b>성공하면 그 회원의 모든 기기에서 로그아웃된다.</b> 재설정하는
     * 상황은 대개 계정이 남의 손에 있을지도 모른다는 뜻이라, 기존 세션을
     * 살려두면 비밀번호를 바꾼 의미가 사라진다.
     */
    @Transactional
    public void resetWithCode(String loginId, String rawCode, String newPassword, Instant now) {
        PasswordResetToken token = tokenRepository
                .findByTokenHash(SecureTokens.hash(ResetCodes.normalize(rawCode)))
                .filter(t -> t.isUsable(now))
                // 없는 코드 · 이미 쓴 코드 · 만료된 코드 — 전부 같은 401
                .orElseThrow(this::invalidCode);

        Member member = token.getMember();

        // ⚠️ 코드만으로는 부족하다. 아이디가 그 코드의 주인과 같아야 한다 —
        //    아니면 어디선가 흘러나온 코드 하나로 아무 계정이나 열 수 있다.
        if (!loginId.trim().equals(member.getLoginId())) {
            log.debug("리셋 코드의 주인이 아닌 아이디로 시도");
            throw invalidCode();
        }

        Passwords.assertWithinBcryptLimit(newPassword);

        member.changePassword(passwordEncoder.encode(newPassword));
        token.markUsed(now);
        refreshTokenRepository.revokeAllFor(member, now);
    }

    /** 실패 이유를 구분해 주지 않는다 — 문구가 다르면 문구 자체가 답을 알려준다 */
    private ApiException invalidCode() {
        return ApiException.unauthorized("코드가 올바르지 않거나 만료되었습니다.");
    }

    /**
     * 발급 결과.
     *
     * @param code      ★ 평문. 이 순간에만 존재한다 — 응답으로 내보내고 잊는다
     * @param expiresAt FE가 "언제까지 유효한지"를 화면에 띄운다
     */
    public record IssuedCode(String code, Instant expiresAt) {
    }
}
