---
id: WEBEDIT
title: 레시피 쓰기 슬라이스 — 생성·편집·삭제와 푸어 스텝 에디터
status: 구현완료
plan: docs/plans/2026-08-30-plan-web-recipe-write.md
---

# 레시피 쓰기 슬라이스 — 생성·편집·삭제와 푸어 스텝 에디터 스펙

> 2026-08-30 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**사용자가 브라우저에서 레시피를 새로 만들고, 자기 레시피를 고치고, 지운다.** 그 중심은 **푸어 스텝 에디터**다 — 스텝을 추가·삽입·삭제하고 순서를 바꾸면 뒤 스텝의 시작 시각이 정해진 규칙대로 따라 움직인다.

화면은 둘이 새로 생기고(`/recipes/new`, `/recipes/[id]/edit`) 둘이 바뀐다(`/recipes` 목록에 "새 레시피"와 "내 레시피만", `/recipes/[id]` 상세에 "편집"·"삭제").

**백엔드는 손대지 않는다.** `POST /api/v1/recipes` · `PUT /api/v1/recipes/{id}` · `DELETE /api/v1/recipes/{id}`가 이미 있고(`docs/specs/2026-08-16-recipe-crud.md`), 값 범위·시퀀스 검증·에러 `code`도 그쪽에 확정돼 있다. 이 스펙이 정하는 것은 **화면의 동작**뿐이다.

### 범위 밖 (Non-goals)

1. **드래그 앤 드롭 순서 변경.** 위·아래 버튼으로 한다. dnd-kit 같은 라이브러리는 번들을 키우고(Workers CPU 10ms 상한이 있다) jsdom에서 포인터 이벤트를 지어내야 해 인수 조건 검증이 까다롭다.
2. **임시저장·자동저장.** 작성 중 내용을 `localStorage`에 보관하지 않는다. 언제 지우고 언제 복원할지, 서버 값과 충돌하면 무엇을 이기는지가 전부 새 결정이 된다.
3. **남은 물량 자동 채우기.** 합계가 모자랄 때 차액을 마지막 붓는 스텝에 넣어주는 버튼을 두지 않는다.
4. **내 레시피 복제.** 포크 API를 내 레시피에 쓸 수 있는지 확인되지 않았고, 이번 슬라이스의 목적(만들고 고치기)에 필요하지 않다.
5. **앱 내 이동을 가로채는 이탈 확인 모달.** Next App Router에 공식 API가 없어 popstate·라우터 패치 같은 편법이 필요하고 버전 업그레이드에 깨진다. `beforeunload`(새로고침·탭 닫기)만 건다.
6. **레시피 사진 첨부.** `POST /attachments/upload-url`이 백엔드에 있으나 이번 화면에서 부르지 않는다.
7. **추출 타이머.** 스텝 시퀀스를 따라 카운트다운하는 기능은 별개 스펙이다.
8. **포크 diff 표시.** 이번에 편집이 생기면서 비로소 의미가 생기지만, diff를 어떻게 보여줄지는 별도 결정이 필요하다.
9. **PWA(`manifest.json`·Service Worker·오프라인 캐시).** 첫 슬라이스에 이어 계속 미룬다.
10. **E2E(Playwright)·스냅샷 테스트.** 첫 슬라이스와 같은 이유다.
11. **브루잉 로그·원두 재고·장비 관리 화면.**

## 왜

**포크를 해도 고칠 수가 없다.** 첫 슬라이스로 로그인·목록·상세·포크가 동작하지만, 포크한 레시피는 원본과 영원히 같은 값으로 남는다. "남의 레시피를 내 장비와 취향에 맞게 고친다"가 포크의 존재 이유인데 그 뒷부분이 없다.

**새 레시피를 만들 수단이 화면에 없다.** 지금 레시피를 만들려면 Swagger UI에서 JSON을 직접 쓰거나 `psql`을 쳐야 한다. 시드 레시피 2건 외에는 아무것도 늘어나지 않는다.

**스텝 에디터를 먼저 세워야 브루잉 로그가 올라간다.** 로그 화면도 레시피 스냅샷을 골라 값을 조정하는 폼이다. 스텝을 다루는 UI가 자리잡기 전에 로그를 만들면 같은 문제를 두 번 푼다.

## 용어

| 용어 | 정의 |
|---|---|
| 붓는 스텝 | `stepType`이 `BLOOM` 또는 `POUR`인 스텝. 물을 추가한다 |
| 점유 구간 | 한 스텝의 `[startAtSeconds, startAtSeconds + durationSeconds]` |
| 밀기(shift) | 편집으로 겹침이 생길 때 뒤 스텝들의 `startAtSeconds`를 일괄로 더하는 것 |
| 당기기(pull) | 삭제로 생긴 공백만큼 뒤 스텝들의 `startAtSeconds`를 일괄로 빼는 것 |
| 미리보기 마이크론 | 저장 전에 화면이 보여주는 분쇄도 환산 추정값. 서버의 스냅샷과 같은 계산이지만 저장되지는 않는다 |

## 화면

| 경로 | 인증 | 하는 일 |
|---|---|---|
| `/recipes/new` | 필요 | 빈 폼에서 레시피를 만든다. 저장하면 `POST /api/v1/recipes` |
| `/recipes/[id]/edit` | 필요 | 서버 값으로 채운 폼을 고친다. 저장하면 `PUT /api/v1/recipes/{id}` |
| `/recipes` (변경) | 필요 | 상단에 "새 레시피" 링크와 "내 레시피만" 토글이 붙는다 |
| `/recipes/[id]` (변경) | 필요 | 소유자에게만 "편집"·"삭제"가 보인다. 포크 성공 시 이동 대상이 상세 → 편집으로 바뀐다 |

## 폼의 라벨과 값

**테스트는 이 문자열로 필드를 찾는다**(`getByLabelText`·`getByRole`). 문구를 바꾸면 인수 조건이 깨진다.

| 라벨 | 필드 | 필수 | 입력 형태 |
|---|---|---|---|
| 제목 | `title` | O | 텍스트 |
| 설명 | `description` | X | 여러 줄 텍스트 |
| 원두량 | `doseG` | O | 숫자, 단위 표기 `g` |
| 물량 | `waterG` | O | 숫자, 단위 표기 `g` |
| 물 온도 | `waterTempC` | X | 숫자, 단위 표기 `°C` |
| 총 시간 | `totalTimeSeconds` | X | 숫자(초), 옆에 `m:ss` 변환 표시 |
| 공개 범위 | `visibility` | O | 선택. `나만 보기`(PRIVATE, 기본) / `맞팔로우만`(FRIENDS) / `전체 공개`(PUBLIC) |
| 드리퍼 | `brewerId` | X | 선택. `GET /gear/brewers` |
| 필터 | `filterId` | X | 선택. `GET /gear/filters` |
| 그라인더 | `grinderModelId` | X | 선택. `GET /gear/grinders` |
| 분쇄도 단위 | `grindSettingUnit` | X | 선택. `클릭`(CLICK) / `숫자`(NUMBER) / `마이크론`(MICRON) |
| 분쇄도 값 | `grindSettingValue` | X | 숫자 |

스텝 행의 라벨과 버튼 접근명 — `N`은 화면에 보이는 스텝 번호(1부터)다.

| 요소 | 접근명 |
|---|---|
| 스텝 타입 선택 | `스텝 N 타입` |
| 시작 시각 | `스텝 N 시작` |
| 소요 시간 | `스텝 N 소요` |
| 물량 | `스텝 N 물량` |
| 위로 이동 | `스텝 N 위로` |
| 아래로 이동 | `스텝 N 아래로` |
| 그 스텝 삭제 | `스텝 N 삭제` |
| 그 스텝 **뒤에** 삽입 | `스텝 N 아래에 추가` |
| 맨 뒤에 추가 | `스텝 추가` |

| 그 밖의 버튼·링크 | 접근명 |
|---|---|
| 저장 | `저장` |
| 새 레시피(목록 상단, 링크) | `새 레시피` |
| 내 레시피만(목록 상단, 토글) | `내 레시피만` |
| 편집(상세, 링크) | `편집` |
| 삭제(상세) | `삭제` |
| 삭제 확인 모달의 확인 | `삭제합니다` |
| 삭제 확인 모달의 취소 | `취소` |

## 스텝 편집 규칙

시각은 **절대 시각**(`startAtSeconds`)으로 입력하고, 편집이 겹침을 만들면 화면이 자동으로 조정한다. **밀기·당기기는 편집한 스텝보다 뒤에 있는 모든 스텝에 같은 양을 더하거나 뺀다.**

| 조작 | 규칙 |
|---|---|
| **맨 뒤에 추가** | 스텝이 없으면 `stepType=BLOOM`, `startAtSeconds=0`. 있으면 `stepType=POUR`, `startAtSeconds`는 **앞 스텝의 종료 시각**. 어느 쪽이든 `durationSeconds=10`, 물량은 빈칸 |
| **중간 삽입** (`스텝 N 아래에 추가`) | 새 스텝의 시작 = N번 스텝의 종료 시각, `durationSeconds=10`. **뒤 스텝은 겹치는 만큼만 민다** — `밀기량 = max(0, 새 스텝 종료 − 원래 다음 스텝 시작)` |
| **삭제** | `당기기량 = 다음 스텝 시작 − 삭제한 스텝 시작`. 뒤 스텝 전부를 그만큼 당긴다. **마지막 스텝을 지우면 당기기량이 없다**(다음 스텝이 없다) |
| **위·아래 이동** | `stepType`·`durationSeconds`·`waterG`·`pourTechnique`·`agitation`·`note`는 스텝을 따라 이동하고, **`startAtSeconds`는 자리에 남는다.** 이동 결과 앞 스텝과 겹치면 삽입과 같은 식으로 뒤를 민다 |

- 첫 스텝의 `스텝 1 위로`와 마지막 스텝의 `아래로`는 `disabled`다.
- 스텝이 30개면 `스텝 추가`와 모든 `아래에 추가`가 `disabled`다. 백엔드 상한(레시피 CRUD 스펙의 `RECIPE-35`)과 같은 값이다.
- 시작 시각과 총 시간은 **초 단위 정수**로 입력하고, 옆에 `m:ss`로 변환해 보여준다(`90` → `(1:30)`). 변환 표시는 `lib/format.ts`의 `formatDuration`을 쓴다.

## 검증은 서버가 한다

물량 합계·시간 겹침·타입과 물량의 모순은 **백엔드가 400으로 거부한다.** 화면은 같은 판정을 다시 구현하지 않는다 — 규칙이 두 곳에 살면 어긋난다(첫 슬라이스에서 `ratio`를 서버 값 그대로 쓴 것과 같은 이유다).

| 화면이 하는 일 | 화면이 하지 않는 일 |
|---|---|
| 스텝 물량 합계를 `240.0g / 300.0g`으로 **표시**한다 | 합계가 다르다고 저장을 막지 않는다 |
| 모자라면 `60.0g 부족합니다`, 넘치면 `60.0g 초과합니다`를 덧붙인다 | 그 문구를 근거로 요청을 취소하지 않는다 |
| 서버가 돌려준 `message`와 `fieldErrors`를 보여준다 | 자체 문구로 바꿔 쓰지 않는다 |

합계와 부족·초과량은 소수 1자리로 표시한다(`lib/format.ts`의 `formatGrams`).

### 서버 오류 표시

`ApiError.fieldErrors`(`{ field, message }[]`)를 폼 필드에 매핑한다.

| `field` 값 | 붙는 자리 |
|---|---|
| `title`·`doseG`·`waterG`·`waterTempC`·`totalTimeSeconds`·`grindSettingValue` | 같은 이름의 입력칸 아래 |
| `steps[N].waterG` 같은 배열 표기 | 인덱스 `N`을 파싱해 `N+1`번 스텝 행 아래 |
| 그 밖의 매핑되지 않는 `field` | 폼 상단 오류 영역에 `field: message` 형태로 남긴다 (조용히 버리지 않는다) |

`code`별 처리는 첫 슬라이스(`docs/specs/2026-08-21-web-recipe-read.md`「에러 처리」)를 그대로 따른다. **`message` 문자열로 분기하지 않는다.**

## 분쇄도 미리보기

그라인더·단위·값이 **모두** 채워지면 환산을 불러 `약 660 µm (추정치)`를 보여준다.

```
POST /api/v1/gear/grind-conversions
{ "sourceGrinderModelId": 1, "sourceSetting": 22, "targetGrinderModelId": 1 }
                                                   ↑ 같은 그라인더를 넣는다
→ { "sourceSetting": 22, "micron": 660, "targetSetting": 22.0, ... }
                          ↑ 이 값만 쓴다
```

**프론트에서 `micronsPerClick`을 곱해 계산하지 않는다.** `GET /gear/grinders` 응답에 영점 보정(`zeroPointOffsetClicks`)이 없어서, 영점이 0이 아닌 그라인더에서 틀린 값이 나온다(분쇄도 환산 스펙의 `GRIND-02`가 그 경우다). `targetSetting`·`targetOutOfRange`는 같은 그라인더라 의미가 없으므로 읽지 않는다.

| 상황 | 표시 | 저장 |
|---|---|---|
| 환산 성공 | `약 660 µm (추정치)` | 가능 |
| `422`(무단계 그라인더) | `이 그라인더는 환산 정보가 없습니다` | **가능** |
| `400 GRIND_SETTING_OUT_OF_RANGE` | 서버가 준 `message` 그대로 | **가능** |
| 단위가 `마이크론` | 입력값을 그대로 `약 800 µm (추정치)`. **환산 API를 부르지 않는다** | 가능 |
| 셋 중 하나라도 비어 있음 | 아무것도 표시하지 않고 API도 부르지 않는다 | 가능 |

**"추정치"라는 말을 반드시 함께 띄운다.** 「뒤집으면 안 되는 설계 결정」 3번이다 — 버 형상과 입도 분포가 달라 정확한 등가 변환은 물리적으로 불가능하다.

## 첫 슬라이스에서 바뀌는 것

**첫 슬라이스 스펙의 `WEB-24`를 이 스펙의 `AC-WEBEDIT-06`이 대체한다.** 포크 성공 시 이동 대상이 `/recipes/42`(상세)에서 `/recipes/42/edit`(편집)로 바뀐다. "내 것으로 가져와서 고친다"가 한 흐름으로 이어지게 하기 위해서다. `docs/specs/2026-08-21-web-recipe-read.md`의 해당 AC에 정정을 남기고 기존 테스트를 고친다.

그 밖의 기존 AC는 건드리지 않는다.

---

## 어떻게 동작 — 인수 조건

> 프론트 인수 조건은 **Vitest + Testing Library + MSW**로 검증한다. 백엔드를 실제로 호출하지 않는다.
> 조회는 사용자가 보는 것으로 한다 — `getByRole`·`getByText`·`getByLabelText`. `getByTestId`는 최후 수단이다.
> **픽스처는 실행 중인 백엔드의 응답을 떠서 만든다**(`src/test/fixtures.ts`). 지어낸 픽스처는 코드가 아니라 가정을 검증한다.

### 진입과 권한

#### AC-WEBEDIT-01 · 미인증으로 생성 화면에 접근하면 경로를 보존해 로그인으로 보낸다

- **Given** accessToken이 없다
- **When** `/recipes/new`를 연다
- **Then** `/login?next=%2Frecipes%2Fnew`로 이동한다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-02 · 내 레시피 상세에 편집·삭제가 보인다

- **Given** 로그인한 사용자의 id가 `7`이고 상세 응답의 `ownerUserId`가 `7`이다
- **When** `/recipes/1`을 연다
- **Then** 이름이 `편집`인 링크의 `href`가 `/recipes/1/edit`이고, 이름이 `삭제`인 버튼이 있다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEBEDIT-03 · 남의 레시피 상세에는 편집·삭제가 없다

- **Given** 로그인한 사용자의 id가 `7`이고 상세 응답의 `ownerUserId`가 `9`다
- **When** `/recipes/1`을 연다
- **Then** 이름이 `편집`인 링크가 없고 이름이 `삭제`인 버튼도 없다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEBEDIT-04 · 목록 상단에서 생성 화면으로 갈 수 있다

- **Given** 로그인한 사용자가 `/recipes`를 연다
- **When** 화면을 확인한다
- **Then** 이름이 `새 레시피`인 링크의 `href`가 `/recipes/new`다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEBEDIT-05 · "내 레시피만"을 켜면 ownerUserId를 붙여 다시 부른다

- **Given** 로그인한 사용자의 id가 `7`이고 `/recipes`가 열려 있다
- **When** 이름이 `내 레시피만`인 토글을 켠다
- **Then** `GET /api/v1/recipes`가 `ownerUserId=7`·`page=0`·`size=20`을 쿼리로 갖고 다시 호출된다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEBEDIT-06 · 포크에 성공하면 새 레시피의 편집 화면으로 간다

- **Given** `POST /api/v1/recipes/1/fork`가 201과 `{ id: 42, ... }`를 반환한다
- **When** `내 레시피로 가져오기`를 누른다
- **Then** `/recipes/42/edit`로 이동한다 (첫 슬라이스 스펙의 `WEB-24`를 대체한다)
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

### 생성과 저장

#### AC-WEBEDIT-07 · 최소 입력만으로 저장하면 세 필드만 담아 보낸다

- **Given** `/recipes/new`가 열려 있다
- **When** `제목`에 `아침 레시피`, `원두량`에 `15`, `물량`에 `250`을 넣고 `저장`을 누른다
- **Then** `POST /api/v1/recipes` 본문이 `{ "title": "아침 레시피", "doseG": 15, "waterG": 250, "visibility": "PRIVATE", "steps": [] }`이고, 201 응답의 `id`가 `1`이면 `/recipes/1`로 이동한다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-08 · 저장하는 동안 버튼이 잠긴다

- **Given** `/recipes/new`에 최소 입력이 채워져 있고 `POST /api/v1/recipes` 응답이 지연된다
- **When** `저장`을 누른다
- **Then** 응답이 오기 전까지 `저장` 버튼이 `disabled`이고, 그 사이 한 번 더 눌러도 요청이 한 번만 나간다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-09 · 편집 화면이 서버 값으로 채워진다

- **Given** `GET /api/v1/recipes/1`이 `title="Kasuya 4:6"`, `doseG=20.0`, `waterG=300.0`, 스텝 5개를 반환한다
- **When** `/recipes/1/edit`를 연다
- **Then** `제목` 입력칸의 값이 `Kasuya 4:6`, `원두량`이 `20`, `물량`이 `300`이고 스텝 행이 5개다
- **검증** 페이지 테스트 `RecipeEditPage.test.tsx`

#### AC-WEBEDIT-10 · 편집 저장은 PUT으로 스텝 배열을 통째로 보낸다

- **Given** `/recipes/1/edit`에 스텝 5개짜리 레시피가 로드돼 있다
- **When** `스텝 5 삭제`를 누르고 `저장`을 누른다
- **Then** `PUT /api/v1/recipes/1`이 호출되고 본문의 `steps` 배열 길이가 `4`다
- **검증** 페이지 테스트 `RecipeEditPage.test.tsx`

### 스텝 에디터

#### AC-WEBEDIT-11 · 첫 스텝은 BLOOM으로 0초에 시작한다

- **Given** `/recipes/new`에 스텝이 하나도 없다
- **When** `스텝 추가`를 누른다
- **Then** `스텝 1 타입`의 값이 `BLOOM`, `스텝 1 시작`이 `0`, `스텝 1 소요`가 `10`이고 `스텝 1 물량`은 비어 있다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-12 · 두 번째 스텝은 POUR로 앞 스텝 종료 시각에 시작한다

- **Given** 스텝 1이 `BLOOM`·시작 `0`·소요 `10`이다
- **When** `스텝 추가`를 누른다
- **Then** `스텝 2 타입`의 값이 `POUR`이고 `스텝 2 시작`이 `10`이다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-13 · 삽입할 자리가 남으면 뒤 스텝은 움직이지 않는다

- **Given** 스텝 1이 시작 `0`·소요 `10`, 스텝 2가 시작 `45`·소요 `10`이다
- **When** `스텝 1 아래에 추가`를 누른다
- **Then** 새 스텝(2번)의 시작이 `10`·소요가 `10`이고, 밀려난 3번 스텝의 시작은 그대로 `45`다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-14 · 자리가 5초 부족하면 뒤 스텝이 정확히 5초 밀린다

- **Given** 스텝 1이 시작 `0`·소요 `10`, 스텝 2가 시작 `15`·소요 `10`이다
- **When** `스텝 1 아래에 추가`를 누른다
- **Then** 새 스텝(2번)의 시작이 `10`·소요가 `10`이고, 3번 스텝의 시작이 `20`이다 (`15 + max(0, 20 − 15)`)
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-15 · 스텝을 지우면 뒤 스텝이 그 간격만큼 당겨진다

- **Given** 스텝 1이 시작 `0`, 스텝 2가 시작 `45`, 스텝 3이 시작 `90`이다
- **When** `스텝 2 삭제`를 누른다
- **Then** 남은 두 스텝의 시작이 `0`과 `45`다 (당기기량 `90 − 45 = 45`)
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-16 · 마지막 스텝을 지우면 아무것도 움직이지 않는다

- **Given** 스텝 1이 시작 `0`, 스텝 2가 시작 `45`, 스텝 3이 시작 `90`이다
- **When** `스텝 3 삭제`를 누른다
- **Then** 남은 두 스텝의 시작이 `0`과 `45` 그대로다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-17 · 위로 이동하면 소요는 따라가고 시작은 자리에 남는다

- **Given** 스텝 1이 `BLOOM`·시작 `0`·소요 `10`, 스텝 2가 `WAIT`·시작 `20`·소요 `10`, 스텝 3이 `POUR`·시작 `45`·소요 `20`이다
- **When** `스텝 3 위로`를 누른다
- **Then** 2번 자리가 `POUR`·시작 `20`·소요 `20`이 되고, 3번 자리가 `WAIT`·시작 `45`·소요 `10`이 된다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-18 · 이동 결과 겹치면 뒤 스텝을 겹친 만큼 민다

- **Given** 스텝 1이 시작 `0`·소요 `10`, 스텝 2가 `WAIT`·시작 `20`·소요 `10`, 스텝 3이 `POUR`·시작 `25`·소요 `20`이다
- **When** `스텝 3 위로`를 누른다
- **Then** 2번 자리가 `POUR`·시작 `20`·소요 `20`(종료 `40`)이 되고, 3번 자리의 시작이 `40`이다 (`25 + max(0, 40 − 25)`)
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-19 · 첫 스텝의 "위로"와 마지막 스텝의 "아래로"는 눌리지 않는다

- **Given** 스텝이 3개 있다
- **When** 화면을 확인한다
- **Then** `스텝 1 위로`가 `disabled`이고 `스텝 3 아래로`가 `disabled`이며, `스텝 2 위로`는 `disabled`가 아니다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-20 · 스텝이 30개면 더 추가할 수 없다

- **Given** 스텝이 30개 있다
- **When** 화면을 확인한다
- **Then** `스텝 추가`가 `disabled`이고 `스텝 30 아래에 추가`도 `disabled`다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-21 · 초 단위 입력 옆에 m:ss 변환이 보인다

- **Given** 스텝 1의 시작이 `90`이다
- **When** 화면을 확인한다
- **Then** 그 스텝 행에 `(1:30)`이 있다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

### 물량 합계 표시

#### AC-WEBEDIT-22 · 합계가 모자라면 부족량을 보여준다

- **Given** `물량`이 `300`이고 붓는 스텝들의 물량 합이 `240`이다
- **When** 화면을 확인한다
- **Then** `240.0g / 300.0g`과 `60.0g 부족합니다`가 보인다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-23 · 합계가 맞으면 부족·초과 문구가 없다

- **Given** `물량`이 `300`이고 붓는 스텝들의 물량 합이 `300`이다
- **When** 화면을 확인한다
- **Then** `300.0g / 300.0g`이 보이고, `부족합니다`·`초과합니다`를 포함한 문구가 없다
- **검증** 컴포넌트 테스트 `RecipeStepEditor.test.tsx`

#### AC-WEBEDIT-24 · 합계가 달라도 저장은 서버로 나간다

- **Given** `/recipes/new`에 `물량` `300`, 물량 합이 `240`인 스텝들이 있다
- **When** `저장`을 누른다
- **Then** `저장` 버튼이 `disabled`가 아니었고 `POST /api/v1/recipes`가 실제로 호출된다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

### 분쇄도 미리보기

#### AC-WEBEDIT-25 · 셋이 채워지면 같은 그라인더로 환산을 부른다

- **Given** `/recipes/new`가 열려 있고 `GET /gear/grinders`가 id `1`인 Comandante C40 MK4를 반환한다
- **When** `그라인더`에서 그것을 고르고 `분쇄도 단위`를 `클릭`, `분쇄도 값`을 `22`로 넣는다
- **Then** `POST /api/v1/gear/grind-conversions`가 `{ "sourceGrinderModelId": 1, "sourceSetting": 22, "targetGrinderModelId": 1 }`로 호출되고, `micron: 660` 응답 후 화면에 `약 660 µm`이 보인다
- **검증** 컴포넌트 테스트 `GrindSettingField.test.tsx`

#### AC-WEBEDIT-26 · 환산값에는 추정치라는 표기가 함께 붙는다

- **Given** `AC-WEBEDIT-25`와 같은 상태에서 환산이 성공했다
- **When** 화면을 확인한다
- **Then** 마이크론 표시 영역에 `추정치`가 포함돼 있다
- **검증** 컴포넌트 테스트 `GrindSettingField.test.tsx`

#### AC-WEBEDIT-27 · 무단계 그라인더는 안내만 하고 저장을 막지 않는다

- **Given** `POST /api/v1/gear/grind-conversions`가 `422`와 `{ code: "GRIND_NOT_CONVERTIBLE", message: "..." }`를 반환한다
- **When** 그라인더·단위·값을 채운다
- **Then** `이 그라인더는 환산 정보가 없습니다`가 보이고 `저장` 버튼이 `disabled`가 아니다
- **검증** 컴포넌트 테스트 `GrindSettingField.test.tsx`

#### AC-WEBEDIT-28 · 범위 밖 설정값은 서버 문구로 경고하고 저장을 막지 않는다

- **Given** `POST /api/v1/gear/grind-conversions`가 `400`과 `{ code: "GRIND_SETTING_OUT_OF_RANGE", message: "설정값 60는 이 그라인더의 상한 50.00를 넘습니다." }`를 반환한다 (2026-08-30에 실제 백엔드에서 뜬 문구다)
- **When** `분쇄도 값`에 `60`을 넣는다
- **Then** `설정값 60는 이 그라인더의 상한 50.00를 넘습니다.`가 보이고 `저장` 버튼이 `disabled`가 아니다
- **검증** 컴포넌트 테스트 `GrindSettingField.test.tsx`

#### AC-WEBEDIT-29 · 단위가 마이크론이면 환산을 부르지 않는다

- **Given** `/recipes/new`가 열려 있다
- **When** `분쇄도 단위`를 `마이크론`, `분쇄도 값`을 `800`으로 넣는다
- **Then** `POST /api/v1/gear/grind-conversions`가 한 번도 호출되지 않고 화면에 `약 800 µm`과 `추정치`가 보인다
- **검증** 컴포넌트 테스트 `GrindSettingField.test.tsx`

### 서버 오류

#### AC-WEBEDIT-30 · 필드 오류가 해당 입력칸 아래에 붙는다

- **Given** `POST /api/v1/recipes`가 `400`과 `{ code: "INVALID_REQUEST", message: "입력값이 올바르지 않습니다.", fieldErrors: [{ field: "waterG", message: "3000 이하여야 합니다" }] }`를 반환한다
- **When** `저장`을 누른다
- **Then** `물량` 입력칸의 `aria-describedby`가 가리키는 요소에 `3000 이하여야 합니다`가 있다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-31 · 스텝 배열 오류가 그 스텝 행에 붙는다

- **Given** `POST /api/v1/recipes`가 `400`과 `fieldErrors: [{ field: "steps[2].waterG", message: "붓는 스텝은 물량이 0보다 커야 합니다" }]`를 반환한다
- **When** `저장`을 누른다
- **Then** 3번 스텝 행에 `붓는 스텝은 물량이 0보다 커야 합니다`가 있다 (인덱스 `2` → 표시 번호 `3`)
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-32 · 매핑되지 않는 필드 오류는 상단에 남는다

- **Given** `POST /api/v1/recipes`가 `400`과 `fieldErrors: [{ field: "unknownField", message: "알 수 없는 값입니다" }]`를 반환한다
- **When** `저장`을 누른다
- **Then** 화면에 `unknownField: 알 수 없는 값입니다`가 있다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-33 · 시퀀스 오류는 화면을 유지한 채 서버 문구를 보여준다

- **Given** `POST /api/v1/recipes`가 `400`과 `{ code: "RECIPE_STEP_WATER_MISMATCH", message: "스텝 물량 합계가 총 물량과 다릅니다." }`를 반환한다
- **When** `저장`을 누른다
- **Then** 경로가 `/recipes/new` 그대로이고 `스텝 물량 합계가 총 물량과 다릅니다.`가 보이며 `저장` 버튼이 다시 `disabled`가 아니다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

### 삭제

#### AC-WEBEDIT-34 · 삭제를 확인하면 요청 후 목록으로 간다

- **Given** 내 레시피 `/recipes/1`이 열려 있고 `DELETE /api/v1/recipes/1`이 `204`를 반환한다
- **When** `삭제`를 누르고 모달에서 `삭제합니다`를 누른다
- **Then** `DELETE /api/v1/recipes/1`이 호출되고 `/recipes`로 이동한다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEBEDIT-35 · 삭제를 취소하면 아무 요청도 나가지 않는다

- **Given** 내 레시피 `/recipes/1`이 열려 있다
- **When** `삭제`를 누르고 모달에서 `취소`를 누른다
- **Then** `DELETE` 요청이 한 번도 나가지 않고 경로가 `/recipes/1` 그대로다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

### 이탈 경고

#### AC-WEBEDIT-36 · 변경한 뒤에는 새로고침을 경고한다

- **Given** `/recipes/new`가 열려 있다
- **When** `제목`에 `아침 레시피`를 입력한 뒤 `beforeunload` 이벤트를 발생시킨다
- **Then** 그 이벤트의 `defaultPrevented`가 `true`다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

#### AC-WEBEDIT-37 · 아무것도 고치지 않았으면 경고하지 않는다

- **Given** `/recipes/new`가 열렸고 아무 입력도 하지 않았다
- **When** `beforeunload` 이벤트를 발생시킨다
- **Then** 그 이벤트의 `defaultPrevented`가 `false`다
- **검증** 페이지 테스트 `RecipeNewPage.test.tsx`

---

## 수동 확인

- [ ] 폰(모바일 화면 폭)에서 스텝 5개짜리 레시피를 처음부터 만들어 저장한다
- [ ] 젖은 손·장갑 낀 손을 가정하고 `위로`·`아래로`·`삭제` 버튼이 눌리는 크기인지 본다
- [x] 시드 레시피(Kasuya 4:6)를 포크해 편집 화면에서 값을 바꾸고 저장한 뒤, 원본이 그대로인지 상세에서 확인한다
- [ ] 운영(`kaldi-note.today`)에서 생성·편집·삭제가 동작하는지 확인한다

> **2026-09-05 확인.** 4개 중 **1개를 켰다.** 나머지 셋은 폰 실물 조작과 운영 실계정이다.
>
> **✅ 포크본을 고쳐도 원본은 그대로다.** `/recipes/9`(CURATED Kasuya 4:6)의 상세 본문을 포크 전에
> 통째로 떠 두고, 포크본에서 제목과 물 온도(92 → 94)를 바꿔 저장한 뒤 `/recipes/9`를 다시 열어
> **문자열 단위로 대조했다 — 완전히 동일했다.** 포크본만 `확인용 4:6 (94°C) · 94°C`로 바뀌어 있다.
> 「Recipe는 스냅샷이 아니라 별개 행」이라는 설계 결정이 화면에서도 지켜진다.

## 열어둔 결정

- **스텝 행의 접기/펼치기.** 스텝 30개를 한 화면에 다 펼치면 모바일에서 스크롤이 길어진다. 실제로 만들어 본 뒤 필요하면 별도로 정한다.
- **포크 diff 표시.** 이번 슬라이스로 편집이 생겨 원본과 값이 달라질 수 있게 됐다. 어떻게 보여줄지는 다음 슬라이스에서 정한다.
- ~~**미리보기 환산 호출의 디바운스.**~~ **정해짐 (2026-08-30, 구현 중):** `queryKey` 캐시만으로는 부족했다 — 값이 매번 달라 캐시가 듣지 않고 `22`를 치면 `2`·`22` 두 번 요청이 나갔다. **분쇄도 값에 400ms 디바운스**를 건다(`lib/useDebounced.ts`). 그라인더·단위는 선택이라 한 번에 확정되므로 디바운스하지 않는다.
