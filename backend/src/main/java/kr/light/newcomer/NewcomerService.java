package kr.light.newcomer;

import kr.light.common.ApiException;
import kr.light.common.SlidingWindowRateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Optional;

/**
 * 새가족 등록 (SPEC_API.md §9.1).
 *
 * <p>공개 폼이라 인증이 없다. 그래서 <b>검사 순서 자체가 방어 장치</b>다 —
 * {@link #register} 참고.
 */
@Slf4j
@Service
public class NewcomerService {

    /** 동일 IP 5분 5회 (SPEC_API.md §9.1 · SPEC_NONFUNCTIONAL.md NFR-SEC-26) */
    private static final int MAX_SUBMISSIONS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(5);

    /** "오늘"은 교회가 있는 한국 날짜로 센다 — UTC로 세면 자정~오전 9시에 하루가 어긋난다 */
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final LocalDate EARLIEST_BIRTH_DATE = LocalDate.of(1900, 1, 1);

    private final NewcomerRepository repository;
    private final NewcomerNotifier notifier;
    private final SlidingWindowRateLimiter rateLimiter;

    public NewcomerService(NewcomerRepository repository, NewcomerNotifier notifier) {
        this.repository = repository;
        this.notifier = notifier;
        this.rateLimiter = new SlidingWindowRateLimiter(MAX_SUBMISSIONS, WINDOW);
    }

    /**
     * 등록.
     *
     * <p><b>검사 순서가 중요하다.</b>
     * <ol>
     *   <li><b>honeypot 먼저.</b> 봇에게는 아무것도 알려주지 않고 조용히 끝낸다
     *       ({@code Optional.empty()} → 204). rate limit을 먼저 보면 봇이 429를
     *       받아 "제한이 있다"는 것을 알게 되고, IP를 바꿔가며 우회한다.</li>
     *   <li><b>동의 검증.</b> {@code agreed}가 true가 아니면 저장하지 않는다
     *       (FR-PUB-08 — 서버에서도 재검증). 화면에서 막았더라도 API는 직접
     *       호출될 수 있다.</li>
     *   <li><b>rate limit.</b> 사람이 보낸 유효한 요청에만 적용한다.</li>
     * </ol>
     *
     * @return 저장된 신청. 봇으로 판별되면 {@code Optional.empty()}
     */
    @Transactional
    public Optional<NewcomerRequest> register(NewcomerCreateRequest request, String clientIp, Instant now) {
        if (request.looksLikeBot()) {
            // 무엇이 걸렸는지 응답으로도 로그로도 드러내지 않는다
            log.debug("honeypot에 걸린 요청을 버렸다");
            return Optional.empty();
        }

        if (!request.agreedToPrivacyPolicy()) {
            throw ApiException.validation("agreed", "개인정보 수집·이용에 동의해주세요.");
        }

        LocalDate birthDate = parseBirthDate(request.birthDate(), now);

        if (!rateLimiter.tryAcquire(clientIp, now)) {
            throw ApiException.rateLimited();
        }

        NewcomerRequest saved = repository.save(NewcomerRequest.builder()
                .name(request.name())
                .phone(request.phone())
                .gender(request.gender())
                .birthDate(birthDate)
                .referrer(request.referrer())
                .message(request.message())
                // 동의 시각은 클라이언트가 보낸 값이 아니라 서버 시각이다.
                // 동의 사실을 증명해야 하는 기록이라 조작 가능한 값을 쓰지 않는다.
                .agreedAt(now)
                .build());

        notifyQuietly(saved);
        return Optional.of(saved);
    }

    /**
     * 생년월일 문자열을 날짜로.
     *
     * <p>형식({@code YYYY-MM-DD})은 요청 바인딩에서 이미 걸렀다. 여기서는 형식은
     * 맞지만 달력에 없는 날짜({@code 2001-02-30})와, 오늘(한국 시각)보다 뒤인
     * 날짜·1900년 이전 날짜를 거른다 — DB 제약(V10)과 같은 하한이다.
     */
    private static LocalDate parseBirthDate(String raw, Instant now) {
        LocalDate birthDate;
        try {
            birthDate = LocalDate.parse(raw);
        } catch (DateTimeParseException e) {
            throw ApiException.validation("birthDate", "생년월일을 확인해주세요.");
        }
        LocalDate today = LocalDate.ofInstant(now, KST);
        if (birthDate.isAfter(today) || birthDate.isBefore(EARLIEST_BIRTH_DATE)) {
            throw ApiException.validation("birthDate", "생년월일을 확인해주세요.");
        }
        return birthDate;
    }

    /**
     * 알림은 실패해도 등록을 되돌리지 않는다.
     *
     * <p>메일이 안 나갔다는 이유로 접수를 없애면, 방문하겠다고 마음먹은 사람의
     * 신청이 사라진다. 담당자가 늦게 아는 것이 훨씬 낫다.
     *
     * <p>⚠️ 지금은 트랜잭션 안에서 부르므로 알림이 느리면 응답도 느려진다.
     * 실제 HTTP 발송을 붙일 때는 커밋 뒤 비동기로 옮길 것
     * ({@code @TransactionalEventListener(AFTER_COMMIT)}).
     */
    private void notifyQuietly(NewcomerRequest saved) {
        try {
            notifier.notifyNewcomerRegistered(saved);
        } catch (RuntimeException e) {
            log.error("새가족 등록 알림 실패 — 등록은 유지한다. id={}", saved.getId(), e);
        }
    }
}
