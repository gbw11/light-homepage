package kr.light.photo;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * ⚠️ 스케줄링을 여기서 처음 켠다. 미커밋 사진 정리 배치(§6.5)가 첫 사용처다.
 *
 * <p>정리가 돌지 않으면 R2에 고아 객체가 쌓이고, 그건 DB 합계로 세는 용량
 * 화면(§8.5)에 잡히지 않는다 — 즉 <b>보이지 않는 곳에서 용량이 샌다.</b>
 */
@Configuration
@EnableScheduling
class PhotoConfig {
}
