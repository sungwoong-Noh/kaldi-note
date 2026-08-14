# <기능 이름> 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/YYYY-MM-DD-<기능명>.md`

**Goal:** <한 문장. 이 계획을 다 실행하면 무엇이 가능해지는가>

**Architecture:** <2~3문장. 어떤 접근을 왜 택했는가>

**작업 위치:** `backend/` 또는 `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `<backend|frontend>/CLAUDE.md` → `docs/conventions/<backend|frontend>.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

> **스펙의 모든 AC가 여기 나와야 한다.** 빠진 게 있으면 이 계획은 미완성이다.
> 계획을 다 쓴 뒤 스펙과 대조해 이 표를 채운다.

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-XXX-01 | | Task 1 | 단위 테스트 |
| AC-XXX-02 | | Task 2 | 통합 테스트 |

---

## Global Constraints

<!-- 이 계획 전체에 적용되는 제약. 프로젝트 공통 제약은 backend/CLAUDE.md에 있으므로 반복하지 않는다. -->

- 

---

## File Structure

<!-- 새로 만들거나 수정하는 파일만. 전체 구조는 각 CLAUDE.md에 있다. -->

```
```

---

## Task 1: <이름>

**Files:**
- Create: `<정확한 경로>`
- Modify: `<정확한 경로>`
- Test: `<정확한 경로>`

**Covers:** AC-XXX-01, AC-XXX-02

**Interfaces:**
- Consumes: <앞선 태스크에서 쓰는 것. 정확한 시그니처>
- Produces: <뒤 태스크가 의존할 것. 정확한 이름과 타입>

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-XXX-01 · <스펙의 요약을 그대로>")
void <한국어_메서드명>() {
    // 실제로 붙여넣을 수 있는 코드
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*XxxTest'`
Expected: FAIL — <구체적인 실패 사유>

- [ ] **Step 3: 최소 구현**

```java
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*XxxTest'`
Expected: PASS, N tests

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(<scope>): <제목>" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] <기능별 수동 확인 항목>

---

## 자체 검토 결과

<!-- 계획을 다 쓴 뒤 스펙과 대조해 확인한 것. -->

**AC 커버리지:** 스펙의 AC N개 중 N개가 태스크에 매핑됨 <- 숫자가 같아야 한다

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** 뒤 태스크가 쓰는 이름·시그니처가 앞 태스크에서 정의한 것과 일치함

**검증되지 않은 가정:**
- 
