# Git 컨벤션 (프론트엔드 · 백엔드 공통)

표준을 그대로 따른다. 이 프로젝트만의 특이 규칙을 만들지 않는다.

- 커밋 메시지: [Conventional Commits 1.0.0](https://www.conventionalcommits.org/ko/v1.0.0/)
- 브랜치 전략: [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)

---

## 커밋 메시지

```
<type>(<scope>): <제목>

<본문>

<꼬리말>
```

### 예시

```
feat(recipe): 레시피 포크 기능 추가

원본 레시피와 푸어 스텝 전체를 깊은 복사한다. fork_root_id는
원본의 fork_root_id를 승계해, 3단계 포크에서도 최초 원본을 가리킨다.

Closes #12
```

```
fix(auth): 카카오 이메일 미동의 시 가입 실패 수정

카카오는 이메일 제공 동의가 선택 항목이라 null이 올 수 있다.
users.email을 nullable로 바꾸고 부분 유니크 인덱스를 적용했다.
```

### type

| type | 쓰는 경우 |
|---|---|
| `feat` | 사용자에게 보이는 기능 추가 |
| `fix` | 버그 수정 |
| `refactor` | 동작 변화 없는 구조 개선 |
| `test` | 테스트 추가·수정 |
| `docs` | 문서만 변경 |
| `chore` | 빌드·설정·의존성 등 |
| `perf` | 성능 개선 |
| `style` | 포맷·세미콜론 등 (로직 변화 없음) |

### scope

변경이 속한 도메인. 백엔드는 패키지명, 프론트는 feature명을 쓴다.

`recipe` · `brewlog` · `auth` · `catalog` · `gear` · `inventory` · `grind` · `extraction` · `media` · `user` · `common` · `infra` · `deps`

여러 도메인에 걸치면 scope를 생략한다.

### 규칙

- **제목은 한국어**로, 50자 이내, 마침표 없이.
- 제목은 **"무엇을 했는지"** 를 쓴다. "~하도록 수정" 같은 군더더기를 붙이지 않는다.
- 본문은 **왜 그렇게 했는지**를 쓴다. 무엇을 바꿨는지는 diff가 말해준다.
- 한 커밋은 **하나의 논리적 변경**만 담는다. 테스트와 구현은 같은 커밋에 넣어도 된다(TDD 사이클 하나 = 커밋 하나).
- 파괴적 변경은 `feat!:` 처럼 `!`를 붙이고 꼬리말에 `BREAKING CHANGE:`를 적는다.

### 에이전트가 만든 커밋

에이전트가 커밋할 때는 꼬리말에 아래를 붙인다.

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 브랜치

```
main                          항상 배포 가능한 상태
feat/recipe-fork              기능
fix/kakao-email-null          버그
chore/upgrade-spring-boot     설정·의존성
docs/api-conventions          문서
```

- 브랜치명은 **영문 소문자 + 하이픈**.
- `main`에 직접 푸시하지 않는다. 혼자 개발하더라도 PR을 거친다 — 나중에 스스로 되짚어볼 기록이 남는다.
- 브랜치는 짧게 유지한다. 하루 이상 살아 있으면 `main`을 rebase 한다.
- 머지된 브랜치는 삭제한다.

---

## Pull Request

### 제목

커밋 메시지와 같은 형식을 쓴다: `feat(recipe): 레시피 포크 기능 추가`

### 본문 템플릿

```markdown
## 무엇을
<!-- 이 PR이 하는 일 한두 문장 -->

## 왜
<!-- 배경. 관련 스펙/계획 문서 링크 -->
관련: docs/plans/2026-08-14-plan1-foundation.md Task 7

## 어떻게 확인했나
<!-- 실제로 실행한 명령과 결과 -->
- [ ] `./gradlew clean check` 통과
- [ ] Swagger UI에서 POST /api/v1/auth/login/kakao 수동 확인

## 남은 것
<!-- 후속 작업이 있으면 -->
```

### 머지 규칙

- **CI가 초록이어야 머지한다.** 예외 없다.
- 머지 방식은 **Squash and merge**. `main`의 히스토리를 한 PR = 한 커밋으로 유지한다.
- 리뷰어가 없으면(1인 개발) 셀프 머지해도 되지만, PR 본문의 "어떻게 확인했나"는 반드시 채운다.

---

## 커밋하지 않는 것

`.gitignore`에 반영한다.

```
# 시크릿
.env
.env.local
*.pem
*.key
src/main/resources/application-prod.yml   # 운영 설정은 환경변수로 주입

# 빌드 산출물
build/
.gradle/
.next/
node_modules/
dist/

# 로컬
.DS_Store
*.log
/data/
.idea/
.vscode/
```

**OAuth 클라이언트 시크릿, JWT 서명 키, DB 비밀번호를 절대 커밋하지 않는다.**
로컬 개발용 더미 값(`localdev` 같은)은 커밋해도 되지만, 운영 값과 같은 이름을 쓰지 않는다.

실수로 시크릿을 커밋했다면 **해당 키를 즉시 폐기·재발급**한다. 히스토리에서 지우는 것만으로는 안전하지 않다.

---

## CI

`.github/workflows/`에 백엔드와 프론트를 분리해 둔다. 변경된 경로만 돌도록 `paths` 필터를 건다.

| 워크플로 | 트리거 경로 | 실행 |
|---|---|---|
| `backend.yml` | `backend/**` | `./gradlew clean check` (JDK 21, Testcontainers용 Docker) |
| `frontend.yml` | `frontend/**` | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` |

PR에 대해 항상 실행하고, `main` 푸시 시에는 추가로 배포까지 이어진다(Plan 3).

> **⚠️ 임시 가드가 들어 있다.** 두 워크플로 모두 첫 단계에서 `backend/gradlew`·`frontend/package.json` 존재 여부를 확인하고, 없으면 나머지를 건너뛴다. 코드가 없는 상태에서 CI가 실패하는 것을 막기 위한 것이다.
> **프로젝트를 생성한 직후(백엔드는 Plan 1 Task 1, 프론트는 Plan 4 착수 시) 해당 가드 단계와 각 step의 `if: steps.guard.outputs.ready == 'true'` 조건을 전부 지운다.** 남겨두면 나중에 빌드 파일 경로가 바뀌었을 때 CI가 조용히 아무것도 검사하지 않는 상태가 된다.
