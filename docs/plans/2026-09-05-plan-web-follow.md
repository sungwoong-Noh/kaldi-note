# 초대 링크로 서로 팔로우하기 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-web-follow.md`

**Goal:** 둘이 링크를 주고받아 맞팔로우가 되고, 그 순간부터 서로의 `FRIENDS` 레시피가 목록에 보인다.

**Architecture:** 백엔드에 **엔드포인트 하나**(`GET /api/v1/users/{id}`)만 더한다 — 팔로우 등록·해제·상태는 `FollowController`에 이미 있고 손대지 않는다. 화면은 둘: 「더보기」에 초대 링크 복사를 붙이고, `/u/{id}` 프로필을 새로 만든다. **프로필은 팔로우 버튼만 있는 얇은 화면이다** — 상호 팔로우가 되면 상대 레시피는 기존 `/recipes` 목록이 이미 보여준다(`list-query-api.md:126`).

**작업 위치:** `backend/`(Task 1) → `frontend/`(Task 2~4)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `frontend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBFOLLOW-01 | 공개 프로필을 준다 | Task 1 | API 테스트 |
| AC-WEBFOLLOW-02 | 이메일·역할을 안 내보낸다 | Task 1 | API 테스트 |
| AC-WEBFOLLOW-03 | 자기 자신도 200 | Task 1 | API 테스트 |
| AC-WEBFOLLOW-15 | 없는 사용자는 404 | Task 1 | API 테스트 |
| AC-WEBFOLLOW-16 | 인증 없으면 401 | Task 1 | API 테스트 |
| AC-WEBFOLLOW-04 | 내 초대 링크가 보인다 | Task 2 | 화면 |
| AC-WEBFOLLOW-05 | 복사하면 클립보드에 들어간다 | Task 2 | 화면 |
| AC-WEBFOLLOW-06 | 관계 없음 → 팔로우 버튼만 | Task 3 | 화면 |
| AC-WEBFOLLOW-07 | 나만 팔로우 중 | Task 3 | 화면 |
| AC-WEBFOLLOW-08 | 상대만 나를 팔로우 | Task 3 | 화면 |
| AC-WEBFOLLOW-09 | 맞팔로우 | Task 3 | 화면 |
| AC-WEBFOLLOW-10 | 내 프로필엔 버튼이 없다 | Task 3 | 화면 |
| AC-WEBFOLLOW-17 | 없는 사용자 프로필 | Task 3 | 화면 |
| AC-WEBFOLLOW-18 | 미로그인이면 로그인으로 | Task 3 | 화면 |
| AC-WEBFOLLOW-11 | 팔로우하면 버튼이 바뀐다 | Task 4 | 화면 |
| AC-WEBFOLLOW-12 | 응답 전엔 disabled | Task 4 | 화면 |
| AC-WEBFOLLOW-13 | 취소하면 되돌아온다 | Task 4 | 화면 |
| AC-WEBFOLLOW-14 | 맞팔로우가 깨지면 문구가 내려간다 | Task 4 | 화면 |
| AC-WEBFOLLOW-19 | 실패하면 다시 누를 수 있다 | Task 4 | 화면 |

**스펙의 AC 19개 중 19개가 매핑됐다.**

---

## Global Constraints

- **`FollowController`·`FollowService`를 고치지 않는다.** 셋 다 이미 있고 테스트가 붙어 있다. 자기 자신에 400을 내는 것도 **의도된 동작이다** — 화면이 피해 간다.
- **`MeResponse`를 재사용하지 않는다.** `email`과 `role`을 갖고 있다. 별도 DTO를 만든다. AC-WEBFOLLOW-02가 이걸 잡는다.
- **스키마 변경 0건.** 마이그레이션 파일을 추가하지 않는다.
- **★ `useRequireSession.ts`를 PWA 계획도 고친다.** `docs/plans/2026-09-05-plan-web-pwa.md`의 Task 4가 같은 파일에서 refresh 실패를 `offline`/`unauthorized`로 가른다. **두 브랜치를 동시에 열지 않는다.** 이 계획은 그 파일을 **읽기만** 하고 고치지 않으므로, PWA가 먼저 머지돼도 충돌하지 않는다.
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- **`Write` 전에 파일이 있는지 본다.** 2026-09-02에 계획이 `Create`로 적은 파일이 이미 있어 기존 테스트 11개를 덮어썼다.
- 백엔드 커밋 전 `./gradlew spotlessApply && ./gradlew clean check`. 프론트 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## File Structure

```
backend/src/
├── main/java/com/kaldinote/user/
│   ├── application/UserService.java                       Modify — profile(id)
│   ├── presentation/UserController.java                   Modify — GET /{id}
│   └── presentation/dto/PublicProfileResponse.java        Create
└── test/java/com/kaldinote/user/presentation/
    └── UserControllerTest.java                            Modify — AC 5개

frontend/src/
├── app/
│   ├── more/page.tsx                                      Modify — 초대 링크
│   ├── more/page.test.tsx                                 Modify — AC 2개
│   └── u/[id]/
│       ├── page.tsx                                       Create — 라우팅만
│       └── page.test.tsx                                  Create — AC 12개
└── features/user/
    ├── queries.ts                                         Modify — 프로필·팔로우 훅
    └── components/UserProfile.tsx                         Create

docs/specs/2026-09-05-web-follow.md                        Modify — status
```

---

## Task 1: 공개 프로필 API

**Files:**
- Create: `backend/src/main/java/com/kaldinote/user/presentation/dto/PublicProfileResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/user/application/UserService.java`
- Modify: `backend/src/main/java/com/kaldinote/user/presentation/UserController.java`
- Modify: `backend/src/test/java/com/kaldinote/user/presentation/UserControllerTest.java`

**Covers:** AC-WEBFOLLOW-01, 02, 03, 15, 16

**Interfaces:**
- Produces: `GET /api/v1/users/{id}` → `PublicProfileResponse(Long id, String nickname, String profileImageUrl)`
- Produces: `UserService.profile(Long id): PublicProfileResponse` — 없으면 `BusinessException(NOT_FOUND)`
- **`me(Long)`의 시그니처와 동작을 바꾸지 않는다.**

> **경로 충돌 주의.** `/users/me`(리터럴)와 `/users/{id}`(템플릿)가 같은 컨트롤러에 생긴다. 스프링은 리터럴을 먼저 고르므로 `me`가 `{id}`로 새지 않지만, **새면 `Long` 변환이 실패해 400이 된다**(`http-error-contract` 스펙이 그 핸들러를 넣어 뒀다). Step 5에 회귀 단언을 넣는다.

- [ ] **Step 1: 시작 전 초록을 확인한다**

Run: `docker compose up -d && cd backend && ./gradlew clean check`
Expected: PASS. **숫자를 적어둔다**(482개일 것).

- [ ] **Step 2: 실패하는 테스트 작성**

Modify `UserControllerTest.java` — 기존 테스트는 건드리지 않고 더한다.

```java
  @Test
  @DisplayName("AC-WEBFOLLOW-01 · 공개 프로필은 id·nickname·profileImageUrl을 반환한다")
  void 공개_프로필은_세_필드를_반환한다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));
    User target =
        userRepository.save(
            User.create("friend@example.com", "확인용친구", "https://example.com/f.png"));

    mockMvc
        .perform(
            get("/api/v1/users/" + target.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(target.getId()))
        .andExpect(jsonPath("$.nickname").value("확인용친구"))
        .andExpect(jsonPath("$.profileImageUrl").value("https://example.com/f.png"));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-02 · 공개 프로필은 email·role·createdAt을 담지 않는다")
  void 공개_프로필은_민감한_필드를_담지_않는다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));
    User target =
        userRepository.save(
            User.create("friend@example.com", "확인용친구", "https://example.com/f.png"));

    String body =
        mockMvc
            .perform(
                get("/api/v1/users/" + target.getId())
                    .header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(JsonPath.<Map<String, Object>>read(body, "$").keySet())
        .containsExactlyInAnyOrder("id", "nickname", "profileImageUrl");
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-03 · 자기 자신의 공개 프로필도 200이다")
  void 자기_자신의_공개_프로필도_200이다() throws Exception {
    // 내 초대 링크가 제대로 됐는지 눌러 확인하는 것은 흔한 행동이다.
    // FollowService.status는 자기 자신에 400을 내지만 이 엔드포인트는 막지 않는다.
    User user = userRepository.save(User.create("me@example.com", "노성웅", null));

    mockMvc
        .perform(
            get("/api/v1/users/" + user.getId()).header(HttpHeaders.AUTHORIZATION, tokenOf(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(user.getId()));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-15 · 없는 사용자는 404와 NOT_FOUND다")
  void 없는_사용자는_404다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));

    mockMvc
        .perform(get("/api/v1/users/999999").header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-16 · 인증 없이 공개 프로필을 부르면 401이다")
  void 인증_없이_공개_프로필을_부르면_401이다() throws Exception {
    User target = userRepository.save(User.create("friend@example.com", "확인용친구", null));

    mockMvc
        .perform(get("/api/v1/users/" + target.getId()))
        .andExpect(status().isUnauthorized());
  }
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests '*UserControllerTest'`
Expected: FAIL — 5개. `/api/v1/users/{id}` 매핑이 없어 **404 `ENDPOINT_NOT_FOUND`**가 난다(AC-WEBFOLLOW-15만 상태코드가 우연히 맞지만 `code`가 달라 빨갛다).

- [ ] **Step 4: DTO와 서비스를 만든다**

Create `PublicProfileResponse.java`:

```java
package com.kaldinote.user.presentation.dto;

import com.kaldinote.user.domain.User;

/**
 * 남에게 보여줄 프로필.
 *
 * <p><b>{@link MeResponse}를 재사용하지 않는 이유:</b> 그쪽은 email과 role을 갖고 있다. 초대 링크는 상대에게 보내는 것이라 같은
 * DTO를 쓰면 이메일이 그대로 새어 나간다.
 *
 * <p>profileImageUrl은 null일 수 있다 — 카카오 프로필 사진은 선택이다. non_null 직렬화라 null이면 키가 통째로 빠진다.
 */
public record PublicProfileResponse(Long id, String nickname, String profileImageUrl) {

  public static PublicProfileResponse from(User user) {
    return new PublicProfileResponse(
        user.getId(), user.getNickname(), user.getProfileImageUrl());
  }
}
```

Modify `UserService.java` — `me` 아래에 더한다:

```java
  /** 남의 프로필. 자기 자신을 조회해도 막지 않는다 — 내 초대 링크를 눌러 확인하는 흔한 경로다. */
  public PublicProfileResponse profile(Long userId) {
    return userRepository
        .findById(userId)
        .map(PublicProfileResponse::from)
        .orElseThrow(
            () -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + userId));
  }
```

import를 더한다: `import com.kaldinote.user.presentation.dto.PublicProfileResponse;`

- [ ] **Step 5: 컨트롤러에 매핑을 더한다**

Modify `UserController.java`:

```java
  @GetMapping("/{id}")
  public PublicProfileResponse profile(@PathVariable Long id) {
    return userService.profile(id);
  }
```

import 둘을 더한다: `org.springframework.web.bind.annotation.PathVariable`, `com.kaldinote.user.presentation.dto.PublicProfileResponse`.

**`/users/me`가 여전히 200인지 회귀 단언을 더한다** — 기존 `AC-ME-01` 테스트가 이미 그것을 재고 있으므로 **따로 쓰지 않고 그 테스트가 초록인지 확인만 한다.** 빨가면 리터럴 경로가 템플릿에 먹힌 것이고, 그때는 `@GetMapping("/{id:\\d+}")`로 좁힌다.

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `cd backend && ./gradlew test --tests '*UserControllerTest'`
Expected: PASS. 기존 `AC-ME-*`도 전부 초록이어야 한다.

- [ ] **Step 7: 돌연변이로 누출 검사를 확인한다**

`PublicProfileResponse`에 `String email`을 잠시 더하고 `from`에서 `user.getEmail()`을 넣는다.
Expected: **AC-WEBFOLLOW-02만** 빨갛다. 확인한 뒤 되돌린다.

- [ ] **Step 8: 커밋**

```bash
cd backend && ./gradlew spotlessApply && ./gradlew clean check
cd .. && git add backend && git commit -m "feat(backend): 공개 프로필 조회 API (AC-WEBFOLLOW 5개)"
```

---

## Task 2: 「더보기」의 초대 링크

**Files:**
- Modify: `frontend/src/app/more/page.tsx`
- Modify: `frontend/src/app/more/page.test.tsx`

**Covers:** AC-WEBFOLLOW-04, AC-WEBFOLLOW-05

**Interfaces:**
- Consumes: `useMe()`의 `data.id` (`features/user/queries.ts`, 이미 있다)
- Produces: 없음. 화면 안에서 끝난다.

- [ ] **Step 1: 실패하는 테스트 작성**

Modify `frontend/src/app/more/page.test.tsx` — 기존 테스트는 그대로 두고 더한다. **파일 위쪽의 기존 렌더 헬퍼와 MSW 핸들러를 먼저 읽고 그것을 그대로 쓴다.**

```tsx
it("AC-WEBFOLLOW-04 · 내 초대 링크와 복사 버튼이 보인다", async () => {
  renderMorePage();

  expect(await screen.findByText("내 초대 링크")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "복사" })).toBeInTheDocument();
});

it("AC-WEBFOLLOW-05 · 복사하면 링크가 클립보드에 들어간다", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // jsdom에는 navigator.clipboard가 없다. 정의부터 해야 한다.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });

  renderMorePage();
  await userEvent.click(await screen.findByRole("button", { name: "복사" }));

  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/u/11`);
  expect(await screen.findByText("복사했습니다")).toBeInTheDocument();
});
```

> `11`은 이 파일의 기존 `me` 픽스처 id다. **다르면 픽스처 값에 맞춘다** — 픽스처를 고치지 않는다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test more`
Expected: FAIL — 2개. `내 초대 링크`를 찾지 못한다.

- [ ] **Step 3: 최소 구현**

Modify `frontend/src/app/more/page.tsx` — `useState`에 복사 상태를 더하고, 닉네임 `<dl>` 아래에 절을 넣는다.

```tsx
  const [copied, setCopied] = useState(false);

  async function copyInviteLink(id: number) {
    await navigator.clipboard.writeText(`${window.location.origin}/u/${id}`);
    setCopied(true);
  }
```

```tsx
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 py-4 dark:border-neutral-800">
        <div className="min-w-0">
          <p className="font-medium">내 초대 링크</p>
          <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            {`/u/${me.data.id}`}
          </p>
        </div>
        {copied ? (
          <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
            복사했습니다
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void copyInviteLink(me.data.id)}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700"
          >
            복사
          </button>
        )}
      </div>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test more`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/src/app/more
git commit -m "feat(web): 「더보기」에서 초대 링크를 복사한다 (AC-WEBFOLLOW-04·05)"
```

---

## Task 3: 프로필 화면

**Files:**
- Modify: `frontend/src/features/user/queries.ts`
- Create: `frontend/src/features/user/components/UserProfile.tsx`
- Create: `frontend/src/app/u/[id]/page.tsx`
- Create: `frontend/src/app/u/[id]/page.test.tsx`

**Covers:** AC-WEBFOLLOW-06, 07, 08, 09, 10, 17, 18

**Interfaces:**
- Produces (`queries.ts`):
  ```ts
  export const publicProfileSchema = z.object({
    id: z.number(),
    nickname: z.string(),
    profileImageUrl: z.string().optional(),
  });
  export type PublicProfile = z.infer<typeof publicProfileSchema>;

  export const followStatusSchema = z.object({
    following: z.boolean(),
    followedBy: z.boolean(),
    mutual: z.boolean(),
  });
  export type FollowStatus = z.infer<typeof followStatusSchema>;

  export function usePublicProfile(id: number, onSessionLost?: () => void);
  /** `enabled`가 false면 요청을 보내지 않는다. 내 프로필일 때 쓴다. */
  export function useFollowStatus(id: number, enabled: boolean, onSessionLost?: () => void);
  ```
- Produces: `UserProfile({ id }: { id: number })` — 클라이언트 컴포넌트
- Consumes: `useMe()`, `useRequireSession()` (둘 다 이미 있다. **고치지 않는다**)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/src/app/u/[id]/page.test.tsx`. **다른 화면 테스트 파일(`app/brews/[id]/page.test.tsx`)의 렌더 헬퍼·MSW 설정을 그대로 베껴 온다** — 이 프로젝트의 화면 테스트는 그 모양이 표준이다.

```tsx
const status = (s: Partial<FollowStatus>) => ({
  following: false,
  followedBy: false,
  mutual: false,
  ...s,
});

it("AC-WEBFOLLOW-06 · 관계가 없으면 팔로우 버튼만 있다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () => HttpResponse.json(status({}))),
  );

  renderProfile(12);

  expect(await screen.findByRole("button", { name: "팔로우" })).toBeInTheDocument();
  expect(screen.queryByText("나를 팔로우하고 있습니다")).not.toBeInTheDocument();
  expect(screen.queryByText("맞팔로우 — 서로의 기록이 보입니다")).not.toBeInTheDocument();
  expect(
    screen.queryByText("상대도 나를 팔로우하면 서로의 기록이 보입니다"),
  ).not.toBeInTheDocument();
});

it("AC-WEBFOLLOW-07 · 나만 팔로우 중이면 기다리는 중임을 알린다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ following: true })),
    ),
  );

  renderProfile(12);

  expect(await screen.findByRole("button", { name: "팔로우 취소" })).toBeInTheDocument();
  expect(
    screen.getByText("상대도 나를 팔로우하면 서로의 기록이 보입니다"),
  ).toBeInTheDocument();
});

it("AC-WEBFOLLOW-08 · 상대만 나를 팔로우하면 그렇게 말한다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ followedBy: true })),
    ),
  );

  renderProfile(12);

  expect(await screen.findByRole("button", { name: "팔로우" })).toBeInTheDocument();
  expect(screen.getByText("나를 팔로우하고 있습니다")).toBeInTheDocument();
});

it("AC-WEBFOLLOW-09 · 맞팔로우면 서로 보인다고 말한다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ following: true, followedBy: true, mutual: true })),
    ),
  );

  renderProfile(12);

  expect(await screen.findByRole("button", { name: "팔로우 취소" })).toBeInTheDocument();
  expect(screen.getByText("맞팔로우 — 서로의 기록이 보입니다")).toBeInTheDocument();
});

it("AC-WEBFOLLOW-10 · 내 프로필엔 버튼이 없고 상태를 조회하지 않는다", async () => {
  // 백엔드는 자기 자신의 상태 조회에 400을 낸다. 부르지 않는 것이 이 조건의 핵심이다.
  let statusCalls = 0;
  server.use(
    http.get("*/api/v1/users/11", () => HttpResponse.json(myProfile)),
    http.get("*/api/v1/users/11/follow", () => {
      statusCalls += 1;
      return HttpResponse.json(status({}));
    }),
  );

  renderProfile(11);

  expect(await screen.findByText("나")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "팔로우" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "팔로우 취소" })).not.toBeInTheDocument();
  expect(statusCalls).toBe(0);
});

it("AC-WEBFOLLOW-17 · 없는 사용자는 못 찾았다고 말한다", async () => {
  server.use(
    http.get("*/api/v1/users/999", () =>
      HttpResponse.json({ code: "NOT_FOUND", message: "대상을 찾을 수 없습니다." }, { status: 404 }),
    ),
  );

  renderProfile(999);

  expect(await screen.findByText("사용자를 찾을 수 없습니다")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "팔로우" })).not.toBeInTheDocument();
});

it("AC-WEBFOLLOW-18 · 로그인하지 않았으면 로그인으로 보낸다", async () => {
  server.use(
    http.post("*/api/auth/refresh", () => new HttpResponse(null, { status: 401 })),
  );

  renderProfile(12);

  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fu%2F12"),
  );
});
```

> `friendProfile`·`myProfile`은 이 파일 안에 둔다 — `{ id: 12, nickname: "확인용친구" }`, `{ id: 11, nickname: "노성웅" }`. **백엔드 응답 세 필드가 전부라 실제 응답과 모양이 같다.**

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test u/`
Expected: FAIL — 7개. `/u/[id]` 라우트가 없어 모듈을 못 찾는다.

- [ ] **Step 3: 쿼리 훅을 더한다**

Modify `frontend/src/features/user/queries.ts` — 파일 끝에 더한다. `meSchema`·`useMe`는 건드리지 않는다.

```ts
/** 남에게 보여주는 프로필. `MeResponse`와 달리 email·role이 없다. */
export const publicProfileSchema = z.object({
  id: z.number(),
  nickname: z.string(),
  profileImageUrl: z.string().optional(),
});

export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const followStatusSchema = z.object({
  following: z.boolean(),
  followedBy: z.boolean(),
  mutual: z.boolean(),
});

export type FollowStatus = z.infer<typeof followStatusSchema>;

export function usePublicProfile(id: number, onSessionLost?: () => void) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () =>
      authedRequest(backendUrl(`/api/v1/users/${id}`), {
        schema: publicProfileSchema,
        onSessionLost,
      }),
  });
}

/**
 * 팔로우 상태.
 *
 * <p><b>`enabled`가 필요한 이유:</b> 백엔드는 자기 자신을 대상으로 한 상태 조회에 400을 낸다
 * (`FollowService.validateTarget`). 내 프로필에서는 아예 부르지 않는다.
 */
export function useFollowStatus(
  id: number,
  enabled: boolean,
  onSessionLost?: () => void,
) {
  return useQuery({
    queryKey: ["follow-status", id],
    enabled,
    queryFn: () =>
      authedRequest(backendUrl(`/api/v1/users/${id}/follow`), {
        schema: followStatusSchema,
        onSessionLost,
      }),
  });
}
```

- [ ] **Step 4: 프로필 컴포넌트를 만든다**

Create `frontend/src/features/user/components/UserProfile.tsx`:

```tsx
"use client";

import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import {
  useFollowStatus,
  useMe,
  usePublicProfile,
  type FollowStatus,
} from "@/features/user/queries";

/** 상태 넷을 문구 하나로 접는다. 화면이 boolean 셋을 직접 읽으면 조합을 빠뜨린다. */
function noticeFor(status: FollowStatus): string | null {
  if (status.mutual) return "맞팔로우 — 서로의 기록이 보입니다";
  if (status.following) return "상대도 나를 팔로우하면 서로의 기록이 보입니다";
  if (status.followedBy) return "나를 팔로우하고 있습니다";
  return null;
}

export function UserProfile({ id }: { id: number }) {
  const { ready, onSessionLost } = useRequireSession();
  const me = useMe(onSessionLost);
  const profile = usePublicProfile(id, onSessionLost);

  const isMe = me.data?.id === id;
  const status = useFollowStatus(id, ready && me.isSuccess && !isMe, onSessionLost);

  if (!ready || profile.isPending) return <Shell>{null}</Shell>;

  if (profile.error) {
    return (
      <Shell>
        <p className="text-neutral-500 dark:text-neutral-400">
          사용자를 찾을 수 없습니다
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-4">
        {profile.data.profileImageUrl !== undefined && (
          // eslint-disable-next-line @next/next/no-img-element -- 카카오 CDN은 next/image 설정 밖이다
          <img
            src={profile.data.profileImageUrl}
            alt=""
            className="size-16 rounded-full object-cover"
          />
        )}
        <h1 className="text-2xl font-bold">{profile.data.nickname}</h1>
      </div>

      {isMe ? (
        <p className="text-neutral-500 dark:text-neutral-400">나</p>
      ) : (
        status.isSuccess && <FollowSection id={id} status={status.data} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-col gap-5 px-4 py-6">{children}</main>;
}
```

**`FollowSection`은 Task 4에서 만든다.** 이 태스크에서는 버튼과 문구만 그리는 최소판을 같은 파일에 둔다:

```tsx
function FollowSection({ id, status }: { id: number; status: FollowStatus }) {
  const notice = noticeFor(status);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="rounded-lg bg-neutral-900 px-4 py-3 text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        {status.following ? "팔로우 취소" : "팔로우"}
      </button>
      {notice !== null && (
        <p className="text-neutral-500 dark:text-neutral-400">{notice}</p>
      )}
    </div>
  );
}
```

> `id`는 이 태스크에서 쓰지 않지만 시그니처에 둔다 — Task 4가 곧 쓴다. 린트가 미사용 인자를 잡으면 Task 4까지 `void id;` 한 줄로 넘긴다.

- [ ] **Step 5: 라우트를 만든다**

Create `frontend/src/app/u/[id]/page.tsx`:

```tsx
import { UserProfile } from "@/features/user/components/UserProfile";

/** Next 16에서 params는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다. */
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <UserProfile id={Number(id)} />;
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test u/`
Expected: PASS, 7 tests.

- [ ] **Step 7: 돌연변이로 조합 순서를 확인한다**

`noticeFor`에서 `if (status.mutual)` 줄을 맨 아래로 옮긴다.
Expected: **AC-WEBFOLLOW-09만** 빨갛다(맞팔로우인데 `상대도 나를 팔로우하면…`이 나온다). 되돌린다.

- [ ] **Step 8: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/src
git commit -m "feat(web): 초대 링크 프로필 화면 (AC-WEBFOLLOW 7개)"
```

---

## Task 4: 팔로우 버튼

**Files:**
- Modify: `frontend/src/features/user/queries.ts`
- Modify: `frontend/src/features/user/components/UserProfile.tsx`
- Modify: `frontend/src/app/u/[id]/page.test.tsx`

**Covers:** AC-WEBFOLLOW-11, 12, 13, 14, 19

**Interfaces:**
- Produces (`queries.ts`):
  ```ts
  /** 팔로우 등록·해제. 성공하면 ["follow-status", id]를 무효화해 다시 읽는다. */
  export function useToggleFollow(id: number, onSessionLost?: () => void);
  ```
  반환은 TanStack Query의 `useMutation` 결과다. `mutate({ follow: boolean })`로 부른다.
- Consumes: Task 3의 `FollowStatus`, `useFollowStatus`

- [ ] **Step 1: 실패하는 테스트 작성**

Modify `frontend/src/app/u/[id]/page.test.tsx` — 파일 끝에 더한다.

```tsx
it("AC-WEBFOLLOW-11 · 팔로우하면 버튼이 바뀐다", async () => {
  let followed = false;
  let posts = 0;
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ following: followed })),
    ),
    http.post("*/api/v1/users/12/follow", () => {
      posts += 1;
      followed = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderProfile(12);
  await userEvent.click(await screen.findByRole("button", { name: "팔로우" }));

  expect(await screen.findByRole("button", { name: "팔로우 취소" })).toBeInTheDocument();
  expect(posts).toBe(1);
});

it("AC-WEBFOLLOW-12 · 응답 전에는 버튼을 누를 수 없다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () => HttpResponse.json(status({}))),
    // 영영 응답하지 않는다 — disabled 상태를 붙잡아 두려는 것이다
    http.post("*/api/v1/users/12/follow", () => new Promise(() => {})),
  );

  renderProfile(12);
  const button = await screen.findByRole("button", { name: "팔로우" });
  await userEvent.click(button);

  await waitFor(() => expect(button).toBeDisabled());
});

it("AC-WEBFOLLOW-13 · 팔로우를 취소하면 버튼이 되돌아온다", async () => {
  let followed = true;
  let deletes = 0;
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ following: followed })),
    ),
    http.delete("*/api/v1/users/12/follow", () => {
      deletes += 1;
      followed = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderProfile(12);
  await userEvent.click(await screen.findByRole("button", { name: "팔로우 취소" }));

  expect(await screen.findByRole("button", { name: "팔로우" })).toBeInTheDocument();
  expect(deletes).toBe(1);
});

it("AC-WEBFOLLOW-14 · 맞팔로우가 깨지면 문구가 즉시 내려간다", async () => {
  let following = true;
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () =>
      HttpResponse.json(status({ following, followedBy: true, mutual: following })),
    ),
    http.delete("*/api/v1/users/12/follow", () => {
      following = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderProfile(12);
  expect(await screen.findByText("맞팔로우 — 서로의 기록이 보입니다")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "팔로우 취소" }));

  expect(await screen.findByText("나를 팔로우하고 있습니다")).toBeInTheDocument();
  expect(
    screen.queryByText("맞팔로우 — 서로의 기록이 보입니다"),
  ).not.toBeInTheDocument();
});

it("AC-WEBFOLLOW-19 · 팔로우가 실패하면 다시 누를 수 있다", async () => {
  server.use(
    http.get("*/api/v1/users/12", () => HttpResponse.json(friendProfile)),
    http.get("*/api/v1/users/12/follow", () => HttpResponse.json(status({}))),
    http.post("*/api/v1/users/12/follow", () =>
      HttpResponse.json(
        { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
        { status: 500 },
      ),
    ),
  );

  renderProfile(12);
  const button = await screen.findByRole("button", { name: "팔로우" });
  await userEvent.click(button);

  await waitFor(() => expect(button).not.toBeDisabled());
  expect(button).toHaveTextContent("팔로우");
  expect(await screen.findByText("서버 오류가 발생했습니다.")).toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test u/`
Expected: FAIL — 5개. 버튼에 `onClick`이 없어 아무 요청도 나가지 않는다.

- [ ] **Step 3: 뮤테이션 훅을 더한다**

Modify `frontend/src/features/user/queries.ts` — 파일 끝에 더한다.

```ts
/**
 * 팔로우 등록·해제.
 *
 * <p>낙관적 갱신을 하지 않는다 — 성공한 뒤 상태를 다시 읽어 화면을 맞춘다. 상태가 boolean 셋의
 * 조합이라 화면에서 미리 계산하면 `mutual`을 틀리게 만들기 쉽다.
 */
export function useToggleFollow(id: number, onSessionLost?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ follow }: { follow: boolean }) =>
      authedRequest(backendUrl(`/api/v1/users/${id}/follow`), {
        method: follow ? "POST" : "DELETE",
        schema: z.unknown(),
        onSessionLost,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["follow-status", id] }),
  });
}
```

import를 넓힌다: `import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";`

> **204에 본문이 없다.** `authedRequest`가 빈 본문을 어떻게 다루는지 먼저 `lib/authed-fetch.ts`를 읽는다. `response.json()`을 무조건 부르면 204에서 깨진다. 이미 다른 삭제 API(브루잉 로그)가 204를 쓰고 있으므로 **그쪽이 쓰는 방식을 그대로 따른다.**

- [ ] **Step 4: 버튼을 연결한다**

Modify `UserProfile.tsx`의 `FollowSection`:

```tsx
function FollowSection({ id, status }: { id: number; status: FollowStatus }) {
  const toggle = useToggleFollow(id);
  const notice = noticeFor(status);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ follow: !status.following })}
        className="rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {status.following ? "팔로우 취소" : "팔로우"}
      </button>
      {notice !== null && (
        <p className="text-neutral-500 dark:text-neutral-400">{notice}</p>
      )}
      {toggle.error !== null && (
        <p className="text-red-600 dark:text-red-400">{toggle.error.message}</p>
      )}
    </div>
  );
}
```

import에 `useToggleFollow`를 더한다.

> 오류 문구를 `toggle.error.message`로 그린다. 이 프로젝트의 `ApiError`가 서버 `message`를 담는지 `lib/authed-fetch.ts`에서 먼저 확인하고, 다르면 **기존 `ErrorState` 컴포넌트를 쓴다** — 문구를 새로 지어내지 않는다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test u/`
Expected: PASS, 12 tests.

- [ ] **Step 6: 전체 초록 확인**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: PASS. 단위 테스트가 283 + 14 = **297개**여야 한다(Task 2에서 2개, Task 3에서 7개, Task 4에서 5개).

- [ ] **Step 7: 스펙 status를 올린다**

Modify `docs/specs/2026-09-05-web-follow.md` — `status: 초안` → `status: 구현완료`, `plan:` 채우기.

**주의: 이 스펙의 수동 확인에는 차단형 `★`가 둘 있다**(운영에서 실제 맞팔로우, 상대 `FRIENDS` 레시피가 목록에 나타남). `docs/conventions/verification.md`는 「차단형이 하나라도 남아 있으면 `구현완료`로 올리지 않는다」이다. **둘을 밟기 전에는 올리지 않는다.** 밟을 수 없으면 `초안`으로 두고 그 사실을 스펙에 적는다.

- [ ] **Step 8: 커밋**

```bash
cd .. && ./scripts/check-spec-coverage.sh
git add frontend/src docs/specs/2026-09-05-web-follow.md
git commit -m "feat(web): 팔로우 버튼 (AC-WEBFOLLOW 5개)"
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과 — 482 + 5 = **487개**
- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — **297개**
- [ ] `cd frontend && pnpm e2e` 통과 (새 e2e는 없지만 회귀 확인)
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스키마 변경이 **0건** — `git diff --stat main...HEAD`에 `db/migration`이 없다
- [ ] 스펙 「수동 확인」 3개 완료 — **차단형 2개를 밟기 전에는 `status`를 올리지 않는다**

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC **19개** 중 **19개**가 태스크에 매핑됐다. 매핑 표와 스펙의 `#### AC-WEBFOLLOW-` 개수를 세어 대조했다.

**자리표시자 검사:** `TODO`·`TBD`·「나중에」 없음. Task 3 Step 1의 렌더 헬퍼와 Task 2 Step 1의 픽스처 id는 **기존 파일에서 베껴 오라는 지시**다 — 여기 적으면 실제와 어긋난 것을 베끼게 된다.

**타입 일관성:**
- `FollowStatus`는 Task 3에서 정의하고 Task 4의 `FollowSection`·`noticeFor`가 같은 이름으로 쓴다.
- `useFollowStatus(id, enabled, onSessionLost)`의 인자 순서가 Task 3 정의와 `UserProfile` 호출부에서 같다.
- `useToggleFollow(id).mutate({ follow })` — Task 4 안에서만 쓴다.
- 백엔드 `PublicProfileResponse(id, nickname, profileImageUrl)`와 프론트 `publicProfileSchema`의 필드 셋이 같다. **AC-WEBFOLLOW-02가 이 둘이 어긋나는 것을 잡는다.**

**검증되지 않은 가정:**
- **`/users/me`가 `/users/{id}`에 먹히지 않는가.** 스프링은 리터럴을 먼저 고르지만 확인이 필요하다. Task 1 Step 6에서 기존 `AC-ME-*`가 초록인지 보고, 빨가면 `@GetMapping("/{id:\\d+}")`로 좁힌다.
- **`authedRequest`가 204(본문 없음)를 다룰 수 있는가.** Task 4 Step 3에 「기존 삭제 API가 쓰는 방식을 따르라」고 적었다. 브루잉 로그 삭제가 이미 204를 쓰므로 선례가 있다.
- **`ApiError`가 서버 `message`를 담는가.** AC-WEBFOLLOW-19의 기대 문구가 여기 달렸다. Task 4 Step 4에서 확인하고, 아니면 기존 `ErrorState`로 바꾼다 — **문구를 지어내지 않는다.**
- **jsdom에 `navigator.clipboard`가 없다.** Task 2 Step 1이 `Object.defineProperty`로 심는다. 다른 테스트에 새지 않도록 `configurable: true`를 뒀다.
- **`useMe`가 아직 로딩 중일 때 `isMe` 판정.** `me.data?.id === id`는 로딩 중 `false`가 되어 상태 조회가 나갈 수 있다. 그래서 `enabled`에 `me.isSuccess`를 함께 걸었다. **AC-WEBFOLLOW-10이 이것을 잡는다** — `statusCalls`가 0이어야 한다.
