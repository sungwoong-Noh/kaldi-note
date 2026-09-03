---
id: GRIND
title: 분쇄도 환산
status: 구현완료
plan: docs/plans/2026-08-14-plan1-foundation.md
---

# 분쇄도 환산 스펙

> 2026-08-14 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).

## 무엇을

사용자가 어떤 그라인더의 설정값(클릭·눈금)을 입력하면, 그것을 마이크론으로 환산하고 다시 다른 그라인더의 설정값으로 바꿔 돌려준다. 환산은 **그라인더 모델의 사양값**만 사용하며, 결과는 **언제나 추정치**로 표시된다.

### 범위 밖 (Non-goals)

1. **개인 보정값 반영.** `user_grinders.calibration_offset_clicks`는 이번 스펙에서 읽지 않는다. 컬럼은 남겨두고 이후 스펙에서 다룬다.
2. **레시피 조회 응답에 환산값 자동 첨부.** 명시적으로 환산 API를 호출할 때만 계산한다. 레시피 응답이 사용자별로 달라지면 캐싱이 깨진다.
3. **3개 이상 그라인더 동시 환산.** 1:1 변환만 제공한다.

## 왜

여자친구는 Comandante C40을, 나는 1Zpresso K-Plus를 쓴다. "22클릭으로 내렸어"라는 말이 서로에게 다른 굵기를 뜻한다. 이 기능이 없으면 레시피를 공유해도 **가장 중요한 변수 하나가 통째로 전달되지 않는다.**

다만 버(burr) 형상과 입도 분포가 그라인더마다 달라 **정확한 등가 변환은 물리적으로 불가능하다.** 그래서 이 기능의 목표는 "정답"이 아니라 **"시작점"** 을 주는 것이다. 사용자가 이 값을 확정값으로 오해하면 오히려 해롭기 때문에, 추정치임을 알리는 것이 계산 자체만큼 중요하다.

## 용어

| 용어 | 정의 |
|---|---|
| 설정값(setting) | 그라인더의 클릭 수 또는 눈금. 단위는 그라인더마다 다르다 |
| 클릭당 마이크론(micronsPerClick) | 클릭 1칸이 바꾸는 입자 크기(µm). 무단계 그라인더는 알 수 없어 `null` |
| 영점(zeroPointOffsetClicks) | 버가 맞닿는 지점의 클릭 값. 대부분 0 |
| 하한(effective minimum) | `max(min_setting, zeroPointOffsetClicks)`. 실제로 입력 가능한 최솟값 |
| 추정치(estimated) | 이 기능의 모든 환산 결과. 항상 `true` |

## 데이터

스키마 변경 없음. 기존 `grinder_models`의 아래 컬럼을 읽는다.

| 컬럼 | 타입 | Null | 이 스펙에서의 역할 |
|---|---|---|---|
| `microns_per_click` | `NUMERIC(6,2)` | O | null이면 환산 불가 |
| `zero_point_offset_clicks` | `NUMERIC(6,2)` | X | 하한 계산과 마이크론 계산에 사용 |
| `min_setting` | `NUMERIC(6,2)` | O | 범위 하한 후보 |
| `max_setting` | `NUMERIC(6,2)` | O | 범위 상한 |

> **구현 제약:** 범위 검증도 단위 테스트로 검증하므로, `min_setting`·`max_setting`이 순수 계산 도메인(`grind`)에서 접근 가능해야 한다. `GrindSpec`이 이 값들을 함께 갖도록 한다.

### 계산식

```
micron         = (setting - zeroPointOffsetClicks) × micronsPerClick
targetSetting  = micron ÷ target.micronsPerClick + target.zeroPointOffsetClicks
```

나눗셈은 중간 정밀도 6자리로 계산한 뒤 최종 스케일로 반올림한다.

| 값 | 스케일 | 모드 |
|---|---|---|
| `micron` | 0 | HALF_UP |
| `targetSetting` | 1 | HALF_UP |
| 입력 `sourceSetting` | 2까지 허용 | — |

### 시드 그라인더 (AC에서 사용)

| 그라인더 | micronsPerClick | zeroPoint | min | max |
|---|---|---|---|---|
| Comandante C40 MK4 | 30 | 0 | 0 | 50 |
| 1Zpresso K-Plus | 22 | 0 | 0 | 90 |
| Wilfa Uniform | `null` | 0 | 0 | 0 |

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/v1/gear/grind-conversions` | 필요 | 그라인더 간 분쇄도 환산 |

**검증 순서:** `404`(그라인더 없음) → `422`(환산 불가) → `400`(범위 밖).
환산 자체가 불가능하면 설정값의 유효성을 논할 의미가 없기 때문이다.

### 요청

```json
{
  "sourceGrinderModelId": 1,
  "sourceSetting": 22,
  "targetGrinderModelId": 2
}
```

### 응답 (200)

```json
{
  "sourceSetting": 22,
  "micron": 660,
  "targetSetting": 30.0,
  "targetOutOfRange": false,
  "estimated": true,
  "warning": "버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 시작점으로만 사용하세요."
}
```

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-GRIND-01 · 설정값을 마이크론으로 환산한다

- **Given** 클릭당 30µm, 영점 0인 그라인더
- **When** 설정값 `22`로 마이크론을 계산하면
- **Then** 결과는 정확히 `660`이다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-02 · 영점 보정만큼 빼고 계산한다

- **Given** 클릭당 30µm, 영점 `3`인 그라인더
- **When** 설정값 `10`으로 마이크론을 계산하면
- **Then** 결과는 `(10 − 3) × 30 = 210`이다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-03 · 마이크론은 소수점 없이 반올림한다

- **Given** 클릭당 `22.5`µm, 영점 0인 그라인더
- **When** 설정값 `7`로 마이크론을 계산하면
- **Then** `157.5`가 HALF_UP으로 반올림되어 `158`이다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-04 · 그라인더 간 설정값을 환산한다

- **Given** 원본 C40(30µm/click), 대상 K-Plus(22µm/click)
- **When** C40 설정값 `22`로 환산하면
- **Then** `micron`은 `660`, `targetSetting`은 `30.0`이다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-05 · 대상 설정값은 소수 첫째 자리까지 반올림한다

- **Given** 원본 C40, 대상 K-Plus
- **When** C40 설정값 `30`(= 900µm)으로 환산하면
- **Then** `900 ÷ 22 = 40.909...`가 HALF_UP으로 반올림되어 `40.9`다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-06 · 같은 그라인더끼리는 설정값이 보존된다

- **Given** 원본과 대상이 모두 C40
- **When** 설정값 `22`로 환산하면
- **Then** `targetSetting`은 `22.0`이다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-07 · 환산 결과는 언제나 추정치로 표시된다

- **Given** 환산 가능한 원본·대상 그라인더
- **When** 환산에 성공하면
- **Then** `estimated`는 `true`이고 `warning`은 빈 문자열이 아니다
- **검증** 단위 테스트 `GrindConverterTest`, API 테스트 `GearControllerTest`

### 경계값

#### AC-GRIND-10 · 하한값 자체는 허용한다

- **Given** C40(`min_setting` = 0, 영점 0), 대상 K-Plus
- **When** 설정값 `0`으로 환산하면
- **Then** HTTP `200`, `micron`은 `0`, `targetSetting`은 `0.0`이다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-11 · 상한값 자체는 허용한다

- **Given** C40(`max_setting` = 50), 대상 K-Plus
- **When** 설정값 `50`으로 환산하면
- **Then** HTTP `200`, `micron`은 `1500`, `targetSetting`은 `68.2`다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-12 · 상한을 넘으면 거부한다

- **Given** C40(`max_setting` = 50)
- **When** 설정값 `51`로 환산을 요청하면
- **Then** HTTP `400`과 `code: "GRIND_SETTING_OUT_OF_RANGE"`를 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-13 · 하한 아래는 거부한다

- **Given** C40(`min_setting` = 0, 영점 0)
- **When** 설정값 `-1`로 환산을 요청하면
- **Then** HTTP `400`과 `code: "GRIND_SETTING_OUT_OF_RANGE"`를 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-14 · 영점이 min_setting보다 크면 영점이 하한이 된다

- **Given** `min_setting`이 `0`이지만 영점이 `3`인 그라인더
- **When** 설정값 `2`로 환산을 요청하면
- **Then** 하한은 `max(0, 3) = 3`이므로 HTTP `400`과 `code: "GRIND_SETTING_OUT_OF_RANGE"`를 반환한다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-15 · min·max가 null이면 범위를 검증하지 않는다

- **Given** `min_setting`과 `max_setting`이 모두 `null`이고 클릭당 30µm인 그라인더
- **When** 설정값 `999`로 환산하면
- **Then** 범위 검증 없이 `micron`이 `29970`으로 계산된다
- **검증** 단위 테스트 `GrindConverterTest`

#### AC-GRIND-16 · max_setting이 0이면 범위를 검증하지 않는다

- **Given** `min_setting` `0`, `max_setting` `0`, 클릭당 30µm인 그라인더
- **When** 설정값 `20`으로 환산하면
- **Then** 범위 검증 없이 `micron`이 `600`으로 계산된다
- **검증** 단위 테스트 `GrindConverterTest`

### 결과 범위 초과

#### AC-GRIND-20 · 결과가 대상 범위를 넘으면 플래그를 세우고 값은 돌려준다

- **Given** 원본 K-Plus(설정 `90` = 1980µm), 대상 C40(`max_setting` = 50)
- **When** 환산하면
- **Then** HTTP `200`, `targetSetting`은 `66.0`, `targetOutOfRange`는 `true`다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-21 · 결과가 대상 범위 안이면 플래그가 내려간다

- **Given** 원본 C40(설정 `22`), 대상 K-Plus(`max_setting` = 90)
- **When** 환산하면
- **Then** `targetSetting`은 `30.0`, `targetOutOfRange`는 `false`다
- **검증** API 테스트 `GearControllerTest`

### 에러

#### AC-GRIND-30 · 원본이 환산 불가면 422

- **Given** 원본 Wilfa Uniform(`microns_per_click` = null), 대상 C40
- **When** 환산을 요청하면
- **Then** HTTP `422`와 `code: "GRIND_NOT_CONVERTIBLE"`을 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-31 · 대상이 환산 불가면 422

- **Given** 원본 C40, 대상 Wilfa Uniform(`microns_per_click` = null)
- **When** 환산을 요청하면
- **Then** HTTP `422`와 `code: "GRIND_NOT_CONVERTIBLE"`을 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-32 · 존재하지 않는 그라인더면 404

- **Given** DB에 없는 `grinderModelId` `999999`
- **When** 환산을 요청하면
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-33 · 인증 없이 호출하면 401

- **Given** `Authorization` 헤더가 없는 요청
- **When** 환산을 요청하면
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `GearControllerTest`

#### AC-GRIND-34 · 필수 필드가 없으면 400

- **Given** `sourceSetting`이 빠진 요청 본문
- **When** 환산을 요청하면
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환하고 `fieldErrors`에 `sourceSetting`이 포함된다
- **검증** API 테스트 `GearControllerTest`

---

## 수동 확인

- [x] Swagger UI에서 `warning` 문구가 그대로 노출되는지 확인한다 (프론트가 이 문구를 반드시 보여줘야 한다)

> **2026-09-03 확인.** 로컬 백엔드에 `POST /api/v1/gear/grind-conversions`를 실제로 호출해 응답 본문을 대조했다(C40 MK4 22클릭 → K-Plus).
>
> `warning`이 스펙 본문의 리터럴과 **한 글자도 다르지 않다** — `"버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 시작점으로만 사용하세요."` `estimated`는 `true`, `micron`은 `660`으로 `AC-GRIND-01`과 일치한다.
>
> **다만 OpenAPI 스키마에는 필드 설명이 하나도 없다.** `GrindConversionResponse`의 6개 필드 전부 `description`이 비어 있어, Swagger UI만 보는 사람은 `warning`이 무엇인지 알 수 없다. 응답 본문에는 문구가 실려 오므로 이 조건 자체는 충족하나, **「추정치임을 반드시 보여준다」가 스키마 문서에는 안 걸려 있다**는 뜻이다. 열어둔 결정에 남긴다.

## 열어둔 결정

- **개인 보정값 반영**: `user_grinders` 등록 API가 생기는 시점에 별도 스펙으로 다룬다
- **`micronsPerClick`이 확인되지 않은 시드 그라인더**: 현재 8종이 `null`이라 환산이 거부된다. 제조사 자료로 확인되는 대로 마이그레이션으로 채운다. **추측값은 넣지 않는다**
