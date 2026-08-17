# 작업 일지

세션마다 한 항목. **최신이 위**, append-only — 과거 항목을 고치지 않는다.
작성 규칙은 [`docs/conventions/handover.md`](conventions/handover.md).

체크박스가 담지 못하는 것을 담는 곳이다 — 막힌 지점, 계획과 달라진 이유, 확인·반증된 가정.

---

## 2026-08-17 · 공개범위 인가 구현 계획

**브랜치:** `docs/plan-visibility` · **PR:** 아래 참조
**상태:** 완료 — `docs/plans/2026-08-17-plan-visibility.md` 작성, 태스크 3개, AC 46개 전부 매핑(`@DisplayName` 46개와 일치 확인). `check-spec-coverage.sh` 초록(스펙이 초안이라 정상 건너뜀)

### 한 일
- 태스크 3개로 쪼갰다: 팔로우 API(`AC-FOLLOW-01~18`) → 레시피 조회 인가(`AC-VIS-01~17`) → 브루로그 `visibility` 입력·조회 인가(`AC-VIS-18~28`). 스키마 변경 없고 새 `ErrorCode`도 없다
- 스펙의 `plan:` frontmatter를 계획 경로로 채웠다

### 발견한 것
- **`GlobalExceptionHandler`에 `HttpMessageNotReadableException` 핸들러가 없다.** 잘못된 enum 값(`"SECRET"`)은 Jackson 역직렬화 실패로 `handleUnexpected(Exception)`에 떨어져 **400이 아니라 500**이 날 것으로 보인다. `AC-VIS-21`이 정확히 여기 걸리므로 Task 3에 핸들러 추가를 넣었다. 이 핸들러는 지금까지 500이던 **모든 깨진 JSON 요청을 400으로 바꾼다** — 영향 범위가 `visibility` 밖까지 미친다
- **`findOwned`를 고치면 안 된다.** 조회 인가를 붙이려고 이걸 손대면 `update`/`delete`도 함께 느슨해져 `AC-VIS-14`·`15`(PUBLIC이어도 남이 수정 불가)가 깨진다. 조회용 `findViewable`을 따로 만들도록 Global Constraints에 못박았다
- **판정 로직을 공통 함수로 묶지 않기로 했다.** `RecipeVisibility`와 `BrewLogVisibility`가 별개 enum이라 공통화하면 억지 추상화가 된다. 공유하는 것은 `FollowService.isMutual` 하나뿐이고 4단계 판정은 두 서비스가 각자 갖는다
- **기존 `token(nickname)` 헬퍼로는 팔로우 픽스처를 만들 수 없다.** 토큰만 돌려주고 사용자 id를 주지 않는다. `User`를 그대로 반환하는 헬퍼를 세 테스트 클래스에 추가해야 한다 — 팔로우 픽스처는 SQL 직접 삽입이 아니라 **팔로우 API 호출로** 만들도록 했고, 이것이 Task 1을 선행으로 둔 이유다
- **Task 2의 RED는 3개뿐이다**(`AC-VIS-04`·`05`·`11`). 17개 중 14개는 현재의 "소유자 아니면 403" 동작이 우연히 기대와 같아 처음부터 통과한다. 계획 Step 2에 이 사실을 적어뒀다 — 모르면 "테스트를 잘못 짰나" 하고 헤맨다

### 다음 세션에게
- **구현 세션에서 Task 1(팔로우 API)부터 TDD로 시작.** 계획 문서에 붙여넣을 수 있는 코드가 전부 있다. 브랜치는 `feat/visibility` 하나로 세 태스크를 진행하고 태스크 경계는 커밋으로 남긴다
- **`FollowControllerTest`에 클래스 레벨 `@Transactional`을 처음부터 붙일 것.** `users`·`follows`에 실제로 쓴다. 이 누락으로 `UserRepositoryTest`가 깨진 사고가 브루잉 로그 Task 1에서 있었고 같은 패턴이 네 번 반복됐다
- **검증되지 않은 가정 5개**가 계획 문서 맨 아래에 있다. 특히 1번(enum 파싱 실패의 실제 상태 코드)과 4번(`RecipeControllerTest`에 `@Transactional`이 이미 있는지)은 Step 2에서 실제로 돌려봐야 확정된다. 결과를 이 일지에 남길 것
- 남은 스펙 후보는 **포크 1건**이다

---

## 2026-08-17 · 브랜치 정리 + 미처리 항목 해소 확인

**브랜치:** `chore/branch-cleanup` · **PR:** 아래 참조
**상태:** 완료 — 저장소에 `main` 하나만 남았다. 코드·스펙 변경 없음

### 한 일
- **카카오 Client Secret 재발급을 사람이 완료했다.** 2026-08-17 OAuth 세션이 "다음 세션에게"로 남긴 미처리 항목이 해소됐다. 저장소 밖에서 한 일이라 커밋에 흔적이 없어 여기 남긴다. `.env`의 `KAKAO_CLIENT_SECRET`만 바뀌었고 코드는 그대로다
- PR #49 머지를 `git merge-base --is-ancestor`로 대조 확인 — base가 `main`이고 `777573d`가 `origin/main`의 조상이며 스펙 파일이 main에 실재한다. 스택 PR 사고 패턴 없음
- 로컬 브랜치 10개·원격 브랜치 7개(전부 MERGED)를 삭제하고 stale 추적 레퍼런스 7개를 prune했다. 로컬·원격 모두 `main`만 남았다

### 발견한 것
- **`git branch --merged`만 믿으면 안 된다.** `chore/claude-settings`가 미병합으로 잡혔으나 실제로는 PR #17로 **스쿼시 머지**돼 커밋 해시만 달라진 것이었다. `git diff main <브랜치> -- <파일>`이 비어 있는 것을 확인하고서야 안전하게 지웠다. 스쿼시 머지를 쓰는 저장소에서는 `--merged`가 거짓 음성을 낸다
- 원격 추적 레퍼런스 7개는 GitHub이 머지 시 자동 삭제한 브랜치의 로컬 흔적이었다. `git push origin --delete`가 "remote ref does not exist"로 실패하는 것이 그 신호다 — 이때 필요한 건 `git remote prune origin`이다

### 다음 세션에게
- **미처리 항목이 없다.** 크레덴셜 재발급·PR 머지·브랜치 정리가 모두 끝났고 저장소는 `main` 하나뿐이다
- **다음 할 일은 공개범위 인가 구현 계획(`docs/plans/`) 작성이다.** 스펙은 `docs/specs/2026-08-17-visibility-authorization.md`(AC 46개, 초안)로 승인돼 있어 인터뷰가 불필요하다. 직전 JOURNAL 항목의 "다음 세션에게"를 그대로 따르면 된다
- 카카오 허용 IP는 여전히 비어 있다. OCI 배포 시 서버 고정 IP 등록을 검토할 것

---

## 2026-08-17 · 공개범위 인가 + 팔로우 스펙 인터뷰

**브랜치:** `docs/spec-visibility` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — 스펙 1건. `docs/specs/2026-08-17-visibility-authorization.md`, AC 46개(`AC-FOLLOW` 18 · `AC-VIS` 28), `status: 초안`. `check-spec-coverage.sh` 초록(초안이라 정상 건너뜀)

### 한 일
- 남은 스펙 후보 2건(포크/공개범위) 중 공개범위를 먼저 다뤘다 — **포크가 공개범위에 의존**하기 때문이다. 무엇이 공개인지 정의되지 않으면 "남의 공개 레시피를 복제한다"의 AC를 리터럴로 쓸 수 없다
- `/interview` 11라운드로 범위를 확정. 팔로우 등록·해제·상태 조회 API 3개 + 레시피·브루로그 단건 조회 인가. **목록 조회(피드)·브루로그 수정·포크·재고는 전부 비목표로 뺐다**
- **AC 접두사를 둘 쓴다**(`AC-FOLLOW` / `AC-VIS`). `check-spec-coverage.sh`의 패턴이 `AC-[A-Z][A-Z0-9_]*-[0-9]+`라 한 파일에 공존해도 잡힌다는 것을 확인하고 결정했다

### 발견한 것
- **`FollowRepository.existsMutualFollow(a, b)`가 V1부터 있는데 호출하는 코드가 하나도 없다.** FRIENDS 판정 쿼리는 이미 작성돼 있어 구현 시 새로 짤 것이 없다
- **팔로우 API가 없어 실사용자는 상호 팔로우 상태에 도달할 수 없었다.** 엔티티·리포지토리·테이블만 있고 컨트롤러가 없다 — 브루잉 로그 때 `user_grinders`와 정확히 같은 갭이다. 그때는 계획 작성 중에야 발견해 선행 태스크를 급히 얹었는데, 이번엔 인터뷰 0단계 조사에서 잡아 스펙에 처음부터 넣었다
- **`recipes.owner_user_id`가 nullable이다**(`ON DELETE SET NULL`). 현재 `Recipe.isOwnedBy`는 owner가 null이면 무조건 false라 **주인 없는 레시피는 아무도 볼 수 없다.** 아키텍처 문서가 예고한 CURATED 시드 레시피(Kasuya 4:6)를 넣는 순간 걸린다. "owner가 null이면 소유자 통과만 못 하고 `visibility`로 판정"으로 정했다
- **403을 404로 바꾸는 안을 검토했으나 기각했다.** 존재 여부를 숨기는 쪽이 보안상 낫지만, 기존 레시피 3개·브루로그 4개 AC가 이미 403으로 못박혀 테스트에 박혀 있다. 2인 비공개 서비스라 열거 공격 실익이 없어 일관성을 택했다
- **스키마 변경이 없다.** `follows`(V1)·`recipes.visibility`(V6)·`brew_logs.visibility`(V8)가 전부 이미 있다. 마이그레이션 파일을 추가하지 않는다
- 결산에서 AC 43개로 확인받았으나 작성 중 3개를 더했다(`AC-FOLLOW-05` 해제 방향성, `AC-VIS-10` 팔로우 끊김 시 즉시 403, `AC-VIS-20` FRIENDS 저장). 앞 둘은 **없으면 틀린 구현이 전부 통과한다** — 양방향을 다 지우는 해제, 판정을 캐시하는 구현이 걸러지지 않는다. 사람에게 추가 사실과 이유를 보고했다

### 다음 세션에게
- **설계 세션을 이어서 구현 계획(`docs/plans/`)을 쓴다.** 스펙이 승인된 상태이므로 인터뷰는 불필요하다. 계획 승인 후 구현은 **별도 세션**이다(`handover.md` — 인터뷰와 구현을 같은 세션에서 하지 않는다)
- 계획을 쪼갤 때 **팔로우 API가 선행 태스크**다. 인가 AC 중 FRIENDS 관련 9개가 상호 팔로우 상태를 전제로 하는데, 팔로우 API 없이는 테스트 픽스처를 컨트롤러로 만들 수 없다
- **DB에 쓰는 컨트롤러 테스트에는 클래스 레벨 `@Transactional`을 처음부터 붙일 것.** 새로 만들 `FollowControllerTest`가 `users`·`follows`에 실제로 쓴다. 이걸 빠뜨려 `UserRepositoryTest`가 깨진 사고가 브루잉 로그 때 있었고, 같은 패턴이 이미 네 번 반복됐다
- **카카오 Client Secret 재발급은 여전히 미처리다**(2026-08-17 OAuth 세션 항목 참조). 사람이 콘솔에서 해야 한다
- 남은 스펙 후보는 **포크 1건**이다

---

## 2026-08-17 · 카카오·구글 OAuth 실기 검증 — 프로젝트 시작 이래 처음

**브랜치:** `feat/oauth-verification` · **PR:** 아래 참조
**상태:** 완료 — **카카오·구글 로그인 전 구간이 실제 크레덴셜로 처음 검증됐다.** Task 7·8 이후 계속 "미검증"으로 남아 있던 항목이 해소됐다

### 한 일
- 사람이 카카오·구글 앱을 만들어 `.env`에 키를 넣고, 인가 코드를 브라우저에서 받아 전달하는 방식으로 진행
- 검증 통과 항목: 인가 코드 → 토큰 교환 → 프로필 조회 → 사용자 생성 → JWT 발급 → 발급 JWT로 보호된 API 호출(200) → 리프레시 회전 → **재사용 감지 시 전체 토큰 폐기** → 재로그인 시 `newUser=false`·사용자 수 유지
- `application-local.yml`이 `client-id: dummy`를 하드코딩해 환경변수가 덮어써지던 것을 `${VAR:dummy}`로 바꿨다. 크레덴셜 없이도 기동·테스트는 그대로 된다. 발급 절차는 `.env.example`에 적었다(`.env`는 gitignore됨)

### 발견한 것
- **Task 8에서 고친 보안 버그가 실기에서도 제대로 막는다.** 폐기된 리프레시 토큰을 재사용하자 **유효했던 최신 토큰까지 함께 무효화**되고 DB에 2개 전부 `revoked_at`이 찍혔다. `@Transactional(noRollbackFor = BusinessException.class)`가 없었으면 폐기가 롤백돼 조용히 뚫렸을 자리다
- **카카오는 이메일도 프로필 사진도 주지 않았다**(둘 다 선택 동의). `users.email`이 null로 정상 저장 — `backend/CLAUDE.md`가 경고한 케이스가 실제로 발생했다. 구글은 둘 다 제공
- **같은 사람이 카카오·구글로 각각 로그인하면 별개 계정이 된다**(id 4, 5). 사용자 식별이 `(provider, provider_user_id)`라 설계대로지만, **계정 연동(account linking)이 없다**는 뜻이다. 카카오로 쌓은 레시피가 구글 로그인에선 안 보인다. 2인 서비스라 당장 영향은 없으나 공개 확장 시 반드시 다뤄야 한다
- 실기에서만 드러난 콘솔 설정 관문 3개(전부 카카오): **KOE006** Redirect URI 미등록 → **KOE010** Client Secret 활성화됐는데 미전달 → **ip mismatched** 허용 IP 제한. 코드 문제는 하나도 없었다. 카카오 콘솔이 개편되어 Client Secret·허용 IP·Redirect URI가 전부 **플랫폼 키 > REST API 키 카드 안**으로 들어갔다(예전 "보안" 메뉴 아님)
- 구글 인가 코드는 주소창에서 복사하면 `4%2F0A...`로 URL 인코딩돼 있다. **디코딩해서 보내야 한다**

### 다음 세션에게
- **크레덴셜 재발급이 필요하다.** 검증 중 셸 표현식 실수로 카카오 Client Secret이 대화에 출력됐다. git에는 들어가지 않았지만, 카카오 콘솔에서 재발급하는 것이 안전하다. 재발급 후 `.env`의 `KAKAO_CLIENT_SECRET`만 바꾸면 된다
- **카카오 허용 IP를 비워둔 상태다**(로컬 IP가 유동이라). OCI 배포 시엔 서버 고정 IP를 등록하는 편이 안전하다
- **계정 연동은 열어둔 결정이다.** 공개 서비스 전환을 검토할 때 함께 정한다. 다만 **스키마 변경은 필요 없다** — `user_oauth_accounts`가 `users`와 N:1이라 한 `user_id`에 카카오·구글 행을 둘 다 매달면 그게 곧 연동이다. `UNIQUE(provider, provider_user_id)`도 그대로 둔 채 로직만 추가하면 된다
- 남은 스펙 후보는 포크 / 공개범위 인가 2건 그대로다

---

## 2026-08-17 · 병합 전략 전환 — 스택 PR 폐지, 복구 확인 완료

**브랜치:** `docs/merge-strategy` · **PR:** 아래 참조
**상태:** 완료 — 복구 PR #46이 main에 병합됐고 **실제 반영까지 확인**했다. main에서 `clean check` 258개·`check-spec-coverage.sh`(스펙 5건, AC 192개) 둘 다 초록

### 한 일
- PR #46 병합 후 `git merge-base --is-ancestor`로 커밋 7개가 전부 main에 있음을 확인. main의 실제 파일도 확인: `brewlog/` 소스 9개, `V8__create_brew_logs_table.sql` 1개, `UserGrinder*` 4개, 스펙 `status: 구현완료`. **두 번의 사고와 달리 이번엔 main에 온전히 들어갔다**
- **스택 PR을 규칙에서 폐지하고 "세션 1개 = 브랜치 1개 = PR 1개"로 바꿨다.** `CLAUDE.md`·`docs/conventions/git.md`·`docs/conventions/handover.md`·`.claude/commands/resume.md`·`.claude/commands/handover.md` 5개 파일 갱신(커밋 42fc5a1, PR #46에 포함)

### 발견한 것
- **"순서대로 머지하라"는 안내로는 부족했다.** 사람은 순서를 지켰다. 실제 원인은 GitHub의 base 재조정이 **앞 브랜치가 삭제되는 시점**에 일어나는데, 연속으로 머지하면 재조정 전에 눌려 base가 중간 브랜치인 채로 병합된다는 점이다. 타이밍을 사람이 신경 써야 하는 구조 자체가 문제였다
- **판단 근거:** 스택 PR은 남이 리뷰하는 대규모 변경을 쪼개는 도구다. 이 저장소는 쓰는 사람과 머지하는 사람이 같아 쪼개서 얻는 리뷰 이득이 거의 없는 반면 순서 리스크는 전부 떠안는다. 태스크별 추적은 계획 문서의 체크박스가 이미 담당하므로 PR이 1:1일 필요가 없다
- 대안으로 "태스크마다 즉시 머지"(한 번에 열린 PR 1개)도 검토했으나, 세션 중간에 사람이 5번 개입해야 해서 오히려 번거롭다는 이유로 채택하지 않았다

### 다음 세션에게
- **태스크를 여러 개 진행해도 브랜치는 하나, PR도 하나다.** 브랜치명은 `feat/brew-log`처럼 기능 단위로 짓고 태스크 경계는 커밋으로 남긴다. `feat/task-01-...` 식 번호 브랜치는 더 쓰지 않는다
- 이 규칙은 `docs/conventions/git.md`의 "스택 PR을 쓰지 않는다" 절에 왜 깨지는지까지 적어뒀다
- **PR을 머지한 뒤에는 main에 실제로 들어갔는지 한 번 확인할 것.** `git merge-base --is-ancestor <커밋> origin/main`이면 충분하다. 두 번 다 이 확인을 안 해서 다음 세션까지 사고를 몰랐다

---

## 2026-08-17 · 스택 PR 병합 사고 재발 — 브루잉 로그 Task 2~5가 main에 안 들어감

**브랜치:** `feat/task-05-brewlog-get` → main 직접 · **PR:** 아래 참조
**상태:** 복구 완료 — main이 브루잉 로그 Task 1~5 전체를 담게 됨. `clean check` 258개·`check-spec-coverage.sh`(스펙 5건, AC 192개) 통과

### 한 일
- PR #41~#45를 사람이 연속으로 머지했으나 **main에 반영된 것은 #41(Task 1)뿐이었다.** `git merge-base --is-ancestor`로 확인한 결과 Task 2~5 커밋 4개가 전부 main에 없고, main에 `brewlog` 파일 0개·`V8__create_brew_logs_table.sql` 없음
- 로컬 `feat/task-05-brewlog-get`(커밋 5개 온전)에 `origin/main`을 병합(충돌 없음)하고 main으로 직접 향하는 PR을 새로 열어 복구

### 발견한 것
- **2026-08-16 원두 재고 때와 정확히 같은 사고가 재발했다.** 머지 후 base가 이렇게 남았다: #42 `task-02→task-01`, #43 `task-03→task-01`(GitHub이 재조정했으나 여전히 main 아님), #44 `task-04→task-03`, #45 `task-05→task-04`. **5개 전부 MERGED로 표시되지만 main으로 향한 건 #41 하나뿐**이라, 나머지는 중간 브랜치에만 들어갔다
- **원인은 "순서대로 머지하라"는 안내가 불충분했다는 것이다.** 순서는 지켜졌다. 문제는 앞 PR이 main에 들어가고 GitHub이 다음 PR의 base를 main으로 재조정할 때까지 기다리지 않고 연속으로 눌렀다는 점이다. 재조정은 base 브랜치가 삭제되는 시점에 일어나므로 즉시 다음을 누르면 base가 중간 브랜치인 채로 머지된다
- **이 프로젝트에서 스택 PR은 그만 쓴다.** 두 번 연속 같은 방식으로 실패했고, 사람이 타이밍을 신경 써야 하는 구조 자체가 원인이다. 최상위 브랜치는 어차피 하위 커밋을 전부 담으므로 **PR 하나만 main으로 열면 태스크 경계는 커밋으로 그대로 보존되면서 순서 문제가 사라진다**

### 다음 세션에게
- **여러 태스크를 한 세션에서 이어서 구현했다면, 태스크별 브랜치는 만들되 PR은 마지막 브랜치에서 main으로 하나만 연다.** 태스크 1개 = PR 1개 규칙은 세션이 태스크 하나로 끝날 때만 적용한다
- 스택 PR을 굳이 써야 한다면, 사람에게 "앞 PR 머지 → **main에 실제로 들어갔는지 확인** → 다음 PR의 base가 main으로 바뀐 것 확인 → 그다음 머지"를 명시할 것. "순서대로"만으로는 부족하다

---

## 2026-08-17 · Task 1~5 — 브루잉 로그 전체 구현, 스펙 구현완료 전환

**브랜치:** `feat/task-01-user-grinder`~`feat/task-05-brewlog-get`(순차 스택) · **PR:** 아래 참조
**상태:** 완료 — `docs/plans/2026-08-17-plan-brew-log.md` 전체 완료. `./gradlew clean check` 통과(전체 258개), `check-spec-coverage.sh` 스펙 5건·AC 192개 확인

### 한 일
- Task 1(사용자 그라인더 등록 API) → Task 2(스키마·엔티티) → Task 3(생성 API+FK 소유 검증) → Task 4(경계값·물리 검증) → Task 5(단건 조회)를 순서대로 TDD로 구현. `BrewLogControllerTest` 39개가 AC-BREW 39개를 전부 덮는다
- `docs/specs/2026-08-17-brew-log.md`의 `status`를 `초안 → 구현완료`로 전환
- `bootRun` + curl로 수동 확인: `actualGrindMicronEstimated=660`·`daysOffRoast=6`·`degassingStatus=IDEAL`·`brewRatio=16.7`·`extractionYieldPercent=20.0`·두 구간 `IDEAL`이 스펙 응답 예시와 정확히 일치. 레시피 `doseG` 15→20 수정 후에도 `actualDoseG=15.0` 유지, 재고 삭제(204) 후에도 `daysOffRoast=6 IDEAL` 유지, 남의 토큰 조회 403까지 확인. 검증 데이터는 SQL로 정리

### 발견한 것
- **계획의 "검증되지 않은 가정" 중 `GearControllerTest` 관련 가정이 깨졌다.** 새 헬퍼가 `users`에 실제로 쓰는데 이 클래스에만 `@Transactional`이 없어(지금까지 DB에 쓰지 않아 필요 없었다) 커밋된 사용자가 남았고, `UserRepositoryTest.이메일이_없는_사용자는_여러_명_저장할_수_있다`가 `expected: 2L but was: 4L`로 깨졌다. 클래스 레벨 `@Transactional` 추가로 해결 — Catalog·Bean·RecipeControllerTest가 이미 쓰던 패턴이라 이제 네 번째 반복이다. **DB에 쓰는 컨트롤러 테스트는 이 애노테이션을 기본값으로 삼을 것**
- **계획이 스펙 응답 예시의 타임스탬프(`2026-08-17T08:30:00Z`)를 테스트 고정 상수로 그대로 옮긴 것이 Task 4에서 터졌다.** 실제 실행 시각이 `2026-08-17T05:03Z`라 그 값은 미래였고, Task 4가 `@PastOrPresent`를 추가하자 34개 중 25개가 한꺼번에 400으로 깨졌다. Task 3까지는 애노테이션이 없어 우연히 통과했던 것이다. `Instant.now().minus(1, HOURS)`로 바꿔 해결 — **스펙 예시의 날짜/시각 리터럴을 테스트에 그대로 복사하지 말 것**
- 계획의 Task 1 Step 4가 "기존 2개 + 신규 3개 = 5 tests"라고 적었지만 `GearControllerTest`에는 기존 12개가 있어 실제로는 15개였다(계획 문서 카운트 오기, 동작에는 영향 없음)
- Task 1·3의 RED에서 계획은 "컴파일 실패"를 예상했지만 실제로는 컴파일 성공 후 런타임 500(매핑 없는 경로가 catch-all 핸들러에 걸림)이었다. 테스트가 raw JSON + MockMvc만 쓰고 새 클래스를 직접 참조하지 않기 때문 — 레시피 Task 2에서 이미 겪은 것과 같은 현상이다. RED로서는 유효했다
- Task 4의 물리 검증 4개(AC-BREW-23~26)는 Task 3에서 `BrewMeasurement`/`ExtractionAnalyzer`를 이미 붙여둔 덕에 RED 단계에서 이미 통과했다. 계획이 예측한 그대로다

### 다음 세션에게
- **PR 5개를 스택 순서대로 머지할 것**: task-01 → task-02 → task-03 → task-04 → task-05. **순서를 어기면 2026-08-17 복구 사고가 재현된다** — 이전 PR이 main에 완전히 들어간 것을 확인하고 다음을 누를 것
- 남은 스펙 후보는 포크 / 공개범위 인가 2건. 브루잉 로그 스펙의 "열어둔 결정"에 목록 조회·수정·삭제 API, `brew_log_steps`·`brew_log_flavor_notes`, 즉흥 추출(recipeId nullable)이 후속 몫으로 남아 있다
- 카카오/구글 실제 로그인은 여전히 미검증 상태 그대로다

---

## 2026-08-17 · 브루잉 로그 구현 계획

**브랜치:** `docs/plan-brew-log` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — `docs/plans/2026-08-17-plan-brew-log.md` 작성, 태스크 5개, AC 39개 전부 매핑. `check-spec-coverage.sh` 초록(브루잉 로그는 여전히 초안이라 정상 건너뜀)

### 한 일
- `docs/specs/2026-08-17-brew-log.md`(AC 39개)에 맞춰 태스크 5개로 계획을 쪼갰다: 사용자 그라인더 등록 API(선행) → 스키마·엔티티 → 생성 API 정상동작+FK 소유 검증(13개) → 생성 API 경계값·물리검증(21개) → 단건 조회(5개)
- 기존 `grind`(`GrindConverter`)·`extraction`(`BrewMeasurement`/`ExtractionAnalyzer`)·`inventory`(`DegassingStatus`) 순수 도메인을 전부 재사용하도록 설계 — 새 계산 로직 없음. 새 `ErrorCode`도 추가하지 않음(기존 `INVALID_REQUEST`/`INVALID_BREW_MEASUREMENT`/`NOT_FOUND`/`FORBIDDEN`만 재사용)

### 발견한 것
- **`userGrinderId`를 필수로 요구하는 스펙인데, 사용자가 `user_grinders`를 등록하는 API가 지금까지 하나도 없었다.** 엔티티·리포지토리만 있고 어떤 컨트롤러도 쓰지 않아 실사용자는 브루잉 로그를 만들 수 없는 상태였다 — 인터뷰에서 놓친 갭. 사람 확인 후 계획에 Task 1(`POST /api/v1/gear/user-grinders`, 최소 생성 API, 스펙에 없어 AC ID 없음)로 얹었다
- `daysOffRoast` 계산에 `brewedAt`을 `ZoneOffset.UTC` 기준 `LocalDate`로 변환하기로 했다 — 스펙 인터뷰에서 다루지 않은 구현 세부사항이라 계획의 Global Constraints·검증되지 않은 가정에 남겼다
- `GrindConverter.toMicron()`을 그대로 재사용하면 그라인더 설정값이 범위를 벗어날 때 `GRIND_SETTING_OUT_OF_RANGE`(400)도 자연히 딸려온다 — 스펙에 명시되지 않았지만 기존 `grind` 스펙이 이미 정의한 동작이라 새 결정으로 보지 않았다
- Task 2(`BrewLogRepositoryTest`)가 FK 제약 때문에 최소 픽스처를 먼저 저장해야 할 수도 있다는 점, Task 1의 `GearControllerTest`에 새 헬퍼(`realUserToken`)를 추가해도 기존 `token()` 기반 테스트에 영향이 없는지는 구현 세션에서 실제로 실행해봐야 확정된다

### 다음 세션에게
- **사람 승인 후 `/resume` → Task 1(사용자 그라인더 등록 API)부터 TDD로 구현.** 계획 문서에 전체 코드가 있다
- 남은 스펙 후보는 포크 / 공개범위 인가 2건. 브루잉 로그 구현이 끝난 뒤에 다룬다
- 카카오/구글 실제 로그인은 여전히 미검증

---

## 2026-08-17 · 브루잉 로그 스펙 인터뷰

**브랜치:** `docs/spec-brew-log` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — 스펙 1건 작성. `docs/specs/2026-08-17-brew-log.md`, AC 39개, `status: 초안`. `check-spec-coverage.sh`가 초안으로 정상 건너뜀 확인

### 한 일
- 남은 스펙 후보 3건(브루잉 로그/포크/공개범위 인가) 중 브루잉 로그를 먼저 다루기로 결정 — Recipe↔BrewLog 분리가 이 서비스의 핵심 원칙이라 우선순위가 가장 높다고 판단
- `/interview` 약 20라운드로 API 범위를 **생성(POST)+단건조회(GET)만**으로 좁혀 확정 — `brew_log_steps`·`brew_log_flavor_notes`·사진 첨부·공개범위 인가 로직·즉흥 추출(recipeId nullable)을 전부 비목표로 뺐다
- 기존 `extraction`(`ExtractionAnalyzer`/`BrewMeasurement`)·`grind`(`GrindConverter`) 순수 도메인을 그대로 재사용하도록 설계 — EY/SCA는 저장하지 않고 조회마다 재계산, 그라인더 마이크론 추정치는 생성 시점에 계산해 스냅샷 저장
- 원두 재고 스펙의 `daysOffRoast`/`degassingStatus` 3단계 판정을 그대로 가져오되, 원두 재고와 달리 **조회 시점이 아니라 생성 시점(`brewedAt` 기준)에 계산해 스냅샷 저장**하기로 결정 — 과거 기록이라 "오늘 기준"이 아니라 "그때 기준"이어야 맞다

### 발견한 것
- **recipeId·beanBatchId·userGrinderId 셋 다 필수로 좁혔다.** 설계 문서는 `recipe_id`를 nullable(즉흥 추출 허용)로 열어뒀지만, 사용자가 이번 스펙에서는 필수로 결정 — 즉흥 추출은 별도 결정 필요 시 후속 스펙에서 다시 연다
- **필드 단순 범위 위반과 필드 간 물리적 정합성 위반을 에러 코드로 명확히 나눴다.** `actualDoseG≤0`·`rating` 범위 등은 Bean Validation → `INVALID_REQUEST`(400)이고, `beverageWeightG>actualWaterG`·`EY>30.0` 같은 관계 검증은 기존 `BrewMeasurement`/`ExtractionAnalyzer`를 그대로 호출해 `INVALID_BREW_MEASUREMENT`(400)로 위임 — 신설 ErrorCode 없이 기존 것만 재사용
- **TDS의 소수 자릿수(`precision 4, scale 2`)를 이 스펙에서 확정했다.** extraction 스펙이 "브루잉 로그 스키마 정할 때 확정"이라고 미뤄뒀던 열린 결정이었다

### 다음 세션에게
- **사람 승인 후 `docs/plans/`에 구현 계획부터 쓸 것.** 스펙은 `status: 초안`이라 커버리지 스크립트가 건너뛴다
- 남은 스펙 후보는 포크 / 공개범위 인가 2건. 이번 스펙의 "열어둔 결정"에 있는 대로, 목록 조회·수정·삭제 API와 `brew_log_steps`·`brew_log_flavor_notes`·즉흥 추출·공개범위 인가는 전부 후속 스펙 몫
- 카카오/구글 실제 로그인은 여전히 미검증 상태 그대로다

---

## 2026-08-17 · 스택 PR 병합 사고 복구 — main이 Task 1까지만 반영된 상태를 발견하고 복구

**브랜치:** `feat/task-08-bean-batch-delete` → main 직접 · **PR:** [#37](https://github.com/sungwoong-Noh/kaldi-note/pull/37)(머지 완료)
**상태:** 완료 — `main`이 이제 원두 카탈로그·개인재고 Task 1~8 전체를 실제로 담고 있다. `clean check`·`check-spec-coverage.sh`(AC 153개) 둘 다 초록

### 한 일
- 이전 세션이 만든 PR #28~#35(스택 구조, 각자 바로 위 태스크 브랜치를 base로 잡음)를 사람이 GitHub UI에서 순서대로 "merge" 눌렀지만, **스택 PR은 merge해도 곧장 위 브랜치에만 반영되고 main으로는 이어지지 않는다** — 병합 후 브랜치가 삭제되면서 그대로 끊겼다. 실사용자가 PR #34(PATCH)도 되돌리기(PR #36)해 상황이 더 꼬였다
- 결과 확인: `main`은 실제로 Task 1~6까지만(PATCH·DELETE 없이) 담고 있었다. 다행히 로컬에는 Task 1~8 전체가 온전했다
- 로컬 `feat/task-08-bean-batch-delete`(Task 2~8 전체 포함)를 원격에 재푸시하고 `main`으로 직접 향하는 PR #37을 새로 열어 병합. add/add 충돌 4건(모두 "로컬 브랜치가 main의 상위집합이라 생기는" 사소한 충돌)은 로컬에서 먼저 병합해 검증한 뒤 그 결과를 브랜치에 반영해 해결
- CI(`spec.yml`·`backend.yml` 둘 다 PR에서도 돈다 — `backend.yml`은 `pull_request` 트리거가 `paths: backend/**`로 걸려 있음, 이전 답변에서 "PR엔 안 돈다"고 한 건 오답이었다) 통과 확인 후 병합

### 발견한 것
- **스택 PR(태스크 브랜치가 서로를 base로 잡는 구조)은 사람이 GitHub UI에서 순서를 안 지키고 누르면 브랜치 삭제 시점에 따라 cascade가 끊길 수 있다.** 이번엔 PR #29(task-02→task-01)가 PR #28(task-01→main)보다 먼저 merge돼(task-01 브랜치가 아직 안 지워진 시점) retarget이 안 일어났다. 이후 태스크들도 비슷하게 얽혔고, 최종적으로 PR #28의 squash 커밋 시점(가장 늦게 merge)에 그때까지 task-01 브랜치에 누적된 내용(Task 1~6)만 캡처됐다
- **다음부터 스택 PR을 쓸 때는 사람에게 "반드시 아래(Task 1)부터 순서대로, 이전 게 완전히 main에 들어간 걸 확인하고 다음을 merge하라"고 명시적으로 안내할 것.** 또는 애초에 스택 대신 각 태스크를 main에서 분기한 독립 브랜치로 만들어 순서 문제 자체를 없애는 방법도 고려할 만하다(다만 그러면 앞 태스크 코드가 없는 채로 다음 태스크를 짜야 해서 지금 방식을 택했었다)
- `backend.yml`의 `on:` 블록에 `pull_request` 트리거가 있다는 걸 이전 턴에서 놓치고 사용자에게 "PR엔 안 돈다"고 잘못 답했다 — 실제로 이번 PR #37에서 두 워크플로 다 정상 실행·통과했다

### 다음 세션에게
- **main은 이제 정말로 원두 카탈로그·개인재고 스펙이 전부 반영된 상태다.** 별도 정리할 브랜치는 남아있지 않다(로컬·원격 태스크 브랜치 전부 삭제 완료)
- 다음 스펙 후보는 브루잉 로그 / 포크 / 공개범위 인가 3건 그대로다

---

## 2026-08-16 · Task 1~8 — 원두 카탈로그·개인재고 전체 구현, 스펙 구현완료 전환

**브랜치:** `feat/task-01-bean-schema`~`feat/task-08-bean-batch-delete`(순차 스택) · **PR:** 아래 참조
**상태:** 완료 — `docs/plans/2026-08-16-plan-bean-inventory.md` 전체 완료. `./gradlew clean check` 통과, `BeanControllerTest` 54/54, `check-spec-coverage.sh` AC 54개 전부 확인

### 한 일
- Roaster/BeanProduct/BeanOrigin(`catalog`), BeanBatch(`inventory`) 마이그레이션(V7)·엔티티·리포지토리·서비스·컨트롤러를 태스크 8개로 나눠 순서대로 구현
- `docs/specs/2026-08-16-bean-inventory.md`의 `status`를 `초안 → 구현완료`로 전환
- Swagger 대신 `bootRun` + curl로 로컬 JWT secret 서명 토큰을 써서 로스터·블렌드 원두 상품·재고를 직접 등록 — `roastedAt` 6일 전 → `daysOffRoast=6`, `degassingStatus="IDEAL"`까지 스펙 응답 예시와 정확히 일치 확인. 검증 데이터는 DELETE API + 직접 SQL로 정리

### 발견한 것
- **계획 문서가 `roast_level_agtron`·`altitude_min_m`·`altitude_max_m`(SMALLINT 컬럼)을 Java `Integer`로 적었는데, Hibernate 스키마 검증에서 `int2 vs integer` 타입 불일치로 컨텍스트 로딩 자체가 실패했다.** `FlavorNote.level`이 이미 `Short`로 SMALLINT를 매핑하고 있어 그 전례를 따라 세 필드 전부 `Short`로 고쳤다(계획 문서 본문은 고치지 않음 — Integer로 남아있으니 후속 세션이 그대로 베끼지 않도록 주의). Task 1 Step 4에서 즉시 잡혔다
- **이전 세션(계획 작성)이 `/handover` 없이 끝나 JOURNAL에 그 세션 항목이 없다.** PR #27로 계획 자체는 정상 머지됐으니 계획 내용에는 문제 없음 — 기록 공백만 있었던 것
- 8개 태스크를 전부 한 세션에서 이어 진행했다 — 매 태스크 사이에 사람 확인을 받았고, `clean check`가 계속 초록이라 브랜치를 병합하지 않고 다음 태스크 위에 스택하는 방식(레시피 Task 5~7과 동일 패턴)으로 진행했다
- 계획의 "검증되지 않은 가정" 중 `BeanProductCreateRequest.origins` null→`List.of()` 컴팩트 생성자 동작, `@PastOrPresent LocalDate`의 미래 날짜 거부 둘 다 테스트로 확인됨(문제없음)

### 다음 세션에게
- **PR 8개를 스택 순서대로 머지할 것**: task-01 → task-02 → ... → task-08. 순서를 지키지 않으면 base 충돌 가능
- `docs/design/2026-08-14-architecture.md`가 아직 `roasters.is_system`/`created_by_user_id` 컬럼을 반영하지 않은 상태다(스펙 인터뷰 세션이 이미 남긴 이슈) — 설계 문서 정리가 필요하면 별도 세션에서
- 원두 재고 스펙이 끝났으니 남은 스펙 후보는 브루잉 로그 / 포크 / 공개범위 인가 3건이다. `recipes.bean_product_id` 컬럼은 이번 태스크로 이미 추가돼 있다(API는 아직 안 씀, 계획대로)
- 카카오/구글 실제 로그인은 여전히 미검증 상태 그대로다

---

## 2026-08-16 · 원두 카탈로그·개인재고 스펙 인터뷰

**브랜치:** `docs/spec-bean-inventory` · **PR:** [#26](https://github.com/sungwoong-Noh/kaldi-note/pull/26)
**상태:** 완료 — `/interview`로 AC-BEAN-01~62(54개) 확정, `docs/specs/2026-08-16-bean-inventory.md` 저장(`status: 초안`). `check-spec-coverage.sh`가 초안으로 정상 건너뜀 확인

### 한 일
- Roaster·BeanProduct·BeanOrigin(공용 카탈로그) + BeanBatch(개인 재고)를 한 스펙에서 함께 다루기로 범위 확정 — 둘 다 코드가 전혀 없는 상태였다
- 디게싱(로스팅 후 경과일) 판정 3단계(0~2일 TOO_FRESH / 3~14일 IDEAL / 15일~ PAST_PEAK)를 재고 조회 응답에 포함
- `recipes.bean_product_id` nullable FK 컬럼 추가도 이번 스펙 범위에 포함(레시피 스펙이 예고한 대로) — 단 **컬럼만** 추가하고 레시피 API는 건드리지 않음

### 발견한 것
- **인터뷰 도중 범위 오해가 한 번 있었다.** "개인 원두재고 관리까지는 할 생각이 없다"는 답변이 나와 BeanBatch를 통째로 스펙에서 뺄지 재확인이 필요했다 — 실제로는 부가기능(자동차감 등)을 뺀다는 뜻이었고, 디게싱 아이디어가 이어서 나오면서 BeanBatch는 그대로 포함하는 걸로 정리됨. **다음 세션도 애매한 답변이 나오면 바로 다음 질문으로 넘어가지 말고 재확인할 것**
- roasters 테이블은 설계 문서(`docs/design/2026-08-14-architecture.md`)에 `is_system`/`created_by_user_id`가 빠져 있었다 — Variety/CoffeeProcess와 동일한 "즉시생성+사후병합" 패턴을 적용하기로 하고 두 컬럼을 이번 스펙에서 추가하기로 결정(설계 문서 자체는 아직 안 고침, 계획 단계에서 반영)
- 카탈로그(GET/POST)는 `.authenticated()`만 요구하고 관리자 권한은 필요 없음을 `SecurityConfig`·`CatalogController` 확인으로 재검증(Variety 패턴과 동일)

### 다음 세션에게
- **사람 승인 후 `docs/plans/`에 구현 계획부터 쓸 것.** 스펙은 아직 `status: 초안`이라 커버리지 스크립트가 건너뛴다 — 계획 승인 후 구현하면서 `구현완료`로 전환
- 로컬에 `feat/task-05-recipe-get`·`feat/task-06-recipe-update`·`feat/task-07-recipe-delete` 브랜치가 남아있다(원격은 이미 삭제됨, PR 전부 머지됨) — 정리해도 되는지 확인 후 삭제할 것
- 스펙의 "열어둔 결정" 3개(디게싱 구간 커스터마이즈 여부·레시피 API의 beanProductId 연결 시점·검증 관리자 API) — 계획 단계에서 다시 볼 필요는 없고, 언급된 대로 후속 스펙 몫

---

## 2026-08-16 · Task 7 — 레시피 삭제 API (DELETE), 레시피 계획 완료

**브랜치:** `feat/task-07-recipe-delete` (`feat/task-06-recipe-update` 위에 스택) · **PR:** 아래 참조
**상태:** 완료 — Step 1~6 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 53/53. **`docs/plans/2026-08-16-plan-recipe.md` 전체 완료**

### 한 일
- `RecipeService#delete`(소프트 삭제), `DELETE /api/v1/recipes/{id}` 추가
- AC-RECIPE-11(삭제 후 소유자도 404)·12(재삭제 404)·59(남의 레시피 삭제 403) 검증 테스트 3개 추가
- `docs/specs/2026-08-16-recipe-crud.md`의 `status`를 `초안 → 구현완료`로 전환 — `check-spec-coverage.sh`가 AC 53개 전부 확인(스펙 3건·AC 99개 통과)
- 완료 기준의 수동 확인(Swagger UI에서 Kasuya 4:6 등록) 항목을 `bootRun` + curl로 수행 — 로컬 JWT secret으로 직접 서명한 토큰 사용(issuer=`kaldi-note` 클레임 필요, Task 11 때와 같은 방식). 응답이 스펙의 응답 예시와 `ratio`·`grindMicronEstimated`·`cumulativeWaterG`까지 정확히 일치함을 확인. 검증 후 생성한 테스트 데이터(user id=1, recipe id=1)는 DB에서 직접 삭제해 정리

### 발견한 것
- 계획 코드를 그대로 옮겨 별다른 이슈 없이 한 번에 통과. `findOwned`·`softDelete`가 Task 1·5에서 이미 준비돼 있어 Task 7이 가장 짧게 끝났다
- PR #23(Task 5)·#24(Task 6)이 아직 머지되지 않아 이 브랜치도 `feat/task-06-recipe-update` 위에 스택했다. 순서대로 머지되면 GitHub가 base를 자동 재조정한다

### 다음 세션에게
- **레시피 CRUD 계획(Plan 2 첫 스펙)이 여기서 끝났다.** PR #23 → #24 → 이번 PR 순서로 머지할 것
- 다음 스펙 후보 4건이 남아 있다(2026-08-16 스펙 세션 JOURNAL 참조): 원두 재고 / 브루잉 로그 / 포크 / 공개범위 인가. GET의 "소유자 아니면 403"은 공개범위 인가 스펙이 나오면 FRIENDS/PUBLIC 조건을 반영해 다시 열어야 한다
- 카카오/구글 실제 로그인은 여전히 크레덴셜이 없어 미검증 상태 그대로다

---

## 2026-08-16 · Task 6 — 레시피 수정 API (PUT)

**브랜치:** `feat/task-06-recipe-update` (`feat/task-05-recipe-get` 위에 스택 — PR #23 아직 미머지) · **PR:** 아래 참조
**상태:** 완료 — Step 1~5 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 50/50

### 한 일
- `UpdateRecipeRequest` DTO(출처 필드 없음), `RecipeService#update`, `PUT /api/v1/recipes/{id}` 추가
- AC-RECIPE-10(스텝 통째 교체)·58(남의 레시피 수정 403) 검증 테스트 2개 추가
- 스텝 교체 순서(`deleteAllByRecipe` → `flush()` → `clear()` → `replaceSteps()`)를 계획대로 적용 — `UNIQUE(recipe_id, step_order)` 위반 없이 한 번에 통과

### 발견한 것
- PR #23(Task 5)이 아직 머지되지 않아 main에 `findOwned`가 없다. `feat/task-05-recipe-get` 위에 스택해 브랜치를 만들었다(Task 4→5와 같은 패턴). PR #23이 머지되면 GitHub가 이 브랜치의 base를 자동으로 main으로 재조정한다
- 계획 코드를 그대로 옮겨 별다른 이슈 없이 한 번에 통과

### 다음 세션에게
- **Task 7(레시피 삭제 API, DELETE)부터.** `findOwned`를 재사용하는 마지막 태스크

---

## 2026-08-16 · Task 5 — 레시피 단건 조회 API

**브랜치:** `feat/task-05-recipe-get` · **PR:** 아래 참조
**상태:** 완료 — Step 1~5 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 48/48

### 한 일
- `RecipeService#get`/`findOwned`(비공개 헬퍼 — Task 6·7이 그대로 재사용 예정), `GET /api/v1/recipes/{id}` 추가
- AC-RECIPE-05·06·61(ratio 반올림, cumulativeWaterG 누적합, 404) 검증 테스트 3개 추가
- 소유자가 아니면 403 — 스펙에 없는 동작이라 AC ID 없이 계획 그대로 구현(공개범위 판정은 후속 스펙 몫)

### 발견한 것
- 계획 코드를 그대로 옮겨 별다른 이슈 없이 한 번에 통과. `com.jayway.jsonpath.JsonPath`(Task 2에서 이미 가용성 확인됨)로 생성 응답에서 `id`를 뽑아 조회 테스트에 재사용하는 패턴이 잘 맞았다

### 다음 세션에게
- **Task 6(레시피 수정 API, PUT)부터.** `findOwned`를 재사용하되, 계획 문서가 미리 경고한 대로 스텝 교체 순서(`deleteAllByRecipe` → `flush()` → `clear()` → `replaceSteps()`)를 지켜야 `UNIQUE(recipe_id, step_order)` 위반을 피한다

---

## 2026-08-16 · Task 4 — 레시피 생성 스텝 시퀀스 검증 + 나머지 에러

**브랜치:** `feat/task-04-recipe-steps` · **PR:** 아래 참조
**상태:** 완료 — Step 1~5 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 45/45

### 한 일
- `ErrorCode`에 `RECIPE_STEP_WATER_MISMATCH`·`RECIPE_STEP_OVERLAP`·`RECIPE_STEP_WATER_INVALID` 3종 추가
- `RecipeService`에 CURATED 거부(FORBIDDEN), `brewerId` 존재 검증(404), 스텝 겹침·물량 합계·스텝 타입별 물량 검증을 `buildSteps`/`validateStepWater`로 구현
- AC-RECIPE-45~48·50~53·57(9개) 검증하는 테스트 추가, 총 45개 전부 통과

### 발견한 것
- **계획 문서의 예시 테스트 메서드명 `1초_겹치면_거부된다()`는 Java 식별자가 숫자로 시작할 수 없어 그대로 옮기면 컴파일 에러가 난다.** `일초_겹치면_거부된다()`로 이름만 바꿔 반영
- **AC-RECIPE-52 테스트 데이터가 Task 3에서 추가된 제약과 충돌했다.** 계획은 "스텝 타입 검증만 걸리게" 레시피 총 `waterG`도 `0.0`으로 맞추라고 했지만, Task 3에서 `CreateRecipeRequest.waterG`에 `@DecimalMin("10.0")`을 걸어놔서 `0.0`은 Bean Validation 단계에서 먼저 `INVALID_REQUEST`로 막혀 의도한 `RECIPE_STEP_WATER_INVALID`까지 도달하지 못했다. 레시피 총 `waterG`를 `15.0`으로 바꾸고 스텝 `waterG`만 `0`으로 남겨 해결 — `validateStepWater`가 물량 합계 검사보다 먼저 도는 구조라 총량 불일치 여부는 결과에 영향 없음
- 그 외 계획 코드는 그대로 적용, 나머지 8개 테스트는 한 번에 통과

### 다음 세션에게
- **Task 5(레시피 단건 조회 API)부터.**

---

## 2026-08-16 · Task 3 — 레시피 생성 입력 값 경계값 검증

**브랜치:** `feat/task-03-recipe-validation` · **PR:** 아래 참조
**상태:** 완료 — Step 1~5 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 36/36

### 한 일
- AC-RECIPE-20~40(21개) 검증하는 경계값 테스트를 `RecipeControllerTest`에 추가 (doseG·waterG·waterTempC·totalTimeSeconds·steps 개수·title·description 각각 하한/하한-1/상한/상한+1 패턴)
- `CreateRecipeRequest`/`StepRequest`에 `@DecimalMin`/`@DecimalMax`/`@Min`/`@Max`/`@Size`/`@NotBlank` 추가. 계획 문서 예시 그대로 적용, 별다른 이슈 없음

### 발견한 것
- 계획 문서가 리터럴 값 표로만 제시한 AC-RECIPE-34/35(스텝 30개/31개)는 30개짜리 JSON을 직접 나열하지 않고 `stepsJson(int count)` 헬퍼로 생성했다 — `POUR` 스텝을 10초 간격·10초 길이로 이어 붙여 겹치지 않게 구성(겹침 검사는 Task 4 몫이라 지금은 통과만 하면 됨)
- RED 단계에서 21개 중 10개(하한/상한 통과 케이스)는 검증이 없어도 이미 201로 통과했고, 11개(거부 케이스)만 실패했다 — 계획이 예상한 "대부분 FAIL"과 정확히 일치

### 다음 세션에게
- **Task 4(레시피 생성 — 스텝 시퀀스 검증 + 나머지 에러)부터.** 스텝 물량 합계가 `waterG`와 정확히 일치하는지, 스텝 겹침 여부를 검증하는 단계 — `ErrorCode` 3종(`RECIPE_STEP_WATER_MISMATCH`·`RECIPE_STEP_OVERLAP`·`RECIPE_STEP_WATER_INVALID`) 추가 필요

---

## 2026-08-16 · Task 2 — 레시피 생성 API (정상 동작 + 마이크론 스냅샷)

**브랜치:** `feat/task-02-recipe-create` · **PR:** 아래 참조
**상태:** 완료 — Step 1~5 전부, `./gradlew clean check` 통과, `RecipeControllerTest` 15/15

### 한 일
- `CreateRecipeRequest`/`StepRequest`/`RecipeResponse`/`RecipeStepResponse` DTO, `RecipeService#create`, `POST /api/v1/recipes` 컨트롤러 추가
- AC-RECIPE-01·02·03·04·07·08·09·41·42·43·44·54·55·56·60 검증하는 `RecipeControllerTest` 15개 전부 통과

### 발견한 것
- **Step 2의 "실패 확인"이 계획 문서 예상과 달랐다.** 계획은 "컴파일 실패"를 기대했지만, 테스트가 DTO·서비스·컨트롤러 클래스를 직접 참조하지 않고 raw JSON 문자열 + MockMvc로만 호출하는 구조라 실제로는 **컴파일은 성공하고 15개 중 14개가 런타임에 상태코드 불일치(엔드포인트 없음 → 404)로 실패**했다. RED로서는 유효했다(올바른 이유로 실패) — 계획 문서 표현만 부정확했던 것으로 판단, Step 3 진행에는 영향 없음
- 계획에 남아있던 검증되지 않은 가정 2개 모두 확인됨: (1) `CreateRecipeRequest`의 컴팩트 생성자가 `steps` 필드 생략 시 `null`을 받아 `List.of()`로 대체하는 것을 AC-RECIPE-01 테스트로 확인, (2) `com.jayway.jsonpath.JsonPath`는 `build.gradle.kts`에 명시적 의존성 없이도 `MockMvcResultMatchers.jsonPath()`가 정상 동작해 `spring-boot-starter-webmvc-test`의 전이 의존성으로 이미 포함돼 있음을 확인

### 다음 세션에게
- **Task 3(레시피 생성 — 입력 값 경계값 검증)부터.** `CreateRecipeRequest`/`StepRequest`에 `@DecimalMin`/`@Size` 등 범위 검증 애노테이션을 추가하는 단계 — Task 2에서 의도적으로 비워둔 것

---

## 2026-08-16 · Task 1 — 레시피 스키마 · 엔티티 · 리포지토리 (기반)

**브랜치:** `feat/task-01-recipe-schema` · **PR:** 아래 참조
**상태:** 완료 — Step 1~6 전부, `./gradlew clean check` 통과

### 한 일
- `V6__create_recipe_tables.sql`(recipes/recipe_steps), `Recipe`/`RecipeStep` 엔티티 + enum 7종, `RecipeRepository`/`RecipeStepRepository` 추가
- `RecipeRepositoryTest` 2개 작성 — TDD Red(컴파일 실패) → Green(2/2 통과) 확인. AC 매핑 없음(계획대로, 후속 태스크의 기반)

### 발견한 것
- 계획 문서의 예시 코드를 그대로 옮겼고 별다른 이슈 없이 한 번에 통과했다. `User.create(email, nickname, profileImageUrl)` 시그니처가 테스트의 `User.create(null, "테스터", null)` 호출과 정확히 일치함을 확인

### 다음 세션에게
- **Task 2(레시피 생성 API — 정상 동작 + 마이크론 스냅샷)부터.** 브랜치는 이어서 `feat/task-02-recipe-create` 등
- 계획에 남은 검증되지 않은 가정 2개(Task 2 관련)는 이번 세션에서 다루지 않았다: (1) `CreateRecipeRequest` 컴팩트 생성자가 `steps` 생략 시 `null`을 받는지, (2) `com.jayway.jsonpath.JsonPath`가 `spring-boot-starter-webmvc-test`에 포함되는지

---

## 2026-08-16 · 계획 — 레시피 CRUD 구현 계획 · 설계 세션

**브랜치:** `docs/plan-recipe` (main에서 분기) · **PR:** [#18](https://github.com/sungwoong-Noh/kaldi-note/pull/18)
**상태:** 완료 — 계획 문서 1건 작성

### 한 일
- `docs/specs/2026-08-16-recipe-crud.md`(AC 53개)에 맞춰 `docs/plans/2026-08-16-plan-recipe.md` 작성 — 태스크 7개, AC 53개 전부 매핑
- 기존 코드(`grind.domain.GrindConverter`, `gear` 리포지토리, Task 11에서 확립된 `AuthenticatedUser` 커스텀 리졸버 패턴)를 그대로 재사용하도록 설계 — 새 환산 로직·새 인증 패턴을 만들지 않음

### 발견한 것 — 계획을 쓰며 직접 판단한 것 (스펙에 없던 결정)
- **GET을 소유자 기준 403으로 제한한다.** 스펙은 조회 AC를 전부 소유자 기준으로만 정의하고 타인 접근은 후속 공개범위 스펙으로 미뤘다. `findOwned`를 PUT/DELETE와 공유해 자연히 403이 나도록 했다 — AC 태그는 붙이지 않았다(스펙에 없는 동작이므로).
- **PUT의 스텝 교체 순서:** `clear()+addAll()`만 하면 Hibernate가 insert를 delete보다 먼저 실행해 `UNIQUE(recipe_id, step_order)` 위반이 난다. `recipeStepRepository.deleteAllByRecipe(recipe)` → `flush()` → `clear()` → `replaceSteps()` 순서로 계획에 명시했다. **AC-RECIPE-10 테스트 자체가 이 순서의 정합성을 검증한다** — 구현 세션에서 실패하면 순서를 다시 조정.
- **태스크 분리 기준:** 생성 API를 정상동작(Task 2)/경계값(Task 3)/에러(Task 4) 3개로 쪼갰다. Task 2가 DTO에 `@NotNull`만 넣고 Task 3이 `@DecimalMin`/`@Size` 등을 추가하는 식으로, 진짜 TDD 빨강→초록이 되도록 설계했다(애초에 완성된 DTO를 Task 2에 다 넣으면 Task 3의 "실패 확인" 단계가 성립하지 않는다).

### 다음 세션에게
- **`/resume` → Task 1부터 TDD로 구현.** PR #18이 머지된 뒤 `feat/task-01-recipe-schema` 같은 브랜치로 시작
- 계획의 "검증되지 않은 가정" 2개를 실제로 확인할 것: (1) `CreateRecipeRequest`의 컴팩트 생성자가 `steps` 필드 생략 시 정말 `null`을 받는지, (2) 테스트 헬퍼의 `com.jayway.jsonpath.JsonPath`가 Boot 4 `spring-boot-starter-webmvc-test`에 포함되는지 — 안 되면 계획에 적어둔 대로 `ObjectMapper`로 대체
- 카카오/구글 실제 로그인은 여전히 미검증 (이전 세션들과 동일, 이번 세션 범위 아님)

---

## 2026-08-16 · 스펙 — 레시피 등록·조회·수정·삭제 (푸어 스텝 포함) · 설계 세션

**브랜치:** `docs/spec-recipe` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — 스펙 1건 작성. Plan 2 계획 문서는 미착수

### 한 일
- Plan 1 완료 상태를 검증하고(`clean check` 16s 초록, AC 46개 확인) Plan 2 갭을 정리
- `/interview` 8라운드로 `docs/specs/2026-08-16-recipe-crud.md` 작성 — **AC 53개**, `status: 초안`

### 발견한 것 — Plan 2에서 없는 것 (다음 세션이 다시 조사하지 않도록)
- **스키마 13개 미존재:** `roasters` `bean_products` `bean_origins` `bean_product_flavor_notes` `bean_batches` `water_profiles` `recipes` `recipe_steps` `tags` `recipe_tags` `brew_logs` `brew_log_steps` `brew_log_flavor_notes`
- **`recipe.fork`** — 아키텍처가 정의한 3대 순수 계산 모듈 중 유일하게 미구현
- **`follows` 테이블·엔티티는 있으나 읽는 코드가 어디에도 없다.** 공개범위 판정이 첫 사용처가 된다
- **`ExtractionAnalyzer`의 사용처가 테스트뿐이다.** BrewLog가 생겨야 실제로 쓰인다

### 발견한 것 — 인터뷰에서 나온 비자명한 결정
- **무단계 그라인더로도 레시피를 등록할 수 있어야 한다.** 환산 API는 `micronsPerClick`이 null이면 422로 거부하지만, 레시피 등록까지 막으면 그 그라인더 사용자는 서비스를 못 쓴다. `grindMicronEstimated`만 null로 두고 201을 준다 (AC-RECIPE-08)
- **`totalTimeSeconds`는 스텝과 대조하지 않는다.** 목표치일 뿐이므로 마지막 스텝 종료보다 작아도 통과한다 (AC-RECIPE-48). 반대로 스텝 물량 합계는 레시피 `waterG`와 **정확히 일치**해야 한다 (AC-RECIPE-50)
- 스텝 겹침(`startAt + duration > 다음 startAt`)은 거부하되 **빈 구간은 허용**한다. 빈 구간은 암묵적 WAIT다
- 결산에서 AC를 51개로 합의했으나 문서 작성 중 47·48을 추가해 53개가 됐다. 이미 확정된 결정(빈 구간 허용, totalTime 미검증)에 검증 조건이 없던 것을 채운 것이고, 새 결정을 만든 게 아니다

### 다음 세션에게
- **스펙 4건이 더 필요하다** — 원두 재고 / 브루잉 로그 / 포크 / 공개범위 인가. **Plan 2 계획 문서는 그 뒤에 쓴다.** 한 세션에 스펙 1건이 적정 분량이었다(질문 8라운드)
- **레시피 스펙은 의도적으로 좁게 잘랐다.** 목록 조회·검색·태그·포크·공개범위 판정·`waterProfileId`·`beanProductId`가 전부 비목표다. 특히 `bean_product_id`는 **컬럼조차 만들지 않기로 했으니** 원두 재고 스펙에서 nullable FK 추가 마이그레이션을 잊지 말 것
- 반대로 `parent_recipe_id`·`fork_root_id`·`author_name`·`source_url`·`source_note`는 **이 스펙 API가 쓰지 않지만 스키마에는 넣는다.** 포크와 CURATED 등록이 곧 쓰게 되고 나중에 넣으면 백필이 필요하기 때문이다
- 스펙에 신설 `ErrorCode` 3종(`RECIPE_STEP_WATER_MISMATCH`·`RECIPE_STEP_OVERLAP`·`RECIPE_STEP_WATER_INVALID`)이 정의돼 있다
- 카카오/구글 실제 로그인은 **여전히 크레덴셜이 없어 한 번도 실기 검증되지 않았다** (Task 11 항목에서 이어짐)

---

## 2026-08-16 · Task 11 — 마스터 조회 API + 분쇄도 환산 API + OpenAPI 문서 (Plan 1 마지막 태스크)

**브랜치:** `feat/task-11-master-api` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — **Plan 1 전체 완료**

### 한 일
- `GearController`(`/grinders`·`/brewers`·`/filters`·`/grind-conversions`), `CatalogController`(`/varieties`·`/processes`·`/flavor-notes`), 각 서비스·DTO 추가
- `springdoc-openapi-starter-webmvc-ui:3.1.0` 추가, `OpenApiConfig`로 Bearer JWT 스킴 등록
- `GearControllerTest` 13개(AC-GRIND-07·10~13·20·21·30~34), `CatalogControllerTest` 4개(스펙 없음, AC ID 없음) 전부 통과
- 두 스펙(`grind-conversion`, `extraction-analysis`) `status`를 `구현완료`로 전환 — `check-spec-coverage.sh`가 AC 46개 전부 확인
- Swagger UI 대신 `/v3/api-docs`로 8개 엔드포인트(+ Task 8의 auth 3개) 전부 문서화됨을 확인. 카카오 크레덴셜이 없어 로컬 JWT secret으로 직접 서명한 토큰으로 그라인더 목록 조회·환산 API(C40 22클릭→660µm→K-Plus 30.0, warning 문구 노출)까지 curl로 재현
- `flyway_schema_history`를 직접 조회해 V1~V5 전부 `success=true` 확인 (`flywayInfo` gradle task는 플러그인 미적용이라 없음 — Plan 1 완료 기준 문서의 가정과 다름)

### 발견한 것
- **`AuthenticatedUser` 레코드(Task 6에서 생성)가 실제로는 어디에도 연결돼 있지 않았다.** `@AuthenticationPrincipal AuthenticatedUser user`로 받으라는 계획 문서 설명대로 하면, `JwtAuthenticationToken`의 principal이 원본 `Jwt`라 타입이 안 맞아 Spring Security의 `AuthenticationPrincipalArgumentResolver`가 조용히 `null`을 반환하고 이후 `user.id()` 호출에서 NPE가 난다. `AuthenticatedUserArgumentResolver`(커스텀 `HandlerMethodArgumentResolver`, `@AuthenticationPrincipal` 없이 타입만으로 매칭)를 새로 만들고 `WebConfig`에 등록해 해결했다. 컨트롤러 파라미터는 어노테이션 없이 `AuthenticatedUser user`로만 받는다
- **`CatalogControllerTest`의 품종 추가 테스트가 FK 위반(500)으로 실패했다.** `varieties.created_by_user_id`가 `users(id)`를 참조하는데, 테스트가 실제 DB에 없는 `userId=1`로 JWT만 발급해 호출했기 때문이다. `UserRepository`로 실제 사용자를 저장한 뒤 그 ID로 토큰을 발급하도록 고쳤고, 클래스에 `@Transactional`을 추가해 테스트 간 격리했다 (Task 4·8과 같은 패턴)
- **AC-GRIND-33의 계획 문서 예시 코드는 스펙의 Given/When과 살짝 어긋난다.** 스펙은 "환산 API에 인증 없이 호출하면 401"이라고 적었지만, 계획의 테스트 코드는 `/gear/grinders` 목록 조회에 이 AC ID를 붙였다. `SecurityConfig`가 모든 `/api/v1/gear/**`를 동일한 JWT 필터로 보호하므로 동작상 문제는 없으나, 계획 코드를 그대로 따랐다는 점을 남긴다
- `CatalogService.findAllProcesses()`가 카테고리별로 묶은 `Map<ProcessCategory, List<...>>`을 반환하는데, 정확한 응답 구조(그룹 키 형태 등)를 못박은 스펙이 없어 자유롭게 설계했다

### 다음 세션에게
- **Plan 1이 여기서 끝났다.** `docs/plans/2026-08-14-plan2-core-domain.md`는 아직 없다 — 다음 세션은 Plan 2 작성부터 시작해야 한다(원두 재고 → 레시피 → 브루잉 로그 → 포크). CLAUDE.md 규칙대로 **스펙 → 계획 → 코드** 순서를 지킬 것
- 카카오/구글 실제 로그인은 이번 세션까지도 크레덴셜이 없어 한 번도 실기 검증되지 않았다. 프론트 연동 전에 실제 OAuth 앱을 만들어 처음부터 끝까지 로그인 플로우를 한 번은 확인해야 한다

---

## 2026-08-16 · Task 10 — 장비 마스터 (그라인더·드리퍼·필터) + 시드

**브랜치:** `feat/task-10-gear` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `V4__create_gear_tables.sql`(grinder_models/user_grinders/brewers/brew_filters), `V5__seed_gear.sql`(그라인더 10종, 드리퍼 10종, 필터 8종) 추가
- `GrinderModel`(+ `toGrindSpec()`), `Brewer`, `BrewFilter`, `UserGrinder` 엔티티, `AdjustmentType`·`BurrType`·`BrewerType`·`FilterMaterial` enum, 리포지토리 4종 추가
- `GearSeedTest` 6개 전부 통과 — 계획 문서는 5개로 적었지만 실제로 6개 메서드가 있었다(Task 2 때와 같은 종류의 계획 문서 카운트 오기, 동작에는 영향 없음)
- 특히 "시드된_그라인더로_실제_환산이_동작한다" 테스트가 Task 2의 순수 `grind` 도메인과 시드 데이터가 실제로 맞물리는 것을 증명한다 (C40 22클릭 → 660µm → K-Plus 30.0)

### 발견한 것
- `GrinderModel`·`Brewer`·`BrewFilter`·`UserGrinder`의 `createByUser`/`of` 정적 팩토리 시그니처는 계획 문서에 명시되지 않아(Task 9의 `CoffeeProcess`처럼 스키마의 NOT NULL 컬럼을 전부 받도록) 직접 설계했다. 특별한 이슈는 없었다

### 다음 세션에게
- **Task 11(마스터 조회 API + 분쇄도 환산 API + OpenAPI 문서)부터.** Plan 1의 마지막 태스크다 — 여기서 `grind` 스펙 status를 `구현완료`로 전환하는 것도 포함돼 있다(Task 3 JOURNAL에서 미뤄둔 것)
- Plan 2에서 `Recipe`가 `brewerId`·`filterId`·`grinderModelId`를, `BeanOrigin`이 `varietyId`·`processId`를 FK로 참조할 예정 — 지금까지처럼 엔티티가 아니라 ID로 참조해야 한다

---

## 2026-08-16 · Task 9 — 카탈로그 마스터 (품종·가공법·플레이버노트) + 시드

**브랜치:** `feat/task-09-catalog` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `V2__create_catalog_tables.sql`(varieties/coffee_processes/flavor_notes), `V3__seed_catalog.sql`(품종 15개, 가공법 13개, 플레이버노트 1단계 9개 + 2단계 14개) 추가
- `Variety`·`CoffeeProcess`·`FlavorNote` 엔티티, `ProcessCategory` enum, 리포지토리 3종 추가
- `CatalogSeedTest` 5개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **계획 문서의 `CoffeeProcess.createByUser` 시그니처가 스키마와 맞지 않았다.** 계획은 `Variety`·`CoffeeProcess` 둘 다 `createByUser(String name, String nameKo, Long userId)`로 통일해 적으라고 했지만, `coffee_processes.category`는 `NOT NULL`이라 값 없이는 저장이 불가능하다. `CoffeeProcess.createByUser`에는 `ProcessCategory category` 파라미터를 추가했다 — 사용자가 가공법을 직접 추가할 때도 카테고리 선택은 필수이므로 스키마 쪽이 맞고 계획 문서 시그니처가 단순화된 오기로 보인다

### 다음 세션에게
- **Task 10(장비 마스터: 그라인더·드리퍼·필터 + 시드)부터.** Task 9와 같은 패턴(마이그레이션 → 시드 → 엔티티 → 리포지토리)이라 그대로 따라가면 된다
- Plan 2에서 `BeanOrigin`이 `varietyId`, `processId`를 FK로 참조할 예정 — 지금은 엔티티 직접 참조가 아니라 ID 참조임을 잊지 말 것

---

## 2026-08-16 · Task 8 — 로그인·토큰 갱신 API (refresh rotation)

**브랜치:** `feat/task-08-auth-api` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `UserOAuthAccount`·`RefreshToken` 엔티티, `RefreshTokenRepository`·`UserOAuthAccountRepository`, `AuthService`(login/refresh/logout), `TokenPair`·`LoginResult`, `AuthController` + DTO 3종 추가
- `POST /api/v1/auth/login/{provider}`·`/refresh`·`/logout` — provider는 소문자 문자열로 받아 `OAuthProvider.valueOf(toUpperCase())`로 변환, 실패 시 `IllegalArgumentException` → 400(`GlobalExceptionHandler`에 핸들러 추가)
- `AuthServiceTest` 6개 전부 통과 (계획 예상치와 일치). `bootRun`으로 기동해 provider 오타 400, 잘못된 인가코드 401, 빈 `code` 400을 curl로 수동 확인

### 발견한 것
- **계획 문서 `AuthServiceTest` 예시 코드에 진짜 보안 버그가 있었다.** `refresh()`가 재사용(이미 폐기된 토큰) 감지 시 `revokeAllByUserId()`로 사용자의 모든 리프레시 토큰을 폐기한 뒤 `BusinessException`을 던지는데, 이 메서드가 `@Transactional`이라 예외가 메서드를 빠져나가며 트랜잭션 전체가 자동 롤백되고 **방금 실행한 폐기 자체가 취소된다.** 즉 토큰 탈취가 감지돼도 나머지 토큰이 무효화되지 않는 채로 프로덕션에 배포될 뻔했다. `@Transactional(noRollbackFor = BusinessException.class)`로 고쳤다 — 테스트(`폐기된_토큰이_재사용되면...`)가 이걸 정확히 잡아냈다
- **JWT는 같은 사용자·같은 초(second)에 두 번 발급하면 완전히 동일한 문자열이 나올 수 있다.** `iat`/`exp`가 초 단위 정밀도라, 같은 트랜잭션 흐름 안에서 로그인 직후 바로 갱신하거나 같은 계정으로 연달아 로그인하면 `refresh_tokens.token_hash` UNIQUE 제약을 위반한다. `JwtTokenProvider.encode()`에 무작위 `jti` 클레임을 추가해 토큰을 항상 고유하게 만들었다 — Task 6에서 만든 파일이지만 Task 8에서 실사용하며 드러난 문제라 여기서 고쳤다
- **`AuthServiceTest`도 Task 4의 `UserRepositoryTest`와 같은 이유로 클래스에 `@Transactional`이 필요했다.** `AbstractIntegrationTest`에 롤백이 없어 테스트 메서드마다 커밋된 데이터가 남고, JUnit5 기본 실행 순서가 소스 순서가 아니라서 `userRepository.count()` 단언이 실행 순서에 따라 흔들렸다. 클래스 레벨 `@Transactional`을 추가해 해결 — 이 패턴은 이제 두 번째로 반복됐으니 앞으로 서비스/리포지토리 통합 테스트를 쓸 때 기본값으로 고려할 것
- Step 7(수동 확인)은 실제 카카오 앱 크레덴셜이 없어 전체 로그인 플로우 재현은 생략했다. `bootRun` 기동, 잘못된 provider(400), 잘못된 인가코드(401 `OAUTH_TOKEN_EXCHANGE_FAILED`), 빈 `code` 검증 실패(400)만 curl로 확인

### 다음 세션에게
- **Task 9(카탈로그 마스터 + 시드)부터.** Plan 1의 인증 기반(Task 4~8)이 여기서 끝난다
- `AuthController`의 provider 변환은 문자열 기반이다. 프론트 연동 시 URL에 `kakao`/`google` 소문자로 넘기게 안내할 것

---

## 2026-08-16 · Task 7 — OAuth2 프로바이더 클라이언트 (카카오/구글)

**브랜치:** `feat/task-07-oauth` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `OAuthProvider`, `OAuthUserProfile`, `OAuthProperties`, `OAuthClient`/`KakaoOAuthClient`/`GoogleOAuthClient`/`OAuthClientRegistry`, `OAuthConfig`(`@EnableConfigurationProperties`) 추가
- `application.yml`·`application-local.yml`·`application-test.yml`에 `kaldi.oauth.*` 설정(로컬·테스트는 더미 값) 추가
- `KakaoOAuthClientTest` 3개 + `GoogleOAuthClientTest` 3개 = 6개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **계획 문서 Step 4의 `KakaoOAuthClient`/`GoogleOAuthClient` 예시 코드에 버그가 있었다.** 생성자가 2개(운영용 `public`, 테스트용 package-private)인데 어느 쪽도 `@Autowired`가 없으면, Spring은 여러 생성자 중 하나를 자동 선택하지 못하고 무인자 기본 생성자를 시도하다 `NoSuchMethodException`으로 컨텍스트 로딩에 실패한다 — 계획 코드를 그대로 옮기면 `SecurityConfigTest`·`UserRepositoryTest`·`JwtTokenProviderTest` 등 `@SpringBootTest` 전체가 깨진다(정작 신규 `OAuthClientTest`는 순수 단위 테스트라 통과해 눈치채기 어렵다). 두 클래스의 운영용 생성자에 `@Autowired`를 추가해 해결
- **`RestClient.Builder` 빈이 Boot 4에서는 `spring-boot-starter-restclient`를 명시적으로 추가해야 생긴다.** `spring-boot-starter-webmvc-test`는 테스트 슬라이스에서 이 빈을 자동 등록해줘서 `KakaoOAuthClientTest`/`GoogleOAuthClientTest`(순수 단위 테스트, Spring 컨텍스트 없음)는 영향이 없었지만, `@SpringBootTest`로 뜨는 통합 테스트와 실제 `bootRun`에서는 빈이 없어 `NoSuchBeanDefinitionException`이 난다. `build.gradle.kts`에 `spring-boot-starter-restclient`를 추가해 해결 — RestClientAutoConfiguration이 Boot 4에서 `org.springframework.boot.restclient.autoconfigure`로 이동하며 별도 스타터가 필요해진 것이 원인(Spring Boot 4 모듈 재편의 연장선, `backend/CLAUDE.md`의 함정 3번과 같은 종류)

### 다음 세션에게
- **Task 8(로그인·토큰 갱신 API, refresh rotation)부터.** `OAuthClientRegistry`를 `AuthService`가 주입받아 쓰는 구조로 계획돼 있다
- `spring-boot-starter-restclient` 추가는 앞으로 `RestClient`를 쓰는 모든 곳에 영향을 준다 — 이후 태스크에서 별도로 다시 추가할 필요 없음

---

## 2026-08-15 · Task 6 — JWT 발급·검증 + ADMIN 인가

**브랜치:** `feat/task-06-jwt` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `JwtTokenProvider`(HS256, NimbusJwtEncoder/Decoder), `JwtConfig`, `JwtProperties`, `AuthenticatedUser`, `KaldiJwtAuthenticationConverter` 추가
- `SecurityConfig`에 `oauth2ResourceServer` 연결, `/test-support/admin`·`/api/v1/admin/**`에 `hasRole("ADMIN")` 요구
- `JwtTokenProviderTest` 5개 + `JwtAuthorizationTest` 4개 + `SecurityConfigTest` 3개 = 12개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **Task 5 JOURNAL에 남겨둔 질문 해결:** `oauth2ResourceServer` 연결 후 Task 5의 임시 `authenticationEntryPoint(401)`를 제거하고 재실행해봤더니 12/12 그대로 통과했다. `oauth2ResourceServer` 자체의 `BearerTokenAuthenticationEntryPoint`가 미인증 요청에 401을 반환하므로 중복이었다 — 제거했다
- `nimbus-jose-jwt`는 Task 5에서 추가한 `spring-boot-starter-oauth2-resource-server`의 전이 의존성으로 이미 들어와 있어 별도 추가가 필요 없었다

### 다음 세션에게
- 없음 — Task 7(OAuth2 프로바이더 클라이언트)부터 계획대로 진행

---

## 2026-08-15 · Task 5 — Security 기본 설정 (CSRF 비활성 + 공통 에러 응답)

**브랜치:** `feat/task-05-security` (`feat/task-04-user` 위에 쌓음) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `SecurityConfig`(CSRF 비활성, stateless), `ErrorCode`/`BusinessException`/`ErrorResponse`/`GlobalExceptionHandler` 추가. grind·extraction 도메인 예외를 HTTP 상태로 매핑
- `SecurityConfigTest` 3개 전부 통과 — 특히 CSRF 없는 POST가 403이 아니라 401로 통과

### 발견한 것
- **httpBasic·formLogin을 끄고 아직 OAuth2 리소스 서버(Task 6)가 없으면 Spring Security가 진입점을 `Http403ForbiddenEntryPoint`로 폴백해 미인증 요청도 403을 반환한다.** 계획 문서의 `SecurityConfig` 코드 그대로는 두 테스트(401 기대)가 403으로 실패했다. `.exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))`을 추가해 해결 — Task 6에서 JWT 리소스 서버를 붙이면 이 entry point가 자연스럽게 대체될 수 있으니 그때 필요 여부를 다시 확인할 것
- `HttpStatus.UNPROCESSABLE_ENTITY`가 Spring Framework 7에서 deprecated됐다(RFC 9110에 맞춰 `UNPROCESSABLE_CONTENT`로 개명, 둘 다 422). `ErrorCode.GRIND_NOT_CONVERTIBLE`을 새 이름으로 바꿨다
- Task 4·5를 병렬 브랜치로 진행하다 JOURNAL 삽입 위치 충돌이 또 발생했다. 이번엔 순서를 정하고 **PR #9(Task 5)의 base를 `feat/task-04-user`로 옮겨 스택**했다 — PR #8이 머지되면 GitHub가 base를 자동으로 main으로 재조정한다. 병렬 대신 순차 스택이 이 프로젝트의 JOURNAL 단일 파일 구조엔 더 맞는다

### 다음 세션에게
- **Task 6(JWT 발급·검증)에서 `SecurityConfig`의 `exceptionHandling` entry point를 다시 볼 것.** OAuth2 리소스 서버를 붙이면 자체 401 처리가 생기므로, 지금 추가한 `HttpStatusEntryPoint`가 여전히 필요한지 중복인지 확인 필요
- PR은 순서대로: #8(Task 4) 머지 → #9(Task 5) 머지

---

## 2026-08-15 · Task 4 — 사용자·팔로우 스키마 + 엔티티

**브랜치:** `feat/task-04-user` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- V1 마이그레이션(`users`/`user_oauth_accounts`/`refresh_tokens`/`follows`), `BaseTimeEntity`/`JpaAuditingConfig`, `User`/`UserRole`/`Follow`/`FollowId`, `UserRepository`/`FollowRepository` 추가
- `UserRepositoryTest` 5개 전부 통과 — 이 태스크에서 처음으로 Testcontainers Postgres에 실제로 쓰기가 들어감

### 발견한 것
- **`AbstractIntegrationTest`에 `@Transactional`이 없어 리포지토리 메서드 호출마다 별도 영속성 컨텍스트가 열린다.** 계획 문서의 테스트 코드를 그대로 옮겼더니 `promoteToAdmin()` 후 `flush()`가 변경을 못 잡고(반환된 detached 엔티티를 수정한 뒤 다른 트랜잭션에서 flush), 테스트 간 데이터도 롤백 없이 누적됐다(`count()` 기대값 불일치). `UserRepositoryTest`에만 `@Transactional`을 추가해 해결 — 공유 베이스클래스는 손대지 않았다. `backend/CLAUDE.md`가 인가·스냅샷 테스트에서 `@Transactional` 롤백 의존을 경고하고 있어서, 그 종류의 테스트를 작성할 땐 이 클래스 단위 어노테이션 패턴 대신 명시적 커밋 검증이 필요하다
- Testcontainers `.withReuse(true)`는 `~/.testcontainers.properties`에 `testcontainers.reuse.enable=true`가 없으면 무효라는 것을 확인 — 이 머신엔 없어서 매 실행마다 컨테이너가 새로 뜬다. 재현 실패의 원인을 잔여 컨테이너 데이터로 오해할 뻔했다

### 다음 세션에게
- 앞으로 리포지토리·통합 테스트를 새로 쓸 때 `@Transactional` 필요 여부를 매번 판단할 것. 단순 CRUD 격리 테스트는 클래스에 `@Transactional` 추가, 커밋 자체를 검증해야 하는 테스트(인가 403, 스냅샷 불변성 등)는 명시적으로 커밋하고 별도 조회로 확인

---

## 2026-08-15 · extraction 스펙 status 구현완료 전환

**브랜치:** `docs/extraction-spec-complete` · **PR:** 아래 참조
**상태:** 완료

### 한 일
- Task 3(PR #6)로 AC-EXT 25개가 전부 충족됐음을 사람에게 확인받고 `docs/specs/2026-08-14-extraction-analysis.md`의 `status`를 `초안 → 구현완료`로 변경
- `check-spec-coverage.sh`가 이제 이 스펙을 강제 검사 대상으로 잡고 25개 전부 통과 확인

### 다음 세션에게
- `grind` 스펙은 아직 `초안`이다. Task 11(경계값·에러 API 테스트)까지 끝나야 `구현완료`로 바뀐다

---

## 2026-08-15 · Task 3 — `extraction` 추출 수율/SCA 구간 순수 도메인

**브랜치:** `feat/task-03-extraction` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `BrewMeasurement`·`ExtractionAnalyzer`·`ExtractionAnalysis` + `StrengthZone`·`ExtractionZone`·`InvalidBrewMeasurementException` 추가 (Spring·JPA 무의존)
- `ExtractionAnalyzerTest` 25개 작성, AC-EXT-01~36 전체 검증 — 이 스펙은 HTTP가 없어 전부 단위 테스트로 끝난다
- `clean check`·`check-spec-coverage.sh` 그린 확인

### 발견한 것
- 계획 문서 Step 6이 예상한 대로 두 스펙(`grind`·`extraction`) 모두 `status: 초안`으로 남아 커버리지 검사를 건너뛴다. 이 스펙은 Task 11 같은 후속 API 태스크가 없어(AC 전체가 이미 이번 태스크로 끝) `구현완료`로 바꿔야 하는지 애매하지만, 계획이 명시한 기대값을 그대로 따랐다 — 바꾸려면 사람 확인이 먼저 필요해 보인다
- Task 2·3을 각각 독립 브랜치(둘 다 main에서 분기)로 병행 진행하니 `docs/JOURNAL.md`의 삽입 위치(헤더 바로 아래)가 겹쳐 PR을 하나 머지할 때마다 나머지 PR이 다시 충돌했다. 매번 두 항목을 다 유지하며 재병합하는 방식으로 풀었다 — **다음부터는 같은 파일 같은 위치에 동시에 쓰는 병렬 PR을 피하거나, 순서를 미리 정해 순차 머지하는 게 낫다**

### 다음 세션에게
- **`extraction` 스펙의 `status`를 `구현완료`로 바꿀지 사람에게 확인받을 것.** AC 25개가 전부 이 태스크로 끝났는데 계획 문서는 status 전환 시점을 Task 11(grind용)로만 언급해 extraction 몫이 비어 있다
- Task 2(`feat/task-02-grind`, PR #5)는 이미 main에 머지됐다

---

## 2026-08-15 · Task 2 — `grind` 분쇄도 환산 순수 도메인

**브랜치:** `feat/task-02-grind` · **PR:** #5 (머지됨)
**상태:** 완료

### 한 일
- `GrindSpec`·`GrindConverter`·`GrindConversion` + 예외 2종(Spring·JPA 무의존) 추가
- `GrindConverterTest` 20개 작성, AC-GRIND-01~07·14~16 검증. TDD Red→Green으로 진행
- `clean check`·`check-spec-coverage.sh` 그린 확인

### 발견한 것
- 계획 문서 예상 테스트 수는 18개였으나 실제로는 `@Nested` 클래스 4개에 걸쳐 20개가 나왔다. 개수 차이는 각 클래스 안 테스트를 합산하지 않은 계획 문서 쪽 오기로 보인다 — 동작에는 영향 없음
- 스펙 `status`를 구현중으로 바꿨다가, Task 3 계획 문서(Step 6)가 "두 스펙 모두 Task 11까지 초안으로 남는다"를 명시하고 있어 초안으로 되돌렸다. 스펙 status 전환은 계획이 지시하는 시점에만 한다

### 다음 세션에게
- 이 브랜치는 Task 3(`feat/task-03-extraction`, main에서 분기)과 독립적이다. 둘 다 push해 PR을 각각 연다

---

## 2026-08-15 · 세션 복구 (앞 세션 비정상 종료)

**브랜치:** `docs/journal-resume-recovery` · **PR:** #4 (머지됨)
**상태:** 완료 — 구현 없음, 저장소 상태 복구만

### 한 일
- `/resume`이 안 된다는 보고로 조사: 앞 세션이 `.claude/worktrees/resume-session`(브랜치 `feat/task-01-scaffolding`)에서 작업하다 handover 없이 끊겼다. 그 브랜치는 이미 PR #3으로 GitHub에서 스쿼시 머지됐지만, worktree·로컬 브랜치가 정리되지 않고 로컬 `main`도 pull이 안 된 채 남아 있었다
- worktree 제거, 로컬 `feat/task-01-scaffolding` 삭제, `main`을 `origin/main`(`22546b0`)으로 fast-forward
- `./gradlew clean check`, `check-spec-coverage.sh` 재확인 — 둘 다 초록
- Task 2용 브랜치 `feat/task-02-grind`를 만들었으나 이번 세션에서 실제 구현은 진행하지 않음(커밋 0개) — 사용자가 곧바로 `/handover`를 호출해 빈 브랜치는 삭제하고 이 항목만 남김

### 발견한 것
- **핸드오버 없이 세션이 끊기면 worktree·브랜치가 고아로 남아 다음 `/resume`을 헷갈리게 한다.** PR이 머지됐는지, 로컬이 그걸 반영했는지를 `git worktree list` + `gh pr list`로 직접 대조해야 확인 가능했다

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터 시작.** `main`은 최신(`22546b0`)이고 검증도 초록이니 바로 `feat/task-02-grind` 브랜치를 새로 따서 계획 문서 Task 2 Step 1부터 진행하면 된다. 이번 세션은 코드를 전혀 건드리지 않았다

---

## 2026-08-15 · Task 1 — 프로젝트 스캐폴딩

**브랜치:** `feat/task-01-scaffolding` · **PR:** 아래 참조
**상태:** 완료 — Step 1~10 전부, `./gradlew clean check` 통과

### 한 일
- start.spring.io로 Java 21 / Boot 4.1.0 프로젝트 생성, 루트 `docker-compose.yml`(Postgres 17), `application.yml`/`-local`/`-test`, `AbstractIntegrationTest` + `TestcontainersConfiguration`, `ApplicationSmokeTest`(`/actuator/health` PASS), Spotless 추가
- `.github/workflows/backend.yml`의 임시 가드(`backend/gradlew` 존재 확인 step과 각 step의 `if:`) 제거 — 계획에서 지시한 대로

### 발견한 것 — 계획의 "검증되지 않은 가정" 결과
1. `bootVersion=4.1.0` 그대로 받아짐 (가정 1 확인)
2. `@ServiceConnection` import 경로는 그대로였다 (가정 2 확인). 다만 **`PostgreSQLContainer` 자체의 패키지가 `org.testcontainers.containers` → `org.testcontainers.postgresql`로 이동**했고 제네릭도 사라져 raw type이 됐다 (계획에 없던 추가 변경)
3. `AutoConfigureMockMvc`도 이동했다: `org.springframework.boot.test.autoconfigure.web.servlet` → `org.springframework.boot.webmvc.test.autoconfigure`
4. Task 7·8의 가정(`MockRestServiceServer.bindTo`, `@MockitoBean`)은 아직 미확인 — 해당 태스크에서 확인할 것

### 발견한 것 — 계획과 달라진 점
- 저장소가 이미 `git init`되어 있어 Step 2의 `git init`은 건너뛰었다. 스캐폴딩만 새 브랜치에 일반 커밋으로 추가
- 루트 `.gitignore`가 이미 백엔드 패턴을 다 포함하고 있어 `backend/.gitignore`는 옮길 것 없이 삭제만 했다
- **환경 이슈:** Spotless 기본 google-java-format(1.24.0)이 이 머신 JDK에서 `NoSuchMethodError`(javac 내부 API가 `Queue`→`List`로 바뀐 최신 JDK 호환성 문제, diffplug/spotless#2468)를 냈다. `1.28.0`으로 버전을 고정해 해결. **PR #3에서 CI(ubuntu-latest + Temurin 21) 확인 완료 — `clean check` 1m38s 초록.**
- `backend/gradle.properties`에 google-java-format용 `--add-exports`/`--add-opens` JVM 인자 추가 (JDK 16+ 공통 이슈, 머신별 경로 아님 — 커밋 안전)
- 생성된 기본 클래스명이 `KaldiNoteApiApplication`(artifactId 기반)이라 문서 구조(`backend/CLAUDE.md`)에 맞춰 `KaldiNoteApplication`으로 정리. 기본 생성 보일러플레이트(`HELP.md`, 컨텍스트 로드 테스트, `TestKaldiNoteApiApplication`)는 계획의 파일 목록에 없어 제거

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터.** DB·Spring 의존 없어 바로 시작 가능. PR #3(CI 초록)이 머지된 뒤 `main`에서 새 브랜치를 딴다

---

## 2026-08-14 · 세션 운영 방식 정의 (설계 세션)

**브랜치:** `docs/session-flow` → `docs/journal-design-session` · **PR:** #1 (머지됨), #2
**상태:** 완료 — 이 세션으로 기초 설계와 개발 방식 정의가 끝났다

### 한 일
- 핸드오버 프로토콜 수립 — `/resume`·`/handover` 커맨드, JOURNAL, 체크박스 소유권
- 세션을 **설계 / 구현 / 디자인** 셋으로 나누고 브랜치·산출물·사용 스킬을 정의
- 병렬 작업 규칙 — worktree 사용 조건과 안전한 조합
- 설계 세션도 PR을 거치도록 결정. PR #1이 저장소 첫 PR이다

### 발견한 것
- **superpowers의 `executing-plans`·`using-git-worktrees`·`subagent-driven-development`가 이 프로젝트 흐름과 충돌한다.** 앞 둘은 계획 실행 때마다 worktree를 강제해서 백엔드가 여러 워크스페이스로 갈라진다. `handover.md`에 "쓰지 말 것"으로 명시했다
- **백엔드 세션은 하나만 돌릴 수 있다.** `docker-compose.yml`의 PostgreSQL이 5432 포트 고정이고, 계획의 `TestcontainersConfiguration`이 `.withReuse(true)`라 컨테이너를 공유한다. 둘을 동시에 돌리면 Flyway 마이그레이션과 테스트 데이터가 섞이는데, 증상이 "내 테스트가 이유 없이 실패"로 나타나 원인을 자기 코드에서 찾게 된다
- `EnterWorktree` 도구는 **CLAUDE.md나 메모리가 지시할 때만** 동작한다. 지시가 없으면 병렬 세션이 같은 디렉터리를 공유해버린다. CLAUDE.md에 지시를 넣었다
- CLAUDE.md 영어화를 검토했으나 **한국어는 전체 문자의 21~33%뿐**이라 절감이 세션당 1% 수준이었다. 번역본 이중 관리 비용이 더 커서 한국어 단일로 유지하기로 했다

### 다음 세션에게
- **구현 세션에서 `/resume` → Plan 1 Task 1**부터 시작한다. 설계·계획·스펙이 모두 준비돼 있어 인터뷰가 필요 없다
- 저장소 초기 커밋 5개(`c625b2b`~`359c41a`)는 `main` 직행이다. **규칙 제정 전이라 그런 것이지 예외가 아니다.** 앞으로는 문서만 바꿔도 브랜치·PR을 거친다
- JOURNAL은 파일 하나를 모든 세션이 공유한다. 병렬 세션의 PR을 머지할 때 이 파일에서 충돌이 날 수 있는데, **두 항목을 다 남기면 끝**이다

---

## 2026-08-14 · 설계 · 규칙 수립 (구현 착수 전)

**브랜치:** `main` · **PR:** 없음 (문서만)
**상태:** 완료

### 한 일
- 커피 도메인 조사 → 아키텍처 설계 → Plan 1(태스크 11개) 작성
- 작업 규칙 확립: **스펙 → 계획 → 코드**, 인수 조건은 기계적으로 검증 가능해야 함
- `/interview`로 기능 스펙 2건 작성 — `grind`(AC 21개), `extraction`(AC 25개)
- 두 스펙에 맞춰 Plan 1 갱신 (AC 매핑표 신설, 46개 전부 대응)
- GitHub 저장소 생성 + CI 3종(backend / frontend / spec)

### 발견한 것
- **Spring Boot 3.5는 2026-06-30 OSS 지원 종료.** 신규 프로젝트는 4.1을 써야 한다. Boot 4 함정 3가지(Security 7 CSRF 기본 활성, Jackson 3 = `tools.jackson.*`, springdoc 3.1.0+)는 `backend/CLAUDE.md`에 정리했다
- **OCI 프리티어가 2 OCPU/12GB로 축소**됐다(2026-06-15). 인스턴스는 생성 완료
- 스펙을 쓰면서 Plan 1의 구멍 7개를 찾았다 — 분쇄도 범위 검증 부재, 영점 미만이 500으로 떨어짐, 결과 범위 초과 미정의, 추출 입력 검증 부재, EY 물리 한계 미검증 등. 전부 계획에 반영했다
- **로스팅 원두는 약 28~30%만 수용성**이라 EY 30% 초과는 측정 오입력이다

### 다음 세션에게
- **Plan 1 Task 1부터 시작한다.** `/resume`으로 시작할 것
- 브랜치는 `feat/task-01-scaffolding`
- 계획에 **검증되지 않은 가정 4개**가 명시돼 있다(문서 맨 아래 "자체 검토 결과"). 실행 중 확인되면 이 일지에 결과를 남길 것:
  1. `start.spring.io`가 `bootVersion=4.1.0`을 받는지
  2. Boot 4에서 `@ServiceConnection` import 경로가 그대로인지
  3. `MockRestServiceServer.bindTo(RestClient.Builder)` 가용 여부 (Task 7)
  4. Boot 4에서 `@MockBean`이 제거됐는지 (Task 8) → `@MockitoBean`
- **넷 다 "버전을 낮춘다"로 해결하지 않는다.** 3.5는 지원이 끝났다
- CI 워크플로에 **임시 가드**가 있다. `backend/gradlew`가 생기면 `backend.yml`의 가드 단계와 각 step의 `if:` 조건을 **반드시 지운다.** 안 지우면 CI가 초록인데 아무것도 검사하지 않는 상태가 된다
