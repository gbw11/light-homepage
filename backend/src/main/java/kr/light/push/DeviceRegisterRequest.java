package kr.light.push;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 기기 등록 (SPEC_API.md §15.2) */
@Schema(name = "DeviceRegisterRequest", description = "푸시를 받을 기기 등록")
public record DeviceRegisterRequest(

        @Schema(description = "FCM 등록 토큰 (앱의 FirebaseMessaging.getToken())",
                requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "토큰이 없습니다.")
        @Size(max = 4096, message = "토큰이 너무 깁니다.")
        String token,

        @Schema(example = "ANDROID", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "기기 종류가 없습니다.")
        DevicePlatform platform
) {
}
