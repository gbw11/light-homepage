package kr.light.meeting;

import jakarta.persistence.*;
import lombok.*;

/**
 * 월례회 자료의 페이지 이미지 한 장.
 *
 * <p>★ r2Key는 절대 클라이언트에 노출하지 않는다. presigned URL도 발급하지
 * 않는다 — 발급하면 기간이 끝난 뒤에도 만료 전까지 살아있고 공유 가능해진다.
 * 서버가 워터마크를 합성해 직접 스트리밍한다 (SPEC_API.md §7.3).
 */
@Entity
@Table(name = "meeting_doc_pages")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class MeetingDocPage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doc_id", nullable = false)
    private MeetingDoc doc;

    @Column(name = "page_no", nullable = false)
    private int pageNo;

    /** ★ 응답에 절대 포함하지 않는다 */
    @Column(name = "r2_key", nullable = false, length = 500)
    private String r2Key;

    private Integer width;

    private Integer height;
}
