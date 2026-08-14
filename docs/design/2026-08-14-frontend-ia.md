# kaldi note — 정보구조(IA) & 사용자 플로우

> **상태: 진행 중.** 백엔드 Plan 2~3과 병렬로 진행하는 UX 설계 트랙이다. AC를 갖지 않으므로 `docs/specs/`가 아니라 여기 `docs/design/`에 둔다.
>
> 이 문서는 **화면 목록·흐름·도메인 규칙 반영 지점**을 텍스트로 고정한다. 화면별 상세 레이아웃은 Pencil로 그리고 [`docs/design/wireframes/`](wireframes/)에 `.pen` 파일로 저장한 뒤 이 문서에서 링크한다. `.pen`은 바이너리라 git diff 리뷰가 안 되므로, **레이아웃 결정의 이유는 항상 이 문서(마크다운)에 먼저 적는다.**

## 참고 문서

- 라우트 스켈레톤: [`../../frontend/CLAUDE.md`](../../frontend/CLAUDE.md) 프로젝트 구조 섹션
- 데이터 모델: [`2026-08-14-architecture.md`](2026-08-14-architecture.md) — 레시피/브루잉 로그/장비 테이블
- 분쇄도 환산: [`../specs/2026-08-14-grind-conversion.md`](../specs/2026-08-14-grind-conversion.md)
- 추출 수율/SCA: `docs/specs/2026-08-14-extraction-analysis.md`

## 지켜야 할 도메인 규칙 (모든 화면 공통)

`frontend/CLAUDE.md`의 "UI에서 지켜야 할 도메인 규칙" 6가지를 IA 단계에서부터 화면 배치에 반영한다. 아래 각 플로우 절에서 해당 규칙 번호를 인용한다.

1. 분쇄도 환산값 옆에는 항상 "추정치" 배지 + 경고 문구
2. TDS 입력은 선택 — 비우면 추출 수율/SCA 차트 영역을 숨김
3. 레시피(설계도) 화면과 브루잉 로그(기록) 화면은 명확히 구분
4. 포크 시 원본 대비 diff 표시
5. 푸어 스텝은 순서 변경·삽입·삭제 가능 — 텍스트 입력 대체 금지
6. 로스팅 경과일은 계산해서 표시, 사용자 직접 입력 금지

---

## 사이트맵

```
/                          홈 (최근 브루잉 로그)
/login                     로그인 (카카오/구글)
/auth/callback             OAuth 인가코드 수신

/recipes                   레시피 목록 (내 것 + 공개 + 팔로우)
/recipes/new                레시피 작성
/recipes/[id]                레시피 상세 (오프라인 캐시 대상)
/recipes/[id]/edit           레시피 수정
/recipes/[id]/fork            → 포크 후 /recipes/[newId]/edit 로 이동

/brews                     브루잉 로그 목록
/brews/new                  브루잉 로그 작성 (레시피 선택 또는 즉흥)
/brews/[id]                  브루잉 로그 상세

/beans                     원두 재고 목록
/beans/[id]                  원두 배치 상세

/gear                      내 장비 목록 (그라인더/브루어/필터)
/gear/grind-converter        분쇄도 환산기
```

---

## 핵심 플로우

### F1. 로그인

`/login` → OAuth 제공자 리다이렉트 → `/auth/callback` → 토큰 발급 → `/`

- 신규 가입/기존 로그인 분기가 화면에 노출되지 않는다(백엔드가 처리). 로딩 상태만 명확히 보여주면 됨.
- 와이어프레임: 우선순위 낮음 — shadcn 기본 버튼 2개로 충분해 별도 Pencil 불필요.

### F2. 레시피 탐색 → 상세 → 포크

`/recipes` (목록, 필터: 내 것/공개/팔로우) → `/recipes/[id]` (상세) → 포크 버튼 → `/recipes/[newId]/edit`

- **상세 화면 최상단에 "레시피"라는 라벨과 설계도 성격을 명시** (규칙 #3). 브루잉 로그 카드와 시각적으로 구분되는 색/아이콘 필요.
- 상세 화면에 분쇄도가 표시될 때, 레시피 작성 시점의 `grind_micron_estimated` 스냅샷을 "추정치" 배지와 함께 노출 (규칙 #1).
- 포크된 레시피 상세에는 원본 대비 변경 파라미터 diff 섹션 필요 (규칙 #4) — `parent_recipe_id`가 있는 경우에만 노출.
- **열린 질문:** diff는 상세 화면에 항상 보이나, 접었다 펼치는 형태인가? → 와이어프레임 단계에서 결정.
- 와이어프레임: **필요** (레시피 상세, diff 섹션)

### F3. 레시피 작성/수정 — 푸어 스텝 에디터

`/recipes/new` 또는 `/recipes/[id]/edit`

- 상단: 파라미터 폼 (dose_g, water_g, water_temp_c, brewer, filter, water_profile, grinder+setting)
- 하단: 푸어 스텝 리스트 에디터
  - 각 스텝: `step_type`(BLOOM/POUR/WAIT/SWIRL/STIR/DRAWDOWN), `start_at_seconds`, `duration_seconds`, `water_g`, `pour_technique`(CENTER/SPIRAL/PULSE/EDGE), `agitation`(NONE/SWIRL/STIR)
  - 순서 변경(드래그 또는 위/아래 버튼), 삽입, 삭제 — **자유 텍스트로 대체 불가** (규칙 #5)
  - `cumulative_water_g`는 파생 표시 (입력 아님)
- 분쇄도 입력 시 그라인더 선택 → 설정값 입력 → 환산기 연동 여부는 열린 질문 (F5와 통합할지 별도로 둘지)
- 와이어프레임: **필요, 우선순위 최상위** — 이 서비스의 핵심 기능. `RecipeStepEditor.tsx`에 대응.

### F4. 브루잉 로그 작성

`/brews/new` — 레시피 선택(옵션) 또는 즉흥 입력 → 실측값 폼 → 관능 평가

- **레시피 기반 로그와 즉흥 로그를 시작 시점에 명확히 분기** (규칙 #3). 레시피 선택 시 파라미터 초깃값을 스냅샷으로 채워 넣되, 사용자가 실측값으로 수정 가능함을 표시.
- TDS 입력 필드는 선택. 비우면 추출 수율 카드와 SCA 차트 섹션 자체를 렌더링하지 않음 (규칙 #2) — `ScaChart.tsx` 조건부 렌더링.
- `days_off_roast`는 선택한 `bean_batch`의 `roasted_at`과 `brewed_at`(기본값 현재 시각)으로 자동 계산해 읽기 전용 표시 (규칙 #6).
- 와이어프레임: **필요** (TDS 있음/없음 두 가지 상태를 모두 그린다)

### F5. 분쇄도 환산기

`/gear/grind-converter` (독립 화면) — GRIND 스펙 기반

- 원본 그라인더 + 설정값 입력 → 대상 그라인더 선택 → 결과: `micron`, `targetSetting`, `targetOutOfRange` 플래그, **`warning` 문구 그대로 노출 필수** (GRIND 스펙의 수동 확인 항목, 규칙 #1)
- `targetOutOfRange`가 true인 경우 시각적 경고 강조 (색상 등) — AC-GRIND-20과 연결.
- 환산 불가(422)·범위 밖(400)·그라인더 없음(404) 각각의 에러 상태 UI 필요.
- 와이어프레임: **필요** — 도메인 규칙이 가장 촘촘히 얽힌 화면.

### F6. 원두 재고 / 내 장비

`/beans`, `/beans/[id]`, `/gear`

- 상대적으로 표준적인 CRUD 목록/상세. `days_off_roast` 계산 표시(규칙 #6) 외 특이사항 적음.
- 와이어프레임: 우선순위 낮음 — shadcn 테이블/카드 패턴으로 대부분 커버.

---

## 와이어프레임 진행 현황

| 화면 | 우선순위 | Pencil 파일 | 상태 |
|---|---|---|---|
| 레시피 작성 — 푸어 스텝 에디터 (F3) | 최상위 | `wireframes/recipe-step-editor.pen` | 미착수 |
| 분쇄도 환산기 (F5) | 상 | `wireframes/grind-converter.pen` | 미착수 |
| 레시피 상세 + 포크 diff (F2) | 상 | `wireframes/recipe-detail.pen` | 미착수 |
| 브루잉 로그 작성 (F4) | 중 | `wireframes/brew-log-new.pen` | 미착수 |
| 원두/장비 목록 (F6) | 하 | — | shadcn 기본 패턴으로 대체 예정 |
| 로그인 (F1) | 하 | — | shadcn 기본 패턴으로 대체 예정 |

---

## 다음 단계

1. 우선순위 최상위인 **레시피 스텝 에디터**부터 Pencil로 모바일(375px) 와이어프레임 제작
2. 각 와이어프레임 완료 시 이 문서의 진행 현황 표를 갱신하고, 레이아웃 결정 이유를 해당 플로우 절에 追記
3. IA에서 발견되는 "열린 질문"은 Plan 2 스펙 작성 시 함께 확인 (예: 포크 diff의 접힘/펼침 여부)
