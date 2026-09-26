# 함정

**지금도 유효한 함정만.** 한 세션의 이야기가 아니라 **다음에도 또 걸릴 만한 것**만 남긴다.
해결되면(코드가 고쳐져 더는 재발하지 않으면) 그 항목을 지운다. `/handover`가 매 세션 갱신한다
(`docs/conventions/handover.md`「4단계」). 과거 세션의 전체 서사는
[`docs/archive/JOURNAL.md`](archive/JOURNAL.md)에 있다.

이미 규칙으로 굳어져 컨벤션 문서 본문에 박힌 것(예: `2>/dev/null` 금지 — `workflow.md`,
스택 PR 금지 — `git.md`, 픽스처는 실제 응답에서 뜬다 — `frontend.md`)은 여기 중복해 넣지
않는다. 여기는 **아직 규칙으로 승격되지 않은, 도구·런타임의 구체적인 함정**만 담는다.

---

## Git / PR

- **PR을 머지하면 로컬 `git branch --show-current`가 자동으로 `main`으로 바뀐다.** 이걸
  놓치고 다음 버그 수정을 그대로 `main`에 직접 커밋한 적이 두 번 있다. **머지 직후에는 반드시
  새 브랜치를 만들고 `git branch --show-current`로 확인한 뒤 작업을 시작한다.**
- **`gh pr merge`가 "fast-forward 실패"로 보여도 서버 쪽 머지는 이미 성공했을 수 있다.**
  로컬 `main`에 그 사이 다른 커밋이 쌓였을 때 이렇게 보인다. `git fetch` + `git rebase
  origin/main`으로 정리하면 된다 — 머지가 실패한 게 아니라 로컬이 뒤처진 것이다.
- **`pnpm format`은 스코프 지정 없이 저장소 전체를 재포맷한다.** 의도한 파일 몇 개만이
  아니라 수십 개 무관한 파일의 줄바꿈이 함께 바뀐다. 커밋 전 `git status`로 의도 밖 변경을
  걷어낸다. CI의 포맷 검사가 이미 그 "고치기 전" 상태를 통과시키고 있을 수 있으므로, 로컬
  포맷 결과를 무조건 믿지 않는다.

- **스펙 frontmatter `supersedes:`는 스펙 경로 하나만 받는다.** AC 단위 대체 목록을 넣으면
  `check-docs.sh`가 경로로 읽어 CI에서 실패한다(로컬 `check-spec-coverage.sh`는 못 잡는다).
  일부 AC 대체는 본문 「대체하는 이전 AC」 섹션에 쓰고, 푸시 전 `./scripts/check-docs.sh`도 돌린다.

## 프론트 테스트

- **jsdom 기본 폭(1024px)이 이 프로젝트의 웹/모바일 임계값(760px)보다 넓다.** "모바일" 의도로
  짠 유닛 테스트가 실은 웹 컴포넌트 경로를 타고 있을 수 있다 — 웹 쪽 컴포넌트를 바꿀 때 갑자기
  무관해 보이는 모바일 테스트가 깨지면 이걸 의심한다.
- **Tailwind의 `hidden`(`display:none`)은 접근성 트리에서 서브트리를 통째로 뺀다.** 숨겨진
  요소는 `getByRole` 계열 쿼리와 충돌하지 않는다 — 반대로 "진짜 숨겨졌는지"를 확인하려면
  텍스트가 안 보인다는 것보다 **트리에서 빠졌는지**를 확인해야 한다.
- **문구를 바꿀 때 다른 요소 문구의 부분 문자열이 되면 Playwright strict-mode 충돌이 난다.**
  예: "레시피"가 들어간 CTA 문구를 새로 넣었더니 기존 "레시피" 네비게이션 링크와 겹쳐 여러
  e2e가 한꺼번에 깨졌다. `getByText`/`getByRole`에 `exact: true`를 쓴다.
- **같은 화면에 이름이 같은 CTA가 동시에 두 개 뜰 수 있다.** `/recipes`의 상단 "새 레시피"
  링크와 내 서랍 빈 상태의 "새 레시피" 링크가 내 서랍이 비어 있을 때 함께 렌더된다 —
  지금은 컴포넌트 테스트가 `[data-empty]`로 스코프를 좁혀 우회하지만, e2e에 스코프 없는
  `getByRole("link", { name: "새 레시피" })`를 추가하면 strict-mode 충돌이 난다.

- **`playwright.config.ts`의 `reuseExistingServer: !process.env.CI`는 로컬에 켜둔 `pnpm dev`를
  그대로 재사용한다.** mockup-checker 등을 위해 3000번 포트에 dev 서버를 띄워둔 채 e2e를
  돌리면, PWA/서비스워커 관련 테스트(오프라인 캐시 등)가 Playwright의 깨끗한 프로덕션
  빌드가 아니라 그 dev 서버를 타면서 이유 없이 깨진다. e2e 전에는 `lsof -ti:3000 | xargs -r
  kill`로 3000번 포트를 비운다.

## 셸 스크립트

- **`$VAR가`처럼 변수 뒤에 한글 조사가 바로 붙으면 일부 bash가 "unbound variable"을 낸다.**
  로케일에 따라 UTF-8 바이트를 변수명의 일부로 읽는다. 이 저장소 스크립트는 출력 문구가 전부
  한국어라 반복될 수 있는 함정이다 — `$VAR가`가 아니라 `${VAR}가`로 중괄호를 씌운다.

## 백엔드

- **JPA의 `count` 조회가 자동 flush를 트리거한다.** count 쿼리를 스텝(자식 엔티티) 교체
  **뒤에** 두면, 아직 flush되지 않은 insert가 그 전 delete보다 먼저 나가면서 유니크 제약을
  위반할 수 있다. 연관 엔티티를 delete-then-insert로 교체하는 서비스 메서드에서는 count·조회성
  쿼리의 위치를 의심한다.
- **Testcontainers 재사용 컨테이너는 항상 빈 DB에 Flyway 전체를 한 번에 적용한다.** "마이그레이션
  이전 행"을 넣고 이후 버전이 그걸 백필하는 시나리오를 테스트로 재현할 방법이 없다 — 컬럼을
  지정하지 않고 INSERT해 DEFAULT가 적용되는지, 또는 최종 제약조건이 걸렸는지로 대신 검증한다.
