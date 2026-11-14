# Handoff: kaldi·note 관리자 콘솔 (`/admin`)

## Overview
kaldi·note 운영자(ADMIN 역할)가 쓰는 데스크톱 웹 관리자 화면입니다. 4개 화면 + 403 화면으로 구성됩니다.
- **원두 수집** — 구매처별 크롤 실행, 실행 이력, 실행 상세(건너뛴 상품·매핑하지 못한 원문 = 검수)
- **장비** — 그라인더/드리퍼/필터 목록, 편집, 병합, 사용자 장비 → 시스템 장비 승격
- **그라인더 영점** — 모델 공통값(µm/클릭, 영점 오프셋, 최소/최대) 편집 + 저장 전 환산 미리보기
- **회원** — 역할(USER ↔ ADMIN) 변경
- **403** — 비관리자 접근 시

## About the Design Files
이 폴더의 파일은 **HTML로 만든 디자인 레퍼런스**입니다. 의도한 모양과 동작을 보여 주는 프로토타입이지 그대로 배포할 코드가 아닙니다. 대상 코드베이스의 기존 환경(React/Next 등)과 패턴으로 **다시 구현**하세요. 환경이 없다면 프로젝트에 맞는 프레임워크를 고르면 됩니다.

`design/Admin.dc.html`을 브라우저에서 열면 동작하는 목업이 뜹니다. 상단 칩(「상태 미리보기」)으로 각 화면의 상태(RUNNING, FAILED, 병합 확인, 범위 밖 입력 등)를 바로 전환할 수 있고, 라이트/다크·403 토글이 있습니다. 하단 카드에는 **반응형 규칙**과 **결정이 필요한 질문 12개(추천안 포함)**가 정리돼 있습니다. 구현 전에 반드시 확인하세요.

## Fidelity
**High-fidelity.** 색·타이포·간격·상태가 최종값입니다. 픽셀 단위로 재현하세요. 단, 코드베이스에 이미 kaldi·note 디자인 토큰/컴포넌트가 있다면 그것을 우선 사용하고 아래 값과 매핑하세요.

## 공통 레이아웃 (기준 1440×900)
- **상단 바** 높이 56, padding 0 24, 배경 `--a-paper`, 하단 1px `--a-border`. 좌: 심볼(20px 원, 2px 테두리 + 6px 점) + 워드마크 `kaldi·note` (19px/600, letter-spacing −0.03em, `·`만 `--a-dot`) · 1×18 구분선 · 「관리자」 14/600. 우: 「앱으로 돌아가기」(13px, 밑줄 1px `--a-border-strong`) + 아바타 32px 원.
- **좌측 메뉴** 폭 240, padding 24 14, 그룹 간격 26. 그룹 라벨: IBM Plex Mono 10px, letter-spacing 0.14em, 대문자, `--a-label`. 항목: padding 9 12, radius 7, 14px. 활성 = 배경 `--a-sunken`, `--a-ink`, 600. 우측에 API 상태 태그(Mono 9.5px, `--a-ink3`).
  - 카탈로그: 원두 수집 / 장비 (API 없음) / 그라인더 영점 (API 없음)
  - 운영: 회원 (API 일부)
- **본문** padding 32 40 48, 섹션 간격 26. 페이지 헤더: eyebrow(Mono 10.5px 0.14em 대문자) → 제목 27px/600 −0.03em → 설명 14.5px/1.7 `--a-ink2`, max-width 64ch. API 미구현이면 제목 옆에 점선 태그(Mono 10px, 1px dashed `--a-ink3`, radius 3).
- **우측 상세 패널** 폭 420, 좌측 1px `--a-border`. 헤더 padding 20 24 18, 본문 padding 20 24 32, 닫기 = 밑줄 텍스트.
- **모달** 폭 460, padding 24, radius 12, 간격 16, 스크림 `--a-scrim`. 버튼은 우측 정렬(취소 → 주요).
- **안내 배너**(저장 완료 등): padding 12 16, `--a-sunken`, radius 7, 13.5px.

### 공통 요소
- **카드/표 컨테이너**: `--a-paper`, 1px `--a-border`, radius 10, overflow hidden. 표 헤더 행: padding 10 20, `--a-surface`, Mono 10px 0.1em 대문자 `--a-label`. 행: padding 11–13 20, 상단 1px `--a-divider`, hover `--a-surface`, 선택 `--a-sunken`.
- **주요 버튼**: padding 10 18, radius 7, 14px/500, 배경 `--a-btn`, 글자 `--a-btn-ink`, hover `--a-btn-hover`. 비활성 = `--a-sunken` + `--a-ink3`.
- **보조 버튼**: padding 10 16, `--a-surface`, 1px `--a-border-strong`, `--a-ink`.
- **텍스트 링크 버튼**: 13px `--a-ink2` + 하단 1px `--a-border-strong`.
- **필터 pill**: padding 5–6 11–12, radius 999, 12.5px, 1px `--a-border-strong`. 선택 = `--a-btn` 채움.
- **탭**: 간격 26, 하단 2px 라인(활성 `--a-ink`), 라벨 14.5px(활성 600) + Mono 11px 개수.
- **세그먼트**: 트랙 `--a-sunken` padding 3 radius 8, 옵션 padding 7 0 radius 6 12.5px, 선택 = `--a-paper` + 1px `--a-border-strong`.
- **체크박스** 16px radius 3 / **라디오** 16px 원, 선택 시 테두리·내부 8px `--a-ink`.
- **구분 태그**: 시스템 = `--a-sunken` 채움 / 사용자 = 1px `--a-border-strong` 테두리. 11.5px, radius 3.
- **StatusTag**(`design/StatusTag.dc.html`): Mono 10.5px 0.08em, padding 3 7, radius 3.
  - RUNNING `● RUNNING` — `--a-wash` 배경 + `--a-accent`
  - SUCCEEDED — `--a-sunken` + `--a-ink2`
  - FAILED — `--a-ink` 배경 + `--a-paper` 글자
  - INTERRUPTED — 1px dashed `--a-ink3` + `--a-ink2`
  - 없음 — `—`
- 숫자·ID·시각·코드·URL은 모두 **IBM Plex Mono**, 나머지는 **IBM Plex Sans KR**. 한글은 `word-break: keep-all`.

## Screens

### 1. 원두 수집 (`crawl`)
- **구매처** 카드: 행 grid `150px | 1fr | 210px | 96px`, gap 16, padding 16 20. 이름(14.5/600) + key(Mono 11) · 목록 URL(Mono 12, 말줄임) · 최근 상태 태그 + `시작시각 · 소요 mm:ss` · 「수집」 버튼(전체 폭). 실행 중이면 버튼 자리가 비활성 「수집 중」 + 경과 시간(Mono 10.5, `--a-accent`).
  - 409 시도 시 행 아래 안내: `409 CRAWL_ALREADY_RUNNING — 이 구매처는 이미 수집 중이라 새 실행을 시작하지 않았습니다. 진행 중인 실행 #129를 표시합니다.`
- **실행 이력**: 제목 + `n건 · 최신순`, 우측 구매처 필터 pill(전체/모모스커피/언스페셜티 몰). 표 열 `44 | 108 | 1fr | 108 | 52 | 44 | 44 | 52 | 52` = # · 시작 · 소스 · 상태 · 소요 · 생성 · 갱신 · 건너뜀 · 미매핑. 0건은 `--a-ink3`, 미매핑 40건 이상은 600. RUNNING 행의 집계는 `—`. 하단 페이지네이션 `1–6 / 6`, `← 이전 다음 →`.
  - 빈 상태: 「아직 실행 이력이 없습니다.」 / 「위에서 구매처를 골라 「수집」을 누르면 첫 실행이 여기 쌓입니다.」
- **실행 상세 패널**: eyebrow `Run #128 · momos`, 구매처명 20/600, StatusTag. 시작/종료/소요 3열(Mono 13.5). 히어로 `생성 19`(Mono 36/500, −0.04em) + `갱신 42 · 건너뜀 3 · 미매핑 5`. 상태별 설명 문장(코드 `obs` 참고). FAILED면 `errorMessage` 박스(Mono 12.5). 
  - **건너뛴 상품**: reason 코드별 그룹(USER_OWNED / FETCH_FAILED / PARSE_FAILED + 한글 설명).
  - **매핑하지 못한 원문**: field별 그룹(process 가공법, variety 품종, roastLevel 로스팅, origin 산지), 많은 순 정렬. 원문은 `“…”` 14/600 + `--a-wash` 하이라이트, 아래 상품명 12px. 그룹당 5건까지, 「나머지 n건 보기」로 펼침.

### 2. 장비 (`gear`)
- 탭: 그라인더 / 드리퍼 / 필터 (개수). 구분 pill(전체/시스템/사용자 등록) + `보이는 수 / 전체` + 검색 input(폭 230, 「브랜드·이름 검색」).
- 체크 선택 시 바: `n개 선택` + 힌트 + 「병합」(2개 이상일 때만 활성) + 「선택 해제」.
- 표 열
  - 그라인더 `20 | 1fr | 48 | 64 | 44 | 60 | 60 | 44 | 70` = ☐ · 이름(+브랜드, 2줄 clamp) · 조절(클릭/눈금/무단) · µm/클릭 · 영점 · 범위 · 버(코니컬/플랫) · 환산(가능/불가) · 구분
  - 드리퍼 `20 | 1fr | 140 | 70` = ☐ · 이름 · 형태 · 구분
  - 필터 `20 | 1fr | 110 | 120 | 70` = ☐ · 이름 · 재질 · 모양 · 구분
- 빈 결과: 「‘검색어’와 일치하는 장비가 없습니다.」 + 「검색어 지우기」.
- **편집 패널**: eyebrow `Grinder · #6`, 제목(19/600, 줄바꿈 허용), 구분 태그. 필드 라벨 Mono 10.5 대문자, 텍스트 입력(padding 11 0, 테두리 1px `--a-border-strong` radius 7, 숫자는 Mono + 단위 접미). enum은 세그먼트. 그라인더는 환산 가능/불가 문장. 「사용 현황」(API 없음). 하단 바: 저장 · 취소 · (사용자 장비일 때) 우측 「시스템 장비로」(`--a-accent` 밑줄).
  - 저장 실패: 「저장하지 못했습니다.」 / 「서버가 응답하지 않았습니다 (500). 입력한 값은 그대로 남아 있습니다. 잠시 후 다시 저장해 주세요.」
- **병합 모달**: `Merge · n개` / 「남길 항목을 고르세요」, 라디오 목록(제목 + 스펙 요약 Mono + 시스템/사용자), 설명 「남길 항목 하나를 고르면 나머지 n개는 삭제되고, 그 장비를 쓰던 기록·레시피·내 기구는 남길 항목을 가리키게 됩니다.」, 「이 작업은 되돌릴 수 없습니다.」(600). 시스템 장비 2개 이상이면 차단 안내 + 병합 비활성.
- **승격 모달**: `Promote` / 「{장비}을(를) 시스템 장비로 바꿉니다」 + 영향 설명.

### 3. 그라인더 영점 (`zero`)
- grid `300px | 1fr`, gap 20.
- 좌: 모델 목록(이름 13.5 + 브랜드 11.5, 우측 `30 µm` 또는 `환산 불가`).
- 우 폼 카드(padding 22 24, gap 20): eyebrow `Grinder #1 · 시스템`, 제목 21/600, 환산 가능/불가. 필드 행 grid `140 | 90 | 1fr` = 항목 · 현재값(Mono, `--a-ink3`) · 스테퍼[− | input 84px Mono 우정렬 | 단위 | +] + 메시지.
  - 스테퍼 테두리: 기본 `--a-border-strong`, 변경됨 `--a-accent` + 「변경됨」, 오류 `--a-ink` + 오류문 600.
  - 검증: µm/클릭 1–200(빈 값 허용), 영점 −10~10, 최소 ≥ 0, 최대 > 최소. 증감 단위 µm·영점 0.5, 최소·최대 1.
- **저장 전 미리보기** 표(10/20/30 클릭): 현재 추정 · 새 추정 · 차이(`+n`/`−n`/`±0`). 식 `추정 µm = (클릭 − 영점) × µm/클릭` (서버 식 확인 필요 — 질문 9).
- 하단: 저장(변경 있고 오류 없을 때만) · 되돌리기 · 힌트. 저장 → 확인 모달(「모든 사용자에게 적용」, 변경 목록 `이전 → 새 값`).
- **변경 이력** 카드(API 없음): 시각 · 누가 · 항목 · 변경. 없으면 「이 모델은 아직 바뀐 적이 없습니다.」

### 4. 회원 (`members`)
- 표 열 `1.2fr | 1.4fr | 100 | 120 | 110` = 회원(아바타 34 + 닉네임, 본인은 「나」) · 이메일(Mono, 없으면 「없음」 흐리게) · 역할 태그(ADMIN = 1px `--a-ink` 테두리 / USER = `--a-sunken`) · 가입일 · 「역할 변경」 버튼.
- 표 아래: 「정지·탈퇴 처리는 이 화면에서 하지 않습니다.」
- 역할 변경 모달: `USER → ADMIN` / 「{닉} 님의 역할을 ADMIN로 바꿉니다」. 본인 ADMIN 해제 시도는 차단 모달(「본인의 ADMIN 권한은 해제할 수 없습니다」, 확인 버튼만).

### 5. 403
- 상단 바만(관리자 라벨 없음). 가운데 폭 440: `403 · /admin`(Mono 11) → 「관리자 권한이 있는 계정만 볼 수 있는 화면입니다.」 28/600 → 역할 설명 → 「앱으로 돌아가기」.

## Interactions & Behavior
- 「수집」 → 즉시 RUNNING 실행 행 추가 + 상세 패널 열림. 3초 폴링(탭 숨김 시 중지, RUNNING 아니면 종료). 같은 구매처 실행 중이면 409 → 새 실행 대신 진행 중 실행 표시.
- 이력 행 클릭 → 우측 패널 열림/교체. 장비 행 클릭 → 편집 패널. 체크박스 클릭은 행 클릭과 분리(stopPropagation).
- 저장/병합/승격/역할 변경 성공 시 본문 상단 안내 배너로 결과 문장 표시.
- 모든 파괴적 작업은 확인 모달을 거칩니다. 애니메이션은 없습니다(즉시 전환).
- 반응형: `design/Admin.dc.html` 하단 「1280px 미만 동작」 표 참고(960 미만은 데스크톱 안내만).

## State (목업 기준)
- `page`, `theme`
- 수집: `selRun`, `panel`, `srcFilter`, 실행 중 `sim`, `expanded`(그룹 펼침)
- 장비: `gearTab`, `gearOrigin`, `q`, `sel[]`, `activeId`, `draft`, `saveFail`, `modal`, `keeper`
- 영점: `zeroId`, `zdraft`, 이력
- 회원: `users`, `roleTarget`
- API: `POST /admin/crawl/{source}`, 실행 목록/상세 조회는 있음. 장비·영점·변경 이력·사용 현황은 **API 없음**, 회원은 **일부**. 목업 데이터 구조는 `Admin.dc.html` 스크립트의 `RUNS`, `GRINDERS`, `DRIPPERS`, `FILTERS`, `USERS` 참고.

## Design Tokens
관리자 화면 전용 토큰(`--a-*`)은 `Admin.dc.html`의 `<style>`에 `[data-theme="light"]` / `[data-theme="dark"]`로 정의돼 있습니다. 앱 전역 토큰은 `styles.css` → `tokens/*.css`.

| 토큰 | Light | Dark |
|---|---|---|
| --a-canvas | oklch(0.96 0.006 82) | oklch(0.17 0.008 60) |
| --a-paper | oklch(0.99 0.004 85) | oklch(0.21 0.009 60) |
| --a-surface | oklch(0.97 0.006 85) | oklch(0.21 0.009 60) |
| --a-sunken | oklch(0.93 0.008 80) | oklch(0.17 0.008 60) |
| --a-border | oklch(0.88 0.008 75) | oklch(0.29 0.01 60) |
| --a-border-strong | oklch(0.85 0.008 75) | oklch(0.3 0.01 60) |
| --a-divider | oklch(0.92 0.008 78) | oklch(0.28 0.01 60) |
| --a-ink | oklch(0.22 0.015 60) | oklch(0.95 0.005 85) |
| --a-ink2 | oklch(0.38 0.015 60) | oklch(0.82 0.01 78) |
| --a-ink3 | oklch(0.55 0.02 70) | oklch(0.68 0.01 70) |
| --a-label | oklch(0.58 0.02 70) | oklch(0.68 0.01 70) |
| --a-accent | oklch(0.42 0.06 45) | oklch(0.72 0.07 55) |
| --a-wash | oklch(0.95 0.02 50) | oklch(0.72 0.07 55 / 0.14) |
| --a-btn / -hover / -ink | 0.22 / 0.15 / 0.97 | 0.95 / 0.88 / 0.17 |
| --a-avatar / -ink | oklch(0.88 0.02 60) / oklch(0.35 0.04 50) | oklch(0.29 0.01 60) / oklch(0.88 0.03 70) |
| --a-scrim | oklch(0.22 0.015 60 / 0.28) | oklch(0.1 0.005 60 / 0.5) |

- 반경: 3(태그) · 6(작은 버튼) · 7(버튼·입력) · 8(세그먼트·미리보기) · 10(카드) · 12(모달) · 999(pill·아바타)
- 그림자 없음. 위계는 테두리와 면 색으로만.
- 타입 스케일: 27 페이지 제목 · 21/20/19 패널·모달 제목 · 16 섹션 · 14.5 본문 · 13.5/13 보조 · 12.5 칩 · 10–11 Mono 라벨. Mono 히어로 36.

## Assets
- 로고: 목업에서는 심볼을 CSS 원으로 그렸습니다. 실제 구현은 디자인 시스템 `assets/`의 `logo-symbol*.svg` / `logo-lockup-*.svg`를 쓰세요.
- 폰트: IBM Plex Sans KR, IBM Plex Mono (`tokens/fonts.css`).
- 아이콘 없음(텍스트 버튼만).

## Files
- `design/Admin.dc.html` — 전체 목업(화면·상태·데이터·반응형·질문)
- `design/StatusTag.dc.html` — 실행 상태 태그
- `design/support.js`, `design/ds-base.js` — 목업 런타임(구현 대상 아님)
- `styles.css`, `tokens/` — 전역 디자인 토큰·폰트
- `design-system-readme.md` — kaldi·note 디자인 시스템 가이드(톤, 카피 규칙, 시각 원칙)
