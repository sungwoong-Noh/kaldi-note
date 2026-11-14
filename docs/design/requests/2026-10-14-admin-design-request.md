# Claude Design 요청문 — 관리자 화면

작성: 2026-10-14 · 결과물 저장: `docs/design/kaldi-note-design/screens/09 Admin.dc.html`
첨부: `docs/README.md` · `docs/DECISIONS.md` · `system/Design System.dc.html` · `system/Navigation.dc.html` ·
참고 목업 `screens/02 Recipes and Cups - Web.dc.html`(표·pill·원장 행) · `screens/06 Gear.dc.html`(그라인더 목록·상세 패널) ·
`screens/05 More and Settings.dc.html`(웹 설정 레이아웃·좌측 섹션 내비)

---

```
kaldi note의 관리자 화면 목업을 만들어 주세요. 이미 확정된 디자인 시스템(Clean Ledger) 위에서만 작업합니다.

[이 화면은 무엇인가]
kaldi note는 핸드드립 레시피·추출 기록 앱입니다. 지금은 두 사람이 쓰는 도구이고, 그중 ADMIN 권한을 가진 사람이
카탈로그(원두·장비) 품질을 관리하는 내부 도구입니다. 공개 서비스용 대시보드가 아닙니다.
— 화려함보다 "원장(ledger) 같은 정돈된 표"가 핵심입니다. 앱 본체와 같은 집안사람처럼 보여야 합니다.

[첨부를 이 순서로 읽어 주세요]
1. docs/README.md — 토큰·컴포넌트 사전
2. docs/DECISIONS.md — 확정 결정(어긋나면 이것이 우선)
3. system/Design System.dc.html, system/Navigation.dc.html
4. 참고: screens/02(웹 표·pill·원장 행), screens/06(그라인더 목록 + 우측 상세 패널), screens/05(웹 /settings 좌측 섹션 내비)

[지켜야 할 것]
- 기존 토큰만 씁니다. 새 색·그림자·그라디언트 없음. 아이콘 없이 텍스트 라벨.
- 수치(개수·µm·클릭·시각)는 IBM Plex Mono, 서술은 IBM Plex Sans KR.
- 판단하지 않는 관찰형 문장("이번 실행에서 가공법 3건을 매핑하지 못했습니다").
- 아래 [데이터]에 없는 필드는 그리지 않습니다. 꼭 필요해 보이면 그리고 「API 없음」 라벨 + 끝의 질문 목록에 올려 주세요.
- 상태(RUNNING/SUCCEEDED 등)는 색 하나에 의존하지 말고 텍스트 라벨을 함께. 유채색은 에스프레소 accent 하나뿐입니다.

[캔버스]
- 웹 1440×900만 그립니다(관리자는 데스크톱 전용). 라이트 기본 + 다크 1장.
- 1280px 미만에서의 동작은 표로만 적어 주세요(예: 우측 상세 패널 → 오버레이). 모바일 화면은 그리지 않습니다.

[공통 틀 — 모든 관리자 화면]
- 상단 바: 앱과 같은 로고 바에 「관리자」 표시. 오른쪽에 「앱으로 돌아가기」 링크 + 아바타.
- 좌측 메뉴(약 220~260px, screens/05의 /settings 섹션 내비와 같은 문법): 
  원두 수집 · 장비 · 그라인더 영점 · 회원 — 메뉴는 앞으로 늘어나므로 섹션 묶음(카탈로그 / 운영)을 고려해 주세요.
- 본문: 페이지 eyebrow + 제목 + 한 줄 설명, 그 아래 표. 상세는 우측 420px 패널(screens/06 웹 문법).
- ADMIN이 아닌 사용자가 /admin에 들어왔을 때의 화면 1장.

────────────────────────────────
1) 원두 수집 (API 있음 — 이 화면이 가장 중요합니다)
────────────────────────────────
관리자가 구매처(소스)를 골라 「수집」을 누르면 서버가 그 사이트의 원두를 읽어 카탈로그에 넣습니다. 검수 단계 없이 바로
반영되므로, 실행 결과에서 「건너뛴 상품」과 「매핑하지 못한 원문」을 확인하는 것이 사실상의 검수입니다.

[데이터]
GET /api/v1/admin/crawl-sources — 소스 목록
  key("momos"|"unspecialty"), name("모모스커피"|"언스페셜티 몰"), listUrl, lastRun{ id, status, startedAt, finishedAt } 또는 null
POST /api/v1/admin/crawl-sources/{key}/runs — 실행 시작(202, 응답 status는 항상 RUNNING)
GET /api/v1/admin/crawl-runs?source=&page=&size= — 실행 이력(최신순, 페이지)
GET /api/v1/admin/crawl-runs/{id} — 실행 상세
  id, source, status(RUNNING | SUCCEEDED | FAILED | INTERRUPTED), startedAt, finishedAt(RUNNING이면 null),
  created(새로 만든 원두 수), updated(갱신한 수),
  skipped[ { name(상품명), reason(USER_OWNED | FETCH_FAILED | PARSE_FAILED) } ],
  unmapped[ { name(상품명), field(예: process·variety·roastLevel·origin), raw(원문 그대로, 예 "허니 무산소") } ],
  errorMessage(실행 전체 실패 시 원인, 아니면 null)
에러: 같은 소스가 실행 중이면 409(CRAWL_ALREADY_RUNNING), 모르는 소스 404, 없는 실행 404.
동작: 실행은 비동기(요청 간 1초 대기라 수십 초~수 분). 앱이 재시작되면 남은 RUNNING은 INTERRUPTED가 됩니다.

[그려 주세요]
- 소스 카드/행 2개: 이름, 목록 URL, 마지막 실행(상태·시각·소요 시간), 「수집」 버튼. 실행 중이면 버튼 비활성 + 진행 표시.
- 실행 이력 표: 시작 시각, 소스, 상태, 소요, 생성/갱신 수, skipped·unmapped 건수.
- 실행 상세(우측 패널 또는 별도 페이지 — 제안해 주세요): 요약 수치(대표 수치는 「생성 19」처럼 하나),
  건너뛴 상품 목록(사유별 묶음), 매핑하지 못한 원문 목록(field별 묶음, 원문 강조). FAILED면 errorMessage 블록.
[상태] 실행 이력 0건 · RUNNING(폴링 중) · SUCCEEDED · FAILED · INTERRUPTED · skipped/unmapped 0건 · unmapped 40건 이상 · 409 시도

────────────────────────────────
2) 장비 (API 없음 — 다음 단계, 화면 먼저)
────────────────────────────────
시스템 기본 장비와 사용자가 직접 등록한 장비가 섞여 있습니다. 목적은 ① 값 수정 ② 같은 장비 중복 병합 ③ 사용자 등록 장비를
시스템 장비로 승격하는 것입니다.

[데이터]
그라인더 모델: id, brand, name, adjustmentType(CLICK | NUMBERED | STEPLESS), micronsPerClick(µm/클릭, 없을 수 있음),
  zeroPointOffsetClicks(영점, 클릭), minSetting, maxSetting, burrType(CONICAL | FLAT, 없을 수 있음), isSystem,
  convertible(환산 가능 여부, 계산값)
드리퍼: id, brand, name, type(CONE | FLAT_BOTTOM | WAVE | HYBRID | IMMERSION), isSystem
필터: id, name, material(PAPER_BLEACHED | PAPER_NATURAL | ABACA | METAL | CLOTH), shape(문자열), isSystem
(사용 중인 사람 수·등록자 표시는 「API 없음」으로 제안 가능)

[그려 주세요]
- 장비 종류 탭(그라인더 · 드리퍼 · 필터) + 시스템/사용자 등록 필터 pill + 검색.
- 표 + 우측 상세 편집 패널.
- 병합 흐름: 중복 후보 2개 이상 선택 → 「병합」 → 남길 항목 선택 → 확인(되돌릴 수 없음을 명시).
- 승격 흐름: 사용자 등록 장비 → 「시스템 장비로」 → 확인.
[상태] 빈 결과 · 병합 확인 · 병합 대상에 시스템 장비가 둘 이상 · 저장 실패 · 긴 이름

────────────────────────────────
3) 그라인더 영점 (API 없음)
────────────────────────────────
분쇄도 환산기(그라인더 간 클릭 수 → 마이크론 환산)가 쓰는 모델 공통값을 보정합니다. 사용자 개인 보정(내 기구의
calibrationOffsetClicks)과는 다른, 모든 사용자에게 적용되는 값입니다. 환산 결과는 언제나 "추정치"입니다.

[데이터] 위 그라인더 모델의 micronsPerClick · zeroPointOffsetClicks · minSetting · maxSetting
[그려 주세요]
- 모델 선택 → 현재 값 / 새 값 입력(±0.5 스테퍼 등).
- 저장 전 미리보기: 대표 클릭값(예: 10·20·30클릭)의 추정 마이크론 before → after 표.
- 안내: "이미 저장된 레시피의 추정 입도는 바뀌지 않고, 새로 계산하는 값부터 적용됩니다."
- 변경 이력(누가·언제·이전 → 새 값) — 「API 없음」.
[상태] micronsPerClick 없는 모델(환산 불가) · 값 범위 밖 입력 · 저장 확인

────────────────────────────────
4) 회원 (API 일부)
────────────────────────────────
[데이터] 사용자: id, email(없을 수 있음), nickname, profileImageUrl(없을 수 있음), role(USER | ADMIN), createdAt
[그려 주세요] 회원 표(아바타·닉네임·이메일·역할·가입일) + 역할 변경(USER ↔ ADMIN, 확인 대화상자).
자기 자신의 ADMIN 해제는 막는 상태를 1장. 정지·탈퇴 처리는 그리지 않습니다.

[마지막에]
- 1280px 미만 동작 표.
- 제가 결정해야 할 것을 질문 목록으로(각각 추천값과 근거).
```
