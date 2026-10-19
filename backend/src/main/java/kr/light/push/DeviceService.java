package kr.light.push;

import kr.light.common.ApiException;
import kr.light.member.Member;
import kr.light.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** 푸시를 받을 기기 등록 · 해제 (SPEC_API.md §15.2) */
@Service
@RequiredArgsConstructor
public class DeviceService {

    private final MemberDeviceRepository deviceRepository;
    private final MemberRepository memberRepository;

    /**
     * 등록 — 같은 토큰이 이미 있으면 덮어쓴다(멱등).
     *
     * <p>앱은 켤 때마다, 로그인할 때마다, FCM이 토큰을 바꿀 때마다 부른다. 그래서
     * 같은 요청이 여러 번 와도 한 줄이다. 같은 폰에서 다른 사람이 로그인하면
     * <b>주인을 옮긴다</b> — 앞 사람의 회원 알림이 계속 가면 안 된다.
     */
    @Transactional
    public void register(Long memberId, DeviceRegisterRequest request, Instant now) {
        Member owner = memberRepository.findById(memberId).orElseThrow(ApiException::unauthorized);
        deviceRepository.findByToken(request.token()).ifPresentOrElse(
                device -> device.moveTo(owner, request.platform(), now),
                () -> deviceRepository.save(MemberDevice.builder()
                        .member(owner)
                        .token(request.token())
                        .platform(request.platform())
                        .updatedAt(now)
                        .build()));
    }

    /**
     * 해제 — 로그아웃할 때 앱이 부른다. <b>내 기기만</b> 지운다.
     *
     * <p>없는 토큰 · 남의 토큰이어도 똑같이 성공(204)한다. 실패를 주면 "그 토큰이
     * 누구 것인지"가 새고, 앱은 어차피 로그아웃을 이어 가야 한다.
     */
    @Transactional
    public void unregister(Long memberId, String token) {
        deviceRepository.deleteMine(token, memberId);
    }
}
