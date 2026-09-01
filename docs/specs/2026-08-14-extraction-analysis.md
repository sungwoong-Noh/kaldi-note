---
id: EXT
title: 추출 수율 / SCA 구간 분석
status: 구현완료
plan: docs/plans/2026-08-14-plan1-foundation.md
---

# 추출 수율 / SCA 구간 분석 스펙

> 2026-08-14 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).

## 무엇을

원두량·물량·음료 중량·TDS를 받아 **브루 비율**과 **추출 수율(EY)** 을 계산하고, SCA Brewing Control Chart의 두 축(농도·추출) 구간으로 분류해 진단 문구를 만든다.

**TDS는 없는 것이 기본이다.** 리프랙토미터가 없어도 브루 비율은 항상 계산되고, 앱은 온전히 동작해야 한다.

### 범위 밖 (Non-goals)

1. **HTTP API 노출.** 독립 계산 API를 만들지 않는다. 이 스펙은 순수 계산 도메인의 계약만 정의한다.
2. **BrewLog 응답 필드 형태.** 어떤 이름으로 응답에 실릴지는 Plan 2의 브루잉 로그 스펙이 정한다.
3. **EY를 DB에 저장.** 파생 계산 필드다. 저장하면 원본 측정값과 어긋날 수 있다.

## 왜

같은 레시피를 여러 번 내렸을 때 "왜 오늘은 더 썼지?"를 감이 아니라 좌표로 판단하려는 것이다. SCA 차트는 이 판단을 두 축으로 분리해준다 — **농도가 문제인지(비율을 조정), 추출이 문제인지(분쇄도·시간·온도를 조정)** 는 해법이 완전히 다르다.

다만 리프랙토미터는 비싸고 우리는 없다. **TDS 없이도 앱이 온전해야 한다**는 것이 이 기능의 전제다. TDS는 있으면 좋은 보너스이지 필수 입력이 아니다.

## 용어

| 용어 | 정의 |
|---|---|
| 브루 비율(brewRatio) | `물량 ÷ 원두량`. 1:16.7의 `16.7` |
| TDS | 총 용존 고형분(%). 리프랙토미터로 측정한 음료의 농도 |
| 추출 수율(EY) | 원두 무게 중 물에 녹아 나온 비율(%) |
| 농도 구간(StrengthZone) | 차트 세로축. `WEAK` / `IDEAL` / `STRONG` |
| 추출 구간(ExtractionZone) | 차트 가로축. `UNDER` / `IDEAL` / `OVER` |

## 데이터

스키마 변경 없음. 순수 계산 도메인이며 DB에 접근하지 않는다.

### 입력 `BrewMeasurement`

| 필드 | 타입 | Null | 설명 |
|---|---|---|---|
| `doseG` | `BigDecimal` | X | 원두량(g) |
| `waterG` | `BigDecimal` | X | 부은 물량(g) |
| `beverageWeightG` | `BigDecimal` | **O** | 최종 음료 중량(g). 안 쟀으면 null |
| `tdsPercent` | `BigDecimal` | **O** | 측정 TDS(%). **없는 것이 기본** |

### 출력 `ExtractionAnalysis`

| 필드 | 타입 | Null | 설명 |
|---|---|---|---|
| `brewRatio` | `BigDecimal` | X | 항상 계산된다 |
| `extractionYieldPercent` | `BigDecimal` | O | TDS나 음료 중량이 없으면 null |
| `strengthZone` | `StrengthZone` | O | EY가 null이면 null |
| `extractionZone` | `ExtractionZone` | O | EY가 null이면 null |
| `diagnosis` | `String` | X | 항상 채워진다 |

### 계산식

```
brewRatio = waterG ÷ doseG
EY(%)     = (beverageWeightG × tdsPercent) ÷ doseG
```

나눗셈은 중간 정밀도 6자리로 계산한 뒤 최종 스케일로 반올림한다.

| 값 | 스케일 | 모드 |
|---|---|---|
| `brewRatio` | 1 | HALF_UP |
| `extractionYieldPercent` | 1 | HALF_UP |

> **구간 분류와 물리 한계 판정은 모두 반올림된 EY 값을 기준으로 한다.** 원값이 아니다.

### SCA 기준값

| 축 | 이상 구간 | 경계 |
|---|---|---|
| 농도(TDS) | `1.15` ~ `1.35` % | **양쪽 포함** |
| 추출 수율(EY) | `18.0` ~ `22.0` % | **양쪽 포함** |

### 진단 문구

| 상황 | 문구 |
|---|---|
| TDS 없음 | `TDS 측정값이 없어 추출 수율을 계산할 수 없습니다. 비율과 관능 평가로 판단하세요.` |
| TDS는 있고 음료 중량만 없음 | `음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.` |
| 두 구간 모두 IDEAL | `이상적인 구간입니다. 이 레시피를 기준으로 삼으세요.` |
| 추출 UNDER | `추출이 부족합니다. 분쇄를 곱게 하거나 물 온도를 올리거나 추출 시간을 늘려보세요.` |
| 추출 OVER | `과다추출입니다. 분쇄를 굵게 하거나 물 온도를 낮추거나 추출 시간을 줄여보세요.` |
| 농도 WEAK | `농도가 옅습니다. 물을 줄여 비율을 진하게 조정해보세요.` |
| 농도 STRONG | `농도가 진합니다. 물을 늘려 비율을 옅게 조정해보세요.` |

추출 진단이 먼저 오고, 농도 진단을 공백 하나로 이어 붙인다. 둘 다 IDEAL이면 한 문장만 낸다.

### 입력 검증

위반하면 **`InvalidBrewMeasurementException`** 을 던진다. `ErrorCode.INVALID_BREW_MEASUREMENT`(HTTP 400)을 예약해두되, HTTP 매핑은 브루잉 로그 스펙에서 연결한다.

| 규칙 | 비고 |
|---|---|
| `doseG > 0` | |
| `waterG > 0` | |
| `beverageWeightG > 0` | null은 정상 |
| `0 < tdsPercent < 100` | null은 정상 |
| `beverageWeightG ≤ waterG` | **같은 값은 허용.** 원두가 물을 머금으므로 음료가 물보다 많을 수 없다 |
| `EY ≤ 30.0` | 로스팅 원두는 약 28~30%만 수용성이다. 초과하면 측정값 오입력이다 |

> `IllegalArgumentException`을 쓰지 않는 이유: `GlobalExceptionHandler`에 그 예외를 통째로 잡는 핸들러를 두면 다른 곳의 **진짜 프로그래밍 버그까지 400으로 숨긴다.**

---

## 어떻게 동작 — 인수 조건

모든 조건의 **검증 수단은 단위 테스트 `ExtractionAnalyzerTest`** 다. 이 도메인은 DB·프레임워크에 의존하지 않는다.

### 정상 동작

#### AC-EXT-01 · 브루 비율은 물량을 원두량으로 나눈 값이다

- **Given** 원두 `15`g, 물 `250`g
- **When** 분석하면
- **Then** `brewRatio`는 `16.7`이다 (250 ÷ 15 = 16.666… → HALF_UP)

#### AC-EXT-02 · TDS가 없어도 비율은 항상 계산된다

- **Given** 원두 `20`g, 물 `300`g, 음료 중량 null, TDS null
- **When** 분석하면
- **Then** `brewRatio`는 `15.0`이고 `measured()`는 `false`다

#### AC-EXT-03 · 음료 중량과 TDS로 수율을 계산한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `250`g, TDS `1.35`
- **When** 분석하면
- **Then** `extractionYieldPercent`는 `22.5`이고 `measured()`는 `true`다

#### AC-EXT-04 · 두 축이 모두 이상 구간이면 IDEAL로 분류된다

- **Given** 원두 `15`g, 물 `300`g, 음료 `240`g, TDS `1.25`
- **When** 분석하면
- **Then** EY는 `20.0`, `extractionZone`은 `IDEAL`, `strengthZone`도 `IDEAL`이다

#### AC-EXT-05 · TDS가 없으면 수율과 구간이 모두 null이다

- **Given** 원두 `15`g, 물 `250`g, 음료 `240`g, TDS null
- **When** 분석하면
- **Then** `extractionYieldPercent`·`strengthZone`·`extractionZone`이 모두 null이고 `diagnosis`에 `"TDS"`가 포함된다

#### AC-EXT-06 · 음료 중량이 없으면 수율을 계산하지 않는다

- **Given** 원두 `15`g, 물 `250`g, 음료 중량 null, TDS `1.25`
- **When** 분석하면
- **Then** `extractionYieldPercent`가 null이고 `diagnosis`가 `음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.`다

> 2026-09-02 수동 확인 중 정정(사람 승인). 원래 Then은 수율이 null인 것만 요구해 **진단 문구를 규정하지 않았다.** 그래서 구현이 TDS 누락과 음료 중량 누락을 한 문구로 묶어도 통과했고, 실물에서 TDS `1.40`을 넣은 로그가 "TDS 측정값이 없어…"라고 말했다. 없는 것을 정확히 말하도록 문구를 못박는다.

#### AC-EXT-07 · 이상 구간이면 기준으로 삼으라고 안내한다

- **Given** 원두 `15`g, 물 `300`g, 음료 `240`g, TDS `1.25`
- **When** 분석하면
- **Then** `diagnosis`에 `"이상적"`이 포함된다

#### AC-EXT-08 · 추출과 농도가 모두 벗어나면 두 진단을 함께 준다

- **Given** 원두 `15`g, 물 `300`g, 음료 `240`g, TDS `1.45`
- **When** 분석하면
- **Then** EY는 `23.2`, `extractionZone`은 `OVER`, `strengthZone`은 `STRONG`이고, `diagnosis`에 `"굵게"`와 `"물을 늘려"`가 모두 포함된다

### 경계값

아래 조건은 모두 **원두 `15`g, 물 `300`g** 을 전제한다.

#### AC-EXT-10 · 수율 18.0은 이상 구간에 포함된다

- **Given** 음료 `216`g, TDS `1.25`
- **When** 분석하면
- **Then** EY는 `18.0`이고 `extractionZone`은 `IDEAL`이다

#### AC-EXT-11 · 수율 22.0은 이상 구간에 포함된다

- **Given** 음료 `264`g, TDS `1.25`
- **When** 분석하면
- **Then** EY는 `22.0`이고 `extractionZone`은 `IDEAL`이다

#### AC-EXT-12 · 수율 17.9는 과소추출이다

- **Given** 음료 `214.8`g, TDS `1.25`
- **When** 분석하면
- **Then** EY는 `17.9`, `extractionZone`은 `UNDER`이고 `diagnosis`에 `"곱게"`가 포함된다

#### AC-EXT-13 · 수율 22.1은 과다추출이다

- **Given** 음료 `265.2`g, TDS `1.25`
- **When** 분석하면
- **Then** EY는 `22.1`, `extractionZone`은 `OVER`이고 `diagnosis`에 `"굵게"`가 포함된다

#### AC-EXT-14 · TDS 1.15는 이상 구간에 포함된다

- **Given** 음료 `250`g, TDS `1.15`
- **When** 분석하면
- **Then** `strengthZone`은 `IDEAL`이다

#### AC-EXT-15 · TDS 1.35는 이상 구간에 포함된다

- **Given** 음료 `250`g, TDS `1.35`
- **When** 분석하면
- **Then** `strengthZone`은 `IDEAL`이다

#### AC-EXT-16 · TDS 1.14는 농도가 옅다

- **Given** 음료 `250`g, TDS `1.14`
- **When** 분석하면
- **Then** `strengthZone`은 `WEAK`이고 `diagnosis`에 `"물을 줄여"`가 포함된다

#### AC-EXT-17 · TDS 1.36은 농도가 진하다

- **Given** 음료 `250`g, TDS `1.36`
- **When** 분석하면
- **Then** `strengthZone`은 `STRONG`이다

#### AC-EXT-18 · 수율 30.0은 허용된다

- **Given** 음료 `250`g, TDS `1.8`
- **When** 분석하면
- **Then** 예외 없이 EY `30.0`이 계산된다 (물리 한계의 경계는 포함)

#### AC-EXT-19 · 수율이 30.0을 넘으면 거부한다

- **Given** 음료 `251`g, TDS `1.8`
- **When** 분석하면
- **Then** EY가 `30.1`이 되므로 `InvalidBrewMeasurementException`을 던진다

### 에러

모두 `InvalidBrewMeasurementException`을 던진다.

#### AC-EXT-30 · 원두량이 0 이하면 거부한다

- **Given** 원두 `0`g, 물 `250`g
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다

#### AC-EXT-31 · 물량이 0 이하면 거부한다

- **Given** 원두 `15`g, 물 `0`g
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다

#### AC-EXT-32 · 음료 중량이 0 이하면 거부한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `0`g
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다 (null은 정상이지만 0은 아니다)

#### AC-EXT-33 · TDS가 0 이하면 거부한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `240`g, TDS `0`
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다

#### AC-EXT-34 · TDS가 100 이상이면 거부한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `240`g, TDS `100`
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다 (퍼센트값이므로 100 이상은 불가능)

#### AC-EXT-35 · 음료가 물보다 많으면 거부한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `251`g
- **When** 분석하면
- **Then** `InvalidBrewMeasurementException`을 던진다

#### AC-EXT-36 · 음료와 물이 같은 것은 허용한다

- **Given** 원두 `15`g, 물 `250`g, 음료 `250`g, TDS `1.25`
- **When** 분석하면
- **Then** 예외 없이 EY `20.8`이 계산된다 (경계 허용)

---

## 수동 확인

없음. 전부 순수 계산이라 자동 검증된다.

## 열어둔 결정

- **입력 TDS의 소수 자릿수 제한**: 현재 제한하지 않는다. 브루잉 로그 스키마를 정할 때 `NUMERIC` 스케일과 함께 확정한다
- **에스프레소 확장 시 TDS 상한**: 현재 100 미만이면 통과한다. 에스프레소(8~12%)를 다루게 되면 방식별 상한을 나눌지 재검토한다

## 참고

- [SCA Brewing Control Chart (공식 PDF)](https://static1.squarespace.com/static/587af1d4db29d69a1a226b95/t/60aece65e4f2134d99f6e646/1622068839009/SCA+Brewing+Chart+-+Revised+March+2019-US-Letter.pdf)
- [Extraction Yield Explained — 로스팅 원두의 수용성 한계 28~30%](https://jayarr.coffee/blog/coffee-extraction-yield-explained/)
