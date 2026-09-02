package kr.light.sermon;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import kr.light.common.ApiResponse;
import kr.light.common.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 설교 영상 (SPEC_API.md §9.2 · §9.3). 권한 `G` — 누구나 본다.
 *
 * <p><b>BE가 YouTube Data API를 프록시한다.</b> 브라우저가 YouTube를 직접
 * 부르지 않는다 — API 키를 클라이언트에 실을 수 없기 때문이다(NFR-SEC-22).
 *
 * <p>영상 자체는 우리가 저장하지 않는다. 목록·라이브 여부만 중계하고,
 * 재생은 FE가 YouTube 임베드로 한다.
 */
@Tag(name = "설교", description = "설교 영상 목록 · 진행 중인 라이브")
@RestController
@RequestMapping(value = "/api/sermons", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class SermonController {

    /** 기본 12편 — 한 행 4개 × 3줄 (`/sermons/all`) */
    private static final int DEFAULT_SIZE = 12;
    private static final int MAX_SIZE = 50;

    private final SermonService sermonService;

    @Operation(summary = "설교 영상 목록",
            description = """
                    채널의 설교 영상을 **최신순**으로 돌려줍니다. 화면은 정렬하지 않습니다.

                    `thumbnailUrl`은 YouTube CDN 주소를 그대로 넘깁니다 — FE가 `<img>`로
                    직접 로드하고, **404가 오면 자리표시자로 넘어갑니다**(영상이 비공개로
                    바뀌는 경우).

                    ⚠️ **응답은 6시간 캐시됩니다.** YouTube 쿼터가 하루 10,000 units라
                    캐시가 없으면 방문자 수에 비례해 소진되고, 그러면 그날 하루 설교
                    화면이 통째로 빕니다. 설교는 주 1회 올라가므로 6시간이면 충분합니다.

                    ⚠️ **YouTube 호출이 실패하면 빈 목록**입니다 — 502가 아닙니다.
                    "아직 등록된 영상이 없습니다"로 보이는 것이 화면 전체가 에러로
                    바뀌는 것보다 낫습니다.
                    """)
    @ApiResponses(@io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "조회 성공 (실패해도 빈 목록으로 200)"))
    @GetMapping
    public ApiResponse<PageResponse<SermonVideo>> list(
            @Parameter(description = "0부터. 기본 0")
            @RequestParam(required = false) Integer page,

            @Parameter(description = "기본 12, 최대 50")
            @RequestParam(required = false) Integer size
    ) {
        SermonService.SermonPage found = sermonService.list(normalizePage(page), normalizeSize(size));
        return ApiResponse.of(new PageResponse<>(
                found.items(), found.page(), found.size(), found.hasNext()));
    }

    @Operation(summary = "진행 중인 라이브",
            description = """
                    주일 청년예배가 일요일 13:45 무렵 라이브로 올라옵니다. 방송이 켜져
                    있으면 `/sermons` 맨 위가 라이브 재생 화면으로 바뀝니다.

                    ⚠️ **방송 중이 아니면 `{ "data": null }`** 입니다.
                    빈 객체나 `live: false` 플래그를 쓰지 않고, **404도 아닙니다** —
                    "방송이 없다"는 정상 상태입니다.

                    ⚠️ **응답은 60초 캐시됩니다** (계약이 정한 상한). 화면이 60초마다
                    다시 물어보므로 그보다 길면 방송 시작이 그만큼 늦게 반영됩니다.

                    **요일로 걸러내지 않습니다** — 특별집회 등 다른 요일 방송도 그대로
                    뜹니다. "지금 라이브인가"만 판단합니다.
                    """)
    @ApiResponses(@io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "방송 중이면 정보, 아니면 data=null"))
    @GetMapping("/live")
    public ApiResponse<LiveBroadcast> live() {
        return ApiResponse.of(sermonService.findLive().orElse(null));
    }

    // ── 보조 ──────────────────────────────────────────────────

    static int normalizePage(Integer page) {
        return (page == null || page < 0) ? 0 : page;
    }

    /** 범위를 벗어나면 400이 아니라 잘라낸다 (다른 목록 API와 같은 규칙) */
    static int normalizeSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }
}
