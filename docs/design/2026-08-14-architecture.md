# kaldi note — 커피 레시피 공유 서비스 설계

> 2026-08-14 인터뷰로 확정. 구현 계획은 `docs/superpowers/plans/` 참조.

## Context

**왜 만드는가.** 커피를 직접 내려 마시며 여자친구와 레시피를 주고받는 경험이 재밌었고, 이걸 애플리케이션으로 만들어 실제로 쓰려고 한다. 종이/메신저로 주고받는 레시피는 (1) 재현이 안 되고 — "그때 몇 클릭이었지?", (2) 그라인더가 서로 달라 분쇄도가 안 통하고, (3) 같은 레시피를 여러 번 내렸을 때 결과가 어떻게 달랐는지 추적이 안 된다.

**무엇을 만드는가.** 푸어오버 레시피를 **재현 가능한 구조(푸어 스텝 시퀀스)**로 저장하고, 실제 추출 기록(BrewLog)을 레시피와 분리해 누적하며, 서로 다른 그라인더 간 분쇄도를 환산해주고, 상대 레시피를 포크해 내 버전으로 발전시킬 수 있는 서비스.

**성공 기준.** 우리 둘이 실제로 매일 쓴다. 그리고 나중에 공개 서비스로 확장할 때 데이터 모델을 갈아엎지 않아도 된다.

**결정 사항 (인터뷰 결과)**
| 항목 | 결정 |
|---|---|
| 범위 | 비공개 MVP(2인) — 단, 공개 확장 가능한 도메인 구조로 설계 |
| 핵심 도메인 | Recipe(설계도) ↔ BrewLog(실행 기록) **분리** |
| 추출 방식 | 푸어오버/핸드드립만. 에스프레소·침지식은 확장 지점만 확보 |
| 공유 모델 | 개인 소유 + 공개범위 플래그(PRIVATE/FRIENDS/PUBLIC) |
| 원두 | 공용 카탈로그(BeanProduct) ↔ 개인 재고(BeanBatch) 분리 |
| 입력 UX | 사후 기록 MVP → 타이머 가이드는 후속(모델은 미리 대응) |
| 장비 데이터 | 시스템 시드 + 사용자 추가 |
| MVP 기능 | 포크, 분쇄도 환산, EY/SCA 차트, 사진 첨부 |
| 관리자 | UI·API는 후속. **역할 컬럼과 JWT role claim은 MVP에 포함** (나중에 넣으면 비쌈) |
| 마스터 데이터 | 사용자 즉시 생성 허용 → 관리자 사후 병합 |
| 후속 | 바리스타 유튜브 레시피 큐레이션 등록 (모델은 MVP부터 대응) |

---

## 도메인 조사 요약 (모델링 근거)

레시피 데이터는 **원두 / 장비 / 추출 / 결과** 4축으로 분리해야 재사용이 된다. 오픈소스 레퍼런스 [Beanconqueror](https://github.com/graphefruit/Beanconqueror)도 동일 구조(Bean ~30필드, Brew ~43필드).

**분쇄도가 최대 난제.** 그라인더마다 클릭당 마이크론이 다르다 — Comandante C40 = **30µm/click**, 1Zpresso K-Plus = **22µm/click**. 커뮤니티 변환식이 존재하나 버(burr) 형상·입도 분포가 달라 **정확한 등가 변환은 불가능**하다는 게 정설이다.
→ `{그라인더 모델 + 원본 설정값 + 파생 마이크론(추정)}` 3종을 함께 저장하고, 환산값은 **항상 "추정치"로 표시**한다. 마이크론만 저장하면 사용자가 입력을 못 하고, 클릭만 저장하면 공유가 안 된다.

**푸어 시퀀스는 반드시 자식 테이블.** 단일 컬럼으로 표현 불가.
- Hoffmann V60: 1:16.7, 60g 블룸 → 대량 푸어 2회 → 스월, 총 3:30
- Kasuya 4:6: 1:15, 92°C, 5회 균등 푸어(앞 40% = 단맛/산미, 뒤 60% = 농도), 스월 없음

**결과 지표는 파생 계산.** SCA Brewing Control Chart 이상 구간 = **TDS 1.15~1.35%, 추출수율(EY) 18~22%**, 필터 권장 비율 1:15~1:18.
`EY(%) = (음료중량_g × TDS%) / 원두량_g` → 저장이 아닌 계산 필드.

**배포 환경 제약.** Oracle Cloud Always Free Ampere A1 한도가 **2026-06-15부로 4 OCPU/24GB → 2 OCPU/12GB로 축소**됐다(무공지, 2026-08-18부터 초과분 종료). 12GB면 Spring Boot + PostgreSQL 컨테이너 구동에는 충분하나, **이 한도를 상한으로 전제**한다.

---

## 기술 스택

**백엔드 — Java 21 (LTS) + Spring Boot 4.1.x + Gradle (Kotlin DSL)**

> **버전 결정 근거 (2026-08-14 확인).** Spring Boot 3.5는 **2026-06-30부로 OSS 지원 종료**됐다. 신규 프로젝트를 EOL 브랜치에서 시작할 수 없으므로 4.1(지원 ~2027-07-31)을 채택한다. Java는 Spring Boot 4의 최소 요구인 21 LTS를 쓴다 — 25 LTS도 가능하나 Lombok·Gradle 등 주변 도구 호환을 확인해야 하므로 취미 프로젝트에서 감수할 이유가 없다.

**Spring Boot 4 함정 3가지 — 구현 시 반드시 대응**
1. **Spring Security 7은 CSRF가 기본 활성.** stateless REST API는 `csrf(CsrfConfigurer::disable)`로 명시적으로 꺼야 한다. 안 끄면 모든 POST/PUT/DELETE가 **403**. Boot 4 마이그레이션 최다 실패 사례.
2. **Jackson 3.** 패키지가 `com.fasterxml.jackson.*` → **`tools.jackson.*`**. 인터넷 예제 대부분이 Jackson 2 기준이라 import가 맞지 않는다. `BigDecimal` 직렬화 기본값도 달라졌으므로 TDS·중량 응답을 테스트로 고정한다.
3. **springdoc-openapi는 3.1.0 이상**이어야 Boot 4를 지원한다.

- Spring Data JPA (QueryDSL은 복잡한 레시피 검색이 실제로 필요해지는 Plan 2에서 도입 — YAGNI)
- **Flyway** — 스키마 + 시드 데이터(그라인더/드리퍼/가공법/품종/플레이버휠/큐레이션 레시피) 모두 마이그레이션으로 관리
- Spring Security 7 + OAuth2 (카카오/구글) + 자체 발급 JWT
  - JWT는 별도 라이브러리(jjwt 등) 없이 `spring-boot-starter-oauth2-resource-server`의 `NimbusJwtEncoder`/`NimbusJwtDecoder`(HS256)로 처리
  - access 30m / refresh 14d, refresh는 DB 저장 + rotation
- springdoc-openapi 3.1.x

**DB: PostgreSQL 17 (VM 내 Docker 컨테이너)**
Oracle Autonomous DB를 쓰지 않는 이유: 로컬/운영 환경 불일치, Oracle 방언 종속, 그리고 **7일 유휴 시 자동 정지 / 90일 미사용 시 삭제** 정책이 취미 프로젝트에 치명적. JSONB로 방식별 가변 파라미터를 확장할 여지도 필요하다.

**테스트: Testcontainers + PostgreSQL.** H2는 쓰지 않는다 — JSONB·방언 차이로 통합 테스트가 거짓 통과한다.

**배포**
- OCI Always Free ARM VM (2 OCPU / 12GB, Ubuntu 24.04, aarch64) — **인스턴스 생성 완료**
- Docker Compose: `app`(Spring Boot arm64) + `postgres:17` + `caddy`(자동 HTTPS)
- JVM: `-XX:MaxRAMPercentage=50` (컨테이너 인식). 로컬이 Apple Silicon이라 arm64 네이티브 빌드가 그대로 통함
- GitHub Actions → GHCR 이미지 푸시 → VM에서 pull & compose up
- 이미지 저장: OCI Object Storage (10GB 무료), Pre-Authenticated Request로 직접 업로드
- 백업: `pg_dump` cron → Object Storage

**프론트 (방향만, 백엔드 완료 후 착수)**
- Next.js App Router + TypeScript + **PWA** (부엌에서 폰으로 쓰는 게 주 사용 환경 → 홈화면 설치·오프라인 캐시)
- Vercel 무료 배포, API는 OCI 백엔드 직접 호출(CORS)
- TanStack Query, Tailwind + shadcn/ui

---

## 데이터 모델

### 계정
- **`users`** — id, email, nickname, profile_image_url, **role(USER/ADMIN)**, created_at
  - `role`은 MVP에 반드시 포함하고 **JWT에 claim으로 싣는다**. 나중에 추가하면 발급된 토큰이 전부 무효화되고 전체 인가 정책을 다시 훑어야 한다. 지금 넣으면 비용 0
- **`user_oauth_accounts`** — user_id, provider(KAKAO/GOOGLE), provider_user_id · UNIQUE(provider, provider_user_id)
- **`refresh_tokens`** — user_id, token_hash, expires_at, revoked_at
- **`follows`** — follower_user_id, followee_user_id · `FRIENDS` 공개범위 = 상호 팔로우로 판정. 2인 서비스지만 이게 가장 작은 확장 가능 구조

### 카탈로그 (공용, 불변 정보)
- **`roasters`** — name, country, website
- **`bean_products`** — roaster_id, name, bean_mix(SINGLE_ORIGIN/BLEND), roast_level(LIGHT~DARK enum), roast_level_agtron(nullable), roast_level_custom(자유 텍스트), decaf, product_url, description, created_by_user_id, verified
  - 배전도는 로스터마다 기준이 달라 **enum + 수치 + 자유 텍스트 3중 표현**이 현실적
- **`bean_origins`** — bean_product_id 1:N. country, region, farm, altitude_min/max, variety_id, process_id, ratio_percent(블렌드 비율)
  - 블렌드를 표현하려면 반드시 1:N. 단일 원산지는 로우 1개
- **`varieties`** — Geisha, Bourbon, Typica, SL28… `is_system` + 사용자 추가 허용 (enum 금지 — 계속 늘어난다)
- **`processes`** — Washed, Natural, Honey(White/Yellow/Red/Black), Anaerobic, Carbonic Maceration, Wet-hulled… category 컬럼으로 그룹핑
- **`flavor_notes`** — SCA Flavor Wheel 기반 **계층 구조**(id, name_ko, name_en, parent_id, level)
- **`bean_product_flavor_notes`** — N:M (로스터 표기 컵노트)

### 개인 재고
- **`bean_batches`** — user_id, bean_product_id, roasted_at, purchased_at, opened_at, weight_g, remaining_g, price, frozen/frozen_at, memo, finished
  - `days_off_roast`는 `brewed_at - roasted_at` 파생 계산

### 장비
- **`grinder_models`** — brand, name, adjustment_type(CLICK/NUMBERED/STEPLESS), **microns_per_click**, **zero_point_offset_clicks**, min_setting, max_setting, burr_type(CONICAL/FLAT), is_system, created_by_user_id
  - 시드: Comandante C40(30µm/click), 1Zpresso K-Plus(22µm/click), JX-Pro, Kingrinder K6, Fellow Ode Gen2, Timemore C2/C3, Baratza Encore 등
- **`user_grinders`** — user_id, grinder_model_id, nickname, calibration_offset_clicks, is_default
- **`brewers`** — name, brand, type(CONE/FLAT_BOTTOM/WAVE/HYBRID), is_system · 시드: V60 01/02, Kalita Wave 155/185, Origami, Orea V3, Chemex
- **`filters`** — name, material(PAPER_BLEACHED/PAPER_NATURAL/ABACA/METAL/CLOTH), shape
- **`water_profiles`** — user_id(nullable = 시스템 프리셋), name, tds_ppm, gh_ppm, kh_ppm, memo

### 레시피 (설계도)
- **`recipes`**
  - owner_user_id (nullable — 시스템 큐레이션은 null)
  - **source_type**: `USER` / `CURATED` ← 바리스타 유튜브 레시피 대응
  - **author_name, source_url, source_note** — 큐레이션 출처 표기 (예: "James Hoffmann", YouTube URL). CURATED면 author_name·source_url 필수
  - title, description, brew_method(`POUR_OVER`; 에스프레소·침지식 확장용 enum)
  - **visibility**: PRIVATE / FRIENDS / PUBLIC
  - **parent_recipe_id** (포크 원본), **fork_root_id** (최상위 원본 — 계보 조회 최적화)
  - 파라미터: dose_g, water_g, water_temp_c, total_time_seconds(목표), brewer_id, filter_id, water_profile_id, bean_product_id(nullable)
  - 분쇄도: grinder_model_id, grind_setting_value, grind_setting_unit(CLICK/NUMBER/MICRON), **grind_micron_estimated**(등록 시점 스냅샷)
  - `ratio`(1:16.7)는 `water_g / dose_g` 파생 — 저장하지 않음
  - created_at, updated_at, deleted_at (소프트 삭제 — 포크 계보가 끊기면 안 됨)
- **`recipe_steps`** — recipe_id 1:N, **푸어 시퀀스의 핵심**
  - step_order, **step_type**(BLOOM/POUR/WAIT/SWIRL/STIR/DRAWDOWN)
  - start_at_seconds(누적 시작 시점), duration_seconds(붓는 시간), water_g(이번 스텝 물량)
  - pour_technique(CENTER/SPIRAL/PULSE/EDGE), agitation(NONE/SWIRL/STIR), note
  - `cumulative_water_g`는 파생 계산. 타이머 기능은 이 테이블을 그대로 소비하면 됨
- **`tags`, `recipe_tags`**

### 브루잉 로그 (실행 기록)
- **`brew_logs`**
  - user_id, recipe_id(nullable — 즉흥 추출 허용), bean_batch_id, brewed_at, visibility
  - **실측 스냅샷** (레시피 값과 다를 수 있고, 레시피가 수정돼도 과거 기록은 불변이어야 함):
    actual_dose_g, actual_water_g, actual_water_temp_c, actual_total_time_seconds, actual_drawdown_seconds,
    user_grinder_id, actual_grind_setting_value, actual_grind_micron_estimated,
    **days_off_roast**(배치 삭제 대비 스냅샷)
  - 결과: beverage_weight_g, tds_percent(nullable)
  - 관능 평가: rating(0.5 단위), acidity/sweetness/body/bitterness/aftertaste (각 1~5), overall_note
  - `extraction_yield_percent`, `sca_zone`은 **파생 계산 — 저장하지 않음**
- **`brew_log_steps`** — 실제 푸어 기록. MVP에서는 선택 입력, 타이머 도입 시 자동 채움
- **`brew_log_flavor_notes`** — 실제로 느낀 컵노트 (N:M)
- **`attachments`** — owner_user_id, target_type(RECIPE/BREW_LOG/BEAN_PRODUCT/BEAN_BATCH), target_id, object_key, content_type, width, height, sort_order

---

## 핵심 도메인 로직 (독립 모듈 3개)

이 셋은 순수 계산이라 DB·프레임워크 의존 없이 단위 테스트 가능해야 한다. **TDD로 먼저 작성한다.**

### 1. `grind` — 분쇄도 환산
```
micron    = (setting_value - zero_point_offset_clicks) × microns_per_click
converted = micron / target.microns_per_click + target.zero_point_offset_clicks
```
- 응답에 **항상 `estimated: true` + 신뢰도 경고**를 포함한다. 버 형상이 다르면 정확한 등가가 성립하지 않음을 UI가 반드시 노출
- `microns_per_click`이 없는 그라인더(STEPLESS 등)는 환산 불가 → 원본 값만 표시

### 2. `extraction` — 추출 수율 & SCA 좌표
```
EY(%) = (beverage_weight_g × tds_percent) / dose_g
```
- 이상 구간: TDS 1.15~1.35%, EY 18~22%
- `sca_zone` 9구획 반환 (농도 WEAK/IDEAL/STRONG × 추출 UNDER/IDEAL/OVER)
- 진단 문구 매핑: 추출 부족 = 분쇄 곱게/시간 늘리기, 과다추출 = 반대, 농도 약함 = 비율 조정
- tds가 null이면 계산 생략 — 리프랙토미터 없는 게 기본값이므로 **없어도 앱이 온전히 동작해야 한다**

### 3. `recipe.fork` — 포크
- 레시피 + 전체 `recipe_steps`를 깊은 복사, `parent_recipe_id` = 원본, `fork_root_id` = 원본의 fork_root_id ?? 원본 id
- 소유자는 포크한 사용자, visibility는 PRIVATE으로 초기화
- 원본이 소프트 삭제돼도 계보 조회는 유지
- 원본 대비 **변경된 파라미터 diff**를 조회하는 유스케이스 포함 (공유의 재미가 여기서 나옴)

### 4. 관리자 — MVP에는 자리만, 기능은 후속

관리자 UI/API는 만들지 않는다. 대신 **나중에 붙일 수 있게 하는 전제 3가지**를 MVP에 확보한다.

| 전제 | 상태 | 없으면 나중에 못 붙이는 이유 |
|---|---|---|
| `users.role` + JWT role claim | **MVP에 포함** | 토큰 재발급 + 전체 인가 정책 재검토 필요 |
| `is_system` / `verified` / `created_by_user_id` | 이미 설계에 있음 | 어떤 로우가 사용자 생성분인지 구분 불가 |
| 마스터 데이터 **FK 정규화** | 이미 설계에 있음 (`bean_origins.variety_id` 등) | 품종을 문자열로 박으면 **병합 자체가 불가능** |

**마스터 데이터 정책 — 즉시 생성 + 사후 병합**
사용자는 품종·가공법·그라인더를 막힘없이 바로 추가한다(`is_system = false`, `created_by_user_id` 기록). 중복("게이샤" / "Geisha")이 쌓이면 관리자가 정리한다.

후속 단계에서 추가할 관리자 API (전부 `@PreAuthorize("hasRole('ADMIN')")`, 조작은 Swagger UI로):
- `POST /admin/varieties/{sourceId}/merge-into/{targetId}` — 참조 로우 재연결 후 source 삭제 (processes, grinder_models 동일 패턴)
- `PATCH /admin/bean-products/{id}/verify` — 사용자 생성 카탈로그 항목 공용 승격
- `POST /admin/recipes` — `source_type = CURATED` 레시피 등록. 유튜브 바리스타 레시피는 여기로 들어온다. 일반 레시피 생성 API에서 CURATED 지정은 **403**
- (공개 전환 시) 신고 처리, 사용자 제재

병합 API는 참조 재연결이 핵심이므로 **트랜잭션 + 통합 테스트 필수**. 자기 자신으로의 병합, 순환 병합을 거부한다.

---

## 패키지 구조

```
com.kaldinote
├── common/          config, security, exception, ApiResponse
├── auth/            OAuth2, JWT, refresh token rotation
├── user/            User, Follow
├── catalog/         Roaster, BeanProduct, BeanOrigin, Variety, Process, FlavorNote
├── inventory/       BeanBatch
├── gear/            GrinderModel, UserGrinder, Brewer, Filter, WaterProfile
├── recipe/          Recipe, RecipeStep, Fork
├── brewlog/         BrewLog, BrewLogStep, Evaluation
├── grind/           분쇄도 환산 (순수 도메인 서비스)
├── extraction/      EY / SCA 계산 (순수 도메인 서비스)
└── media/           Attachment, OCI Object Storage 연동
```

각 도메인 내부: `domain/` (엔티티·VO·도메인서비스) · `application/` (유스케이스·DTO) · `infrastructure/` (JPA·외부연동) · `presentation/` (컨트롤러).
도메인 간 참조는 **애플리케이션 서비스 레벨에서만**. 엔티티 직접 참조 대신 ID 참조를 기본으로 해 경계를 유지한다.

---

## 구현 로드맵 (계획 문서 4개로 분할)

각 계획은 그 자체로 동작하고 테스트 가능한 소프트웨어를 산출한다.

| 계획 | 범위 | 산출물 |
|---|---|---|
| **Plan 1 — Foundation** | 스캐폴딩, `grind`/`extraction` 순수 도메인, 인증(OAuth2+JWT+role), 마스터 데이터+시드 | 로그인되고 마스터 조회·분쇄도 환산이 되는 API |
| **Plan 2 — Core Domain** | 원두 재고, 레시피+스텝, 브루잉 로그(EY/SCA), 포크, 공개범위 인가 | 서비스의 본체. 여기까지면 Swagger로 실사용 가능 |
| **Plan 3 — Media & Deploy** | 사진 첨부(Object Storage), OCI 배포, CI/CD, pg_dump 백업 | 인터넷에서 접속되는 서비스 |
| **Plan 4 — Frontend** | Next.js PWA | 폰에서 쓰는 앱 |

**시드 레시피**로 Hoffmann V60(1:16.7, 60g 블룸→2푸어→스월, 3:30)과 Kasuya 4:6(1:15, 92°C, 5푸어)을 `source_type=CURATED`로 넣는다(Plan 2). MVP 예제 데이터이자 큐레이션 기능의 첫 데이터가 된다.

---

## 검증 방법

**단위 (Plan 1의 `grind`/`extraction` — 가장 중요)**
- 분쇄도: C40 22클릭 → 660µm → K-Plus 30클릭. `microns_per_click`이 null인 그라인더는 환산 거부
- EY: dose 15g / 음료 250g / TDS 1.35% → EY 22.5% → 과다추출. 경계값 18.0 / 22.0 / 1.15 / 1.35 각각 테스트
- 포크: 3단계 포크 체인에서 `fork_root_id`가 모두 최초 원본을 가리키는지

**통합 (Testcontainers + PostgreSQL)**
- 레시피의 dose를 수정해도 기존 BrewLog의 `actual_dose_g`가 변하지 않는지 (스냅샷 불변성)
- PRIVATE 레시피에 타인 접근 시 403, FRIENDS는 상호 팔로우일 때만 200
- BeanBatch 삭제 후에도 BrewLog의 `days_off_roast`가 남는지

**수동 E2E (배포 후)**
1. 카카오 로그인 → 2. 원두 등록(BeanProduct + BeanBatch) → 3. Kasuya 4:6 시드 레시피 포크 → 4. 물량 조정 후 저장 → 5. 브루잉 로그 작성(사진 포함) → 6. 여자친구 계정으로 로그인해 FRIENDS 레시피 조회 → 7. 다른 그라인더 기준 분쇄도 환산값 확인

**배포 환경 확인**: 2 OCPU / 12GB 한도 내에서 `docker stats`로 실사용량 점검. JVM heap이 컨테이너 한도를 인식하는지 (`MaxRAMPercentage`) 확인.

---

## 열어둔 결정

- **프론트 착수 시점**: 백엔드 Plan 3까지 끝낸 뒤. 그전까지는 Swagger UI로 직접 검증
- **에스프레소 확장**: `brew_method` enum과 `recipe_steps.step_type`에 자리만 확보. 실제 머신을 들이면 그때 설계
- **공개 서비스 전환**: `visibility` + `follows`가 이미 있으므로 피드·검색·랭킹만 추가하면 됨. MVP에는 넣지 않는다
- **관리자 화면**: 병합 API를 Swagger로 쓰다가 불편해지는 시점에 만든다. `/admin` 경로를 프론트에 추가하는 순수 확장이라 미룰수록 이득
- **QueryDSL 도입 시점**: Plan 2에서 레시피 검색 조건이 실제로 복잡해질 때

## 참고 자료

- [SCA Brewing Control Chart (공식 PDF)](https://static1.squarespace.com/static/587af1d4db29d69a1a226b95/t/60aece65e4f2134d99f6e646/1622068839009/SCA+Brewing+Chart+-+Revised+March+2019-US-Letter.pdf)
- [Beanconqueror — 오픈소스 레퍼런스 (Apache 2.0)](https://github.com/graphefruit/Beanconqueror)
- [1Zpresso 그라인드 세팅 차트](https://1zpresso.coffee/grind-setting/)
- [Comandante C40 그라인드 차트](https://thebasicbarista.com/en-us/blogs/article/comandante-grind-size-chart)
- [Tetsu Kasuya 4:6 Method](https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/)
- [커피 가공 방식 12가지](https://1zpresso.coffee/the-guide-to-coffee-processing-methods/)
- [Oracle Always Free 리소스 문서](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle 프리티어 A1 한도 축소 (InfoQ, 2026-07)](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/)
- [Spring Boot EOL 현황 (endoflife.date)](https://endoflife.date/spring-boot)
- [Spring Boot 4.0 마이그레이션 가이드](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
- [Jackson 3 in Spring Boot 4](https://spring.io/blog/2025/10/07/introducing-jackson-3-support-in-spring/)
