package kr.light.newcomer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.light.common.ApiResponse;
import kr.light.common.ClientAddress;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Optional;

/**
 * 새가족 등록 — 공개 폼 (SPEC_API.md §9).
 *
 * <p>비로그인 포함 누구나 부를 수 있는 유일한 <b>쓰기</b> 엔드포인트다
 * (인가 매트릭스 {@code POST /newcomers}는 5개 역할 전부 통과).
 */
@Tag(name = "새가족", description = "공개 등록 폼. 인증이 필요 없다.")
@RestController
@RequestMapping(value = "/api/newcomers", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class NewcomerController {

    private final NewcomerService newcomerService;

    @Operation(summary = "새가족 등록",
            description = """
                    공개 폼입니다. 인증이 필요 없습니다.

                    - `agreed`가 `true`가 아니면 `VALIDATION_ERROR`입니다. 화면에서 막더라도
                      서버가 다시 검증합니다.
                    - `honeypot`에 값이 있으면 봇으로 보고 **`204`로 조용히 끝냅니다.**
                      저장도 알림도 하지 않습니다.
                    - 동일 IP에서 **5분에 5회**를 넘기면 `429 RATE_LIMITED`입니다.

                    ⚠️ `RATE_LIMITED`는 아직 합의되지 않은 에러 코드입니다
                    (SPEC_API.md §1.2의 7개 집합 밖). 명세가 "거부한다"고만 적고 코드를
                    정하지 않아 임시로 쓰고 있습니다.
                    """)
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "201", description = "접수 완료"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "204", description = "봇으로 판별 — 본문 없음"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400", ref = "#/components/responses/VALIDATION_ERROR"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "429", ref = "#/components/responses/RATE_LIMITED")
    })
    @PostMapping
    public ResponseEntity<ApiResponse<NewcomerCreatedResponse>> register(
            @Valid @RequestBody NewcomerCreateRequest request,
            HttpServletRequest httpRequest
    ) {
        Optional<NewcomerRequest> saved =
                newcomerService.register(request, ClientAddress.of(httpRequest), Instant.now());

        // 봇에게는 본문을 주지 않는다. 성공과 구분되는 단서를 남기지 않기 위해
        // 에러도 아니다 (SPEC_API.md §9.1).
        return saved
                .map(r -> ResponseEntity.status(HttpStatus.CREATED)
                        .body(ApiResponse.of(NewcomerCreatedResponse.of(r))))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

}
