# 홈 달력 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-19-home-calendar.md`

**Goal:** 홈을 열면 이번 달 달력이 뜨고, 기록이 있는 날에 점이 찍히고, 날짜를 누르면 그날 기록이 나오고, 레일에서 맞팔로우인 사람을 고르면 같은 달력이 그 사람 것으로 갈아끼워진다. 390px과 1440px 양쪽에서.

**Architecture:** 백엔드에 **집계 엔드포인트 하나**(`GET /brew-logs/calendar`)와 **목록 엔드포인트 하나**(`GET /users/me/mutual-follows`)를 더하고, 기존 `GET /brew-logs`에 `date` 필터와 `overallNote`를 얹는다. 집계는 `BrewLogRepository.findVisible`의 공개범위 판정 SQL을 그대로 복사해 `GROUP BY`로 바꾼다 — 판정 로직이 두 벌이 되면 언젠가 갈라지므로 **같은 `where` 절을 쓴다**는 것을 Task 1의 제약으로 못박는다. 프론트는 달력 상태(`selectedUserId`/`selectedMonth`/`selectedDate`)를 **홈 페이지 한 곳**에 두고, 달력 그리드·레일·날짜별 목록을 상태를 받기만 하는 컴포넌트로 만든다. 모바일과 웹은 **같은 컴포넌트에 CSS 분기**다 — 컴포넌트를 두 벌 만들면 규칙이 갈라진다.

**작업 위치:** `backend/`(Task 1~3) → `frontend/`(Task 4~10)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `frontend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md` → `docs/design/design_handoff_kaldi_note/HOME-CALENDAR.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-HOMECAL-01 | 기록이 있는 날짜만 담는다 | Task 1 | API 테스트 |
| AC-HOMECAL-02 | UTC 전날 23시는 KST 다음 날 | Task 1 | API 테스트 |
| AC-HOMECAL-03 | KST 자정 경계가 15:00:00Z | Task 1 | API 테스트 |
| AC-HOMECAL-04 | 같은 날 2건이면 항목 1개 count 2 | Task 1 | API 테스트 |
| AC-HOMECAL-05 | totalCount는 그 달 전체 건수 | Task 1 | API 테스트 |
| AC-HOMECAL-06 | days는 date 오름차순 | Task 1 | API 테스트 |
| AC-HOMECAL-07 | 소프트 삭제는 집계 안 됨 | Task 1 | API 테스트 |
| AC-HOMECAL-08 | 맞팔로우의 FRIENDS가 집계됨 | Task 1 | API 테스트 |
| AC-HOMECAL-09 | 맞팔 아니면 PUBLIC만 | Task 1 | API 테스트 |
| AC-HOMECAL-10 | 없는 userId는 200 빈 결과 | Task 1 | API 테스트 |
| AC-HOMECAL-11 | month 형식 오류는 400 | Task 1 | API 테스트 |
| AC-HOMECAL-12 | 미래 달은 200 빈 결과 | Task 1 | API 테스트 |
| AC-HOMECAL-13 | 토큰 없으면 401 | Task 1 | API 테스트 |
| AC-HOMECAL-14 | userId 생략은 본인 | Task 1 | API 테스트 |
| AC-HOMECAL-66 | primaryRecipeName은 그날 마지막 기록 | Task 1 | API 테스트 |
| AC-HOMECAL-67 | 빈 날은 days에 항목 없음 | Task 1 | API 테스트 |
| AC-HOMECAL-15 | date는 KST 하루로 필터 | Task 2 | API 테스트 |
| AC-HOMECAL-16 | date와 userId는 AND | Task 2 | API 테스트 |
| AC-HOMECAL-17 | date 형식 오류는 400 | Task 2 | API 테스트 |
| AC-HOMECAL-73 | 요약에 overallNote가 담긴다 | Task 2 | API 테스트 |
| AC-HOMECAL-18 | 맞팔로우만 담긴다 | Task 3 | API 테스트 |
| AC-HOMECAL-19 | 마지막 기록 최근순 | Task 3 | API 테스트 |
| AC-HOMECAL-20 | 무기록은 맨 뒤 닉네임순 | Task 3 | API 테스트 |
| AC-HOMECAL-21 | 동률은 닉네임순 | Task 3 | API 테스트 |
| AC-HOMECAL-22 | email·role이 없다 | Task 3 | API 테스트 |
| AC-HOMECAL-23 | 자기 자신은 없다 | Task 3 | API 테스트 |
| AC-HOMECAL-24 | 토큰 없으면 401 | Task 3 | API 테스트 |
| AC-HOMECAL-53 | signal-record 토큰 값 | Task 4 | 단위 테스트 |
| AC-HOMECAL-54 | 기존 목록·상세가 KST | Task 4 | 컴포넌트 테스트 |
| AC-HOMECAL-41 | 1 BREW / 0 BREWS | Task 4 | 단위 테스트 |
| AC-HOMECAL-25 | 주 시작이 월요일 | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-26 | 2건인 날도 점 1개 | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-45 | aria-label이 건수를 말한다 | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-46 | 선택 셀에 aria-current | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-35 | 화살표 키 날짜 이동 | Task 5 | 컴포넌트 테스트 |
| AC-HOMECAL-32 | 다음 달 버튼 비활성 | Task 6 | 컴포넌트 테스트 |
| AC-HOMECAL-40 | 월 헤더 라벨 | Task 6 | 컴포넌트 테스트 |
| AC-HOMECAL-42 | 목록 헤더 문구 | Task 7 | 컴포넌트 테스트 |
| AC-HOMECAL-43 | 수율 없으면 비율 | Task 7 | 컴포넌트 테스트 |
| AC-HOMECAL-75 | roast dot 색이 다르다 | Task 7 | 컴포넌트 테스트 |
| AC-HOMECAL-76 | 원두 없으면 roast dot 없음 | Task 7 | 컴포넌트 테스트 |
| AC-HOMECAL-36 | 첫 칸이 나, 기본 선택 | Task 8 | 컴포넌트 테스트 |
| AC-HOMECAL-44 | 사진 없으면 첫 글자 | Task 8 | 컴포넌트 테스트 |
| AC-HOMECAL-47 | tablist 역할 | Task 8 | 컴포넌트 테스트 |
| AC-HOMECAL-27 | 진입 시 오늘 선택 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-28 | 날짜 탭하면 목록이 바뀐다 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-29 | 빈 날짜도 선택되고 문구 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-33 | 월 넘기면 선택 없음 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-37 | 상대 고르면 달력이 바뀐다 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-38 | 사람 바꾸면 month 유지 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-39 | 남의 달력에 관계 문구 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-50 | 프리페치로 추가 요청 없음 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-52 | 로딩 중 그리드 골격 유지 | Task 9 | 컴포넌트 테스트 |
| AC-HOMECAL-30 | 1건인 날도 상세로 안 감 | Task 9 | e2e |
| AC-HOMECAL-31 | 행 탭하면 상세로 | Task 9 | e2e |
| AC-HOMECAL-34 | 스와이프로 월 전환 | Task 9 | e2e |
| AC-HOMECAL-48 | 모바일 CTA는 레시피 선택으로 | Task 9 | e2e |
| AC-HOMECAL-49 | 저장하고 오면 점이 있다 | Task 9 | e2e |
| AC-HOMECAL-51 | 4건인 날도 달력 위치 불변 | Task 9 | e2e |
| AC-HOMECAL-57 | 759px는 모바일 | Task 9 | e2e |
| AC-HOMECAL-55 | 1100px는 2컬럼 | Task 10 | e2e |
| AC-HOMECAL-56 | 1099px는 1컬럼 | Task 10 | e2e |
| AC-HOMECAL-58 | 상단 바 6요소 | Task 10 | e2e |
| AC-HOMECAL-59 | 아바타 → /more | Task 10 | e2e |
| AC-HOMECAL-60 | 상단 CTA는 레시피 선택으로 | Task 10 | e2e |
| AC-HOMECAL-61 | 우측 CTA도 레시피 선택으로 | Task 10 | e2e |
| AC-HOMECAL-62 | 남의 달력 CTA → /u/{id} | Task 10 | e2e |
| AC-HOMECAL-63 | 셀에 대표 레시피명 | Task 10 | e2e |
| AC-HOMECAL-64 | 3건이면 외 2건 | Task 10 | e2e |
| AC-HOMECAL-65 | 1건이면 외 N건 없음 | Task 10 | e2e |
| AC-HOMECAL-68 | 6주 달도 높이 같음 | Task 10 | e2e |
| AC-HOMECAL-69 | 다른 달 칸은 배경만 | Task 10 | e2e |
| AC-HOMECAL-70 | 선택 셀에 링과 배경 | Task 10 | e2e |
| AC-HOMECAL-71 | 웹 레일은 채운 pill | Task 10 | e2e |
| AC-HOMECAL-72 | 메모 한 줄이 뜬다 | Task 10 | e2e |
| AC-HOMECAL-74 | 메모 없으면 줄 없음 | Task 10 | e2e |
| AC-HOMECAL-77 | diagnosis는 Observation | Task 10 | e2e |
| AC-HOMECAL-78 | 로고 심볼이 렌더된다 | Task 10 | e2e |
| AC-HOMECAL-79 | 우측 컬럼만 스크롤 | Task 10 | e2e |

**스펙의 AC 79개 중 79개가 매핑됐다.**

---

## Global Constraints

- **★ 공개범위 판정 SQL을 두 벌로 만들지 않는다.** Task 1의 집계 쿼리는 `BrewLogRepository.findVisible`의 `where` 절을 **문자 그대로 같게** 유지한다. 한쪽만 고치면 「목록에는 보이는데 달력에는 점이 없다」가 된다. 두 쿼리가 같은 파일에 나란히 있게 두고, 주석으로 서로를 가리킨다.
- **★ KST 오프셋을 상수 한 곳에만 둔다.** 백엔드는 `ZoneOffset.ofHours(9)`를 `BrewLogCalendarQuery`에, 프론트는 `KST_OFFSET_MINUTES = 540`을 `frontend/src/lib/kstDate.ts`에 둔다. 두 곳 이상에 리터럴 `9`나 `540`을 적지 않는다.
- **적용된 마이그레이션을 수정하지 않는다.** 이 계획은 **스키마를 바꾸지 않는다** — 새 마이그레이션 파일도 만들지 않는다.
- **`BrewLogService.list`의 기존 시그니처를 깨지 않는다.** Task 2에서 `date` 파라미터를 더할 때 기존 호출부(`BrewLogController.list`)를 함께 고친다. 오버로드를 만들지 않는다 — 어느 쪽이 쓰이는지 모호해진다.
- **`FollowService`·`FollowController`를 고치지 않는다.** Task 3은 `FollowRepository`에 쿼리 메서드를 **추가**하고 `UserService`에서 부른다.
- **`double` 금지.** 이 계획에 새로 생기는 수치는 `count`(정수)뿐이다. `BigDecimal`이 필요한 자리는 없다.
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- **`Write` 전에 파일이 있는지 본다.** 2026-09-02에 계획이 `Create`로 적은 파일이 이미 있어 기존 테스트 11개를 덮어썼다.
- **픽스처는 실제 응답에서 뜬다.** Task 1~3을 먼저 끝내고, Task 4 이후의 프론트 픽스처는 **로컬에서 실제로 호출한 응답**을 붙여 넣는다. 지어낸 픽스처는 코드가 아니라 내 가정을 검증한다(`docs/conventions/frontend.md`).
- 백엔드 커밋 전 `./gradlew spotlessApply && ./gradlew clean check`. 프론트 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- **태스크마다 초록인 상태로 끝낸다.** 다음 태스크로 넘어가기 전에 검증 명령을 실제로 돌리고 출력을 확인한다.

---

## File Structure

```
backend/src/
├── main/java/com/kaldinote/
│   ├── brewlog/
│   │   ├── application/BrewLogService.java                    Modify — calendar(), list()에 date
│   │   ├── domain/CalendarMonth.java                          Create — YYYY-MM 파싱·KST 경계
│   │   ├── infrastructure/BrewLogRepository.java              Modify — countByDay, findVisible에 date
│   │   ├── presentation/BrewLogController.java                Modify — GET /calendar, date 파라미터
│   │   └── presentation/dto/
│   │       ├── BrewLogCalendarResponse.java                   Create
│   │       ├── CalendarDayResponse.java                       Create
│   │       └── BrewLogSummaryResponse.java                    Modify — overallNote
│   └── user/
│       ├── application/UserService.java                       Modify — mutualFollows()
│       ├── infrastructure/FollowRepository.java               Modify — findMutualFollows
│       └── presentation/UserController.java                   Modify — GET /me/mutual-follows
└── test/java/com/kaldinote/
    ├── brewlog/
    │   ├── domain/CalendarMonthTest.java                      Create — 경계 단위 테스트
    │   └── presentation/BrewLogCalendarControllerTest.java    Create — AC 16개
    ├── brewlog/presentation/BrewLogControllerTest.java        Modify — AC 4개
    └── user/presentation/MutualFollowControllerTest.java      Create — AC 7개

frontend/src/
├── app/
│   ├── globals.css                                           Modify — --signal-record
│   ├── page.tsx                                              Replace — 달력 홈
│   └── page.test.tsx                                         Replace — AC 10개
├── components/
│   ├── layout/WebTopBar.tsx                                  Create — 웹 상단 바
│   └── layout/WebTopBar.test.tsx                             Create
├── features/calendar/
│   ├── api.ts                                                Create — 달력·맞팔로우 조회
│   ├── schema.ts                                             Create
│   ├── monthGrid.ts                                          Create — 월요일 시작 격자 계산
│   ├── monthGrid.test.ts                                     Create
│   ├── brewCountLabel.ts                                     Create — N BREWS
│   ├── brewCountLabel.test.ts                                Create — AC-41
│   └── components/
│       ├── Calendar.tsx / Calendar.test.tsx                  Create — AC 25·26·35·45·46
│       ├── MonthNav.tsx / MonthNav.test.tsx                  Create — AC 32·40
│       ├── DayList.tsx / DayList.test.tsx                    Create — AC 42·43·76
│       ├── FollowRail.tsx / FollowRail.test.tsx              Create — AC 36·44·47
│       └── RoastDot.tsx / RoastDot.test.tsx                  Create — AC 75
├── lib/
│   ├── kstDate.ts                                            Create — KST 날짜 변환
│   ├── kstDate.test.ts                                       Create
│   └── tokens.test.ts                                        Create — AC-53
└── features/brewlog/components/
    ├── BrewLogCard.tsx                                       Modify — KST (AC-54)
    └── BrewDetail.tsx                                        Modify — KST (AC-54)

frontend/e2e/
├── home-calendar.spec.ts                                     Create — AC 30·31·34·48·49·51·57
├── home-calendar-web.spec.ts                                 Create — AC 55·56·58~65·68~72·74·77~79
└── stubs.ts                                                  Modify — 달력·맞팔로우 핸들러

docs/specs/2026-09-19-home-calendar.md                        Modify — status, plan
```

---

## Task 1: 달력 집계 API

**Files:**
- Create: `backend/src/main/java/com/kaldinote/brewlog/domain/CalendarMonth.java`
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogCalendarResponse.java`
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/CalendarDayResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Create: `backend/src/test/java/com/kaldinote/brewlog/domain/CalendarMonthTest.java`
- Create: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogCalendarControllerTest.java`

**Covers:** AC-HOMECAL-01~14, 66, 67

**Interfaces:**
- Produces: `GET /api/v1/brew-logs/calendar?userId=&month=` → `BrewLogCalendarResponse(String month, long totalCount, List<CalendarDayResponse> days)`
- Produces: `CalendarDayResponse(LocalDate date, long count, String primaryRecipeName)`
- Produces: `CalendarMonth.parse(String): CalendarMonth` — 형식 오류면 `BusinessException(INVALID_REQUEST)`
- Produces: `CalendarMonth.startInclusive(): Instant`, `CalendarMonth.endExclusive(): Instant` — KST 달의 양끝을 UTC 순간으로
- Produces: `BrewLogService.calendar(Long viewerId, Long userId, String month): BrewLogCalendarResponse`

> **집계를 SQL 한 방으로 한다.** 그 달 기록을 전부 읽어 자바에서 묶으면 한 달치 행을 메모리에 올린다. OCI 2 OCPU/12GB에서 지금은 문제가 아니지만, `GROUP BY`로 쓰는 비용이 더 싸다.

> **`primaryRecipeName`을 같은 쿼리에서 못 가져온다.** `GROUP BY date`와 「그 그룹에서 `brewedAt`이 최대인 행의 레시피명」은 윈도 함수가 필요하다. JPQL이 윈도 함수를 지원하지 않으므로 **쿼리를 둘로 나눈다** — ①날짜별 `count`, ②날짜별 대표 `brewLogId`. ②는 `brewedAt DESC, id DESC`로 정렬한 그 달 기록의 `id`·`recipeId`·`brewedAt`만 뽑아 자바에서 날짜별 첫 항목을 고른다. 한 달치 **경량 프로젝션**이라 엔티티 전체를 올리지 않는다.

- [ ] **Step 1: 시작 전 초록을 확인한다**

Run: `docker compose up -d && cd backend && ./gradlew clean check`
Expected: PASS. **테스트 개수를 적어둔다.**

- [ ] **Step 2: `CalendarMonth` 실패 테스트 작성**

Create `backend/src/test/java/com/kaldinote/brewlog/domain/CalendarMonthTest.java`:

```java
package com.kaldinote.brewlog.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.common.error.BusinessException;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CalendarMonthTest {

  @Test
  @DisplayName("KST 9월의 시작은 UTC 8월 31일 15시다")
  void 시작_경계는_전날_15시다() {
    CalendarMonth month = CalendarMonth.parse("2026-09");

    assertThat(month.startInclusive()).isEqualTo(Instant.parse("2026-08-31T15:00:00Z"));
    assertThat(month.endExclusive()).isEqualTo(Instant.parse("2026-09-30T15:00:00Z"));
  }

  @Test
  @DisplayName("AC-HOMECAL-11 · month 형식이 틀리면 INVALID_REQUEST다")
  void 형식이_틀리면_거부한다() {
    assertThatThrownBy(() -> CalendarMonth.parse("2026-13"))
        .isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> CalendarMonth.parse("26-09")).isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> CalendarMonth.parse(null)).isInstanceOf(BusinessException.class);
  }
}
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*CalendarMonthTest'`
Expected: FAIL — `CalendarMonth` 클래스가 없어 컴파일되지 않는다.

- [ ] **Step 4: `CalendarMonth` 최소 구현**

```java
package com.kaldinote.brewlog.domain;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;

/**
 * 달력이 다루는 「KST 기준의 한 달」.
 *
 * <p><b>오프셋을 여기 한 곳에만 둔다.</b> 한국은 서머타임이 없어 언제나 +9다. 값을 두 곳에 적으면
 * 언젠가 한쪽만 고쳐져 달력과 목록의 날짜가 갈라진다.
 */
public record CalendarMonth(YearMonth value) {

  public static final ZoneOffset KST = ZoneOffset.ofHours(9);

  public static CalendarMonth parse(String raw) {
    if (raw == null) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "month는 필수입니다: YYYY-MM");
    }
    try {
      return new CalendarMonth(YearMonth.parse(raw));
    } catch (DateTimeParseException e) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "month는 YYYY-MM 형식이어야 합니다: " + raw);
    }
  }

  /** KST 그 달 1일 00:00을 UTC 순간으로. */
  public Instant startInclusive() {
    return value.atDay(1).atStartOfDay(KST).toInstant();
  }

  /** KST 다음 달 1일 00:00을 UTC 순간으로. 상한은 제외다. */
  public Instant endExclusive() {
    return value.plusMonths(1).atDay(1).atStartOfDay(KST).toInstant();
  }

  /** UTC 순간을 KST 날짜로. 집계 결과를 날짜로 묶을 때 쓴다. */
  public static LocalDate toKstDate(Instant instant) {
    return instant.atOffset(KST).toLocalDate();
  }

  public String format() {
    return value.toString();
  }
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*CalendarMonthTest'`
Expected: PASS, 2 tests

- [ ] **Step 6: 리포지토리 집계 쿼리 추가**

Modify `BrewLogRepository.java` — **기존 `findVisible`을 고치지 않는다.** 아래 둘을 더하고, `findVisible` 위에 주석으로 서로를 가리킨다.

```java
  /**
   * 달력 집계 — 날짜별 건수.
   *
   * <p><b>★ where 절이 {@link #findVisible} 과 문자 그대로 같아야 한다.</b> 한쪽만 고치면 「목록에는
   * 보이는데 달력에는 점이 없다」가 된다. 고칠 일이 생기면 두 쿼리를 함께 고친다.
   *
   * <p>KST 날짜로 묶는다 — {@code brewed_at}은 TIMESTAMPTZ(UTC)이고, 한국 시간 아침에 내린 기록은
   * UTC로 전날이다.
   */
  @Query(
      value =
          """
          select cast((b.brewed_at at time zone 'Asia/Seoul') as date) as day, count(*) as cnt
          from brew_logs b
          where b.deleted_at is null
            and b.brewed_at >= :startInclusive
            and b.brewed_at < :endExclusive
            and (:userId is null or b.user_id = :userId)
            and ( b.user_id = :viewerId
               or b.visibility = 'PUBLIC'
               or ( b.visibility = 'FRIENDS'
                    and exists (select 1 from follows f1
                                where f1.follower_user_id = :viewerId
                                  and f1.followee_user_id = b.user_id)
                    and exists (select 1 from follows f2
                                where f2.follower_user_id = b.user_id
                                  and f2.followee_user_id = :viewerId) ) )
          group by day
          order by day asc
          """,
      nativeQuery = true)
  List<DayCountRow> countByKstDay(
      @Param("viewerId") Long viewerId,
      @Param("userId") Long userId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive);

  /** 대표 레시피명을 고르기 위한 경량 프로젝션. 정렬만 서버가 하고 날짜별 첫 항목은 자바가 고른다. */
  @Query(
      """
      select b.brewedAt as brewedAt, b.recipeId as recipeId
      from BrewLog b
      where b.deletedAt is null
        and b.brewedAt >= :startInclusive
        and b.brewedAt < :endExclusive
        and (:userId is null or b.userId = :userId)
        and ( b.userId = :viewerId
           or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
           or ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS
                and exists (select 1 from Follow f1
                            where f1.followerUserId = :viewerId
                              and f1.followeeUserId = b.userId)
                and exists (select 1 from Follow f2
                            where f2.followerUserId = b.userId
                              and f2.followeeUserId = :viewerId) ) )
      order by b.brewedAt desc, b.id desc
      """)
  List<PrimaryRecipeRow> findVisibleForPrimaryRecipe(
      @Param("viewerId") Long viewerId,
      @Param("userId") Long userId,
      @Param("startInclusive") Instant startInclusive,
      @Param("endExclusive") Instant endExclusive);

  interface DayCountRow {
    LocalDate getDay();

    long getCnt();
  }

  interface PrimaryRecipeRow {
    Instant getBrewedAt();

    Long getRecipeId();
  }
```

> **네이티브 쿼리를 쓰는 이유:** JPQL에는 타임존 변환 함수가 없다. `at time zone`은 PostgreSQL 문법이고, 테스트가 Testcontainers의 실제 PostgreSQL에서 돌므로 H2 호환을 고려할 필요가 없다.

> **`:userId is null` 비교가 네이티브에서 타입 추론에 걸릴 수 있다.** 실패하면 `cast(:userId as bigint)`로 감싼다 — 이때도 **조건의 의미는 바꾸지 않는다.**

- [ ] **Step 7: DTO 둘 생성**

```java
// CalendarDayResponse.java
package com.kaldinote.brewlog.presentation.dto;

import java.time.LocalDate;

/** 달력의 한 칸. 기록이 있는 날만 만들어진다 — 빈 날은 항목 자체가 없다(AC-HOMECAL-67). */
public record CalendarDayResponse(LocalDate date, long count, String primaryRecipeName) {}
```

```java
// BrewLogCalendarResponse.java
package com.kaldinote.brewlog.presentation.dto;

import java.util.List;

/**
 * 한 달치 기록일 집계.
 *
 * <p>{@code days}는 희소 배열이다 — date 오름차순이고 기록이 없는 날은 담기지 않는다.
 * {@code totalCount}는 {@code days[*].count}의 합과 같다.
 */
public record BrewLogCalendarResponse(
    String month, long totalCount, List<CalendarDayResponse> days) {}
```

- [ ] **Step 8: 서비스 메서드 구현**

Modify `BrewLogService.java` — `list` 아래에 더한다. `RecipeRepository`는 이미 주입돼 있다.

```java
  /**
   * 달력 집계. 공개범위 판정은 목록과 같은 규칙이다 — 볼 수 없는 대상을 가리켜도 403이 아니라 빈 결과다.
   *
   * <p>userId가 null이면 호출자 본인의 달력이다(AC-HOMECAL-14).
   */
  public BrewLogCalendarResponse calendar(Long viewerId, Long userId, String rawMonth) {
    CalendarMonth month = CalendarMonth.parse(rawMonth);
    Instant start = month.startInclusive();
    Instant end = month.endExclusive();

    Map<LocalDate, Long> counts = new LinkedHashMap<>();
    for (BrewLogRepository.DayCountRow row :
        brewLogRepository.countByKstDay(viewerId, userId, start, end)) {
      counts.put(row.getDay(), row.getCnt());
    }

    Map<LocalDate, String> primaryNames = primaryRecipeNames(viewerId, userId, start, end);

    List<CalendarDayResponse> days =
        counts.entrySet().stream()
            .map(e -> new CalendarDayResponse(e.getKey(), e.getValue(), primaryNames.get(e.getKey())))
            .toList();

    long total = days.stream().mapToLong(CalendarDayResponse::count).sum();
    return new BrewLogCalendarResponse(month.format(), total, days);
  }

  /**
   * 날짜별 대표 레시피명. 쿼리가 brewedAt 내림차순이므로 **각 날짜에 처음 나타나는 행**이 그날 마지막
   * 기록이다(AC-HOMECAL-66).
   */
  private Map<LocalDate, String> primaryRecipeNames(
      Long viewerId, Long userId, Instant start, Instant end) {
    Map<LocalDate, Long> firstRecipeIdByDay = new LinkedHashMap<>();
    for (BrewLogRepository.PrimaryRecipeRow row :
        brewLogRepository.findVisibleForPrimaryRecipe(viewerId, userId, start, end)) {
      firstRecipeIdByDay.putIfAbsent(CalendarMonth.toKstDate(row.getBrewedAt()), row.getRecipeId());
    }
    if (firstRecipeIdByDay.isEmpty()) {
      return Map.of();
    }

    Map<Long, String> titles =
        recipeRepository.findAllById(Set.copyOf(firstRecipeIdByDay.values())).stream()
            .collect(Collectors.toMap(Recipe::getId, Recipe::getTitle));

    Map<LocalDate, String> result = new LinkedHashMap<>();
    firstRecipeIdByDay.forEach(
        (day, recipeId) -> {
          String title = titles.get(recipeId);
          if (title != null) {
            result.put(day, title);
          }
        });
    return result;
  }
```

> **레시피 제목을 `findAllById`로 한 번에 읽는다.** 날짜마다 `findById`를 부르면 한 달에 최대 31회다. 삭제된 레시피는 `titles`에 없어 `primaryRecipeName`이 null이 되고, `non_null` 직렬화라 키가 빠진다 — 웹 셀은 그 줄을 그리지 않는다.

- [ ] **Step 9: 컨트롤러 엔드포인트 추가**

Modify `BrewLogController.java` — **`@GetMapping("/{id}")`보다 위에 둔다.** 리터럴이 템플릿보다 먼저 매칭되지만, 순서를 눈으로도 분명히 해 둔다.

```java
  @GetMapping("/calendar")
  @Operation(
      summary = "월별 기록일 집계",
      description =
          "KST 기준으로 그 달에 기록이 있는 날짜만 희소 배열로 준다. 공개범위 판정은 목록과 같다. 미래 달도 400이 아니라 빈 결과다.")
  public BrewLogCalendarResponse calendar(
      @Parameter(description = "누구의 달력인가. 생략하면 호출자 본인.") @RequestParam(required = false)
          Long userId,
      @Parameter(description = "YYYY-MM. KST 기준의 달.", required = true) @RequestParam(required = false)
          String month,
      AuthenticatedUser user) {
    return brewLogService.calendar(user.id(), userId, month);
  }
```

> **`required = false`인데 필수인 이유:** 스프링이 던지는 `MissingServletRequestParameterException`은 `GlobalExceptionHandler`의 매핑에 따라 다른 `code`가 나올 수 있다. `CalendarMonth.parse(null)`이 `INVALID_REQUEST`를 던지게 해 **AC-HOMECAL-11과 같은 경로**로 모은다.

- [ ] **Step 10: API 테스트 작성 — AC 16개**

Create `BrewLogCalendarControllerTest.java`. 기존 `BrewLogControllerTest`의 셋업(Testcontainers·`@SpringBootTest`·토큰 발급)을 그대로 따른다.

```java
  @Test
  @DisplayName("AC-HOMECAL-02 · UTC 전날 23시 기록은 KST 다음 날에 집계된다")
  void 자정_전_기록은_다음날에_집계된다() throws Exception {
    Long me = 로그인한_사용자();
    기록을_남긴다(me, Instant.parse("2026-09-18T23:00:00Z"));

    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-09").header(AUTH, 토큰(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-19"));
  }

  @Test
  @DisplayName("AC-HOMECAL-03 · KST 자정 경계가 15:00:00Z에서 갈린다")
  void 경계는_15시에_갈린다() throws Exception {
    Long me = 로그인한_사용자();
    기록을_남긴다(me, Instant.parse("2026-09-19T14:59:59Z"));
    기록을_남긴다(me, Instant.parse("2026-09-19T15:00:00Z"));

    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-09").header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-19"))
        .andExpect(jsonPath("$.days[0].count").value(1))
        .andExpect(jsonPath("$.days[1].date").value("2026-09-20"))
        .andExpect(jsonPath("$.days[1].count").value(1));
  }

  @Test
  @DisplayName("AC-HOMECAL-66 · primaryRecipeName은 그날 가장 늦게 내린 기록의 레시피명이다")
  void 대표_레시피는_그날_마지막_기록이다() throws Exception {
    Long me = 로그인한_사용자();
    Long v60 = 레시피를_만든다(me, "Hoffmann V60");
    Long kasuya = 레시피를_만든다(me, "Kasuya 4:6");
    기록을_남긴다(me, v60, Instant.parse("2026-09-04T23:00:00Z")); // KST 09-05 08:00
    기록을_남긴다(me, kasuya, Instant.parse("2026-09-05T05:00:00Z")); // KST 09-05 14:00

    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-09").header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$.days[0].primaryRecipeName").value("Kasuya 4:6"));
  }

  @Test
  @DisplayName("AC-HOMECAL-09 · 맞팔로우가 아니면 PUBLIC만 집계된다")
  void 맞팔이_아니면_공개만_보인다() throws Exception {
    Long me = 로그인한_사용자();
    Long other = 다른_사용자();
    기록을_남긴다(other, Instant.parse("2026-09-05T01:00:00Z"), BrewLogVisibility.PUBLIC);
    기록을_남긴다(other, Instant.parse("2026-09-06T01:00:00Z"), BrewLogVisibility.FRIENDS);
    기록을_남긴다(other, Instant.parse("2026-09-07T01:00:00Z"), BrewLogVisibility.PRIVATE);

    mockMvc
        .perform(
            get("/api/v1/brew-logs/calendar")
                .param("userId", String.valueOf(other))
                .param("month", "2026-09")
                .header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$.totalCount").value(1))
        .andExpect(jsonPath("$.days.length()").value(1))
        .andExpect(jsonPath("$.days[0].date").value("2026-09-05"));
  }

  @Test
  @DisplayName("AC-HOMECAL-10 · 존재하지 않는 userId는 200과 빈 결과다")
  void 없는_사용자는_빈_결과다() throws Exception {
    Long me = 로그인한_사용자();

    mockMvc
        .perform(
            get("/api/v1/brew-logs/calendar")
                .param("userId", "999999")
                .param("month", "2026-09")
                .header(AUTH, 토큰(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.days.length()").value(0))
        .andExpect(jsonPath("$.totalCount").value(0));
  }

  @Test
  @DisplayName("AC-HOMECAL-11 · month 형식이 틀리면 400이다")
  void 형식이_틀리면_사백이다() throws Exception {
    Long me = 로그인한_사용자();

    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-13").header(AUTH, 토큰(me)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-HOMECAL-13 · 토큰이 없으면 401이다")
  void 토큰이_없으면_사백일이다() throws Exception {
    mockMvc
        .perform(get("/api/v1/brew-logs/calendar").param("month", "2026-09"))
        .andExpect(status().isUnauthorized());
  }
```

나머지 AC-01·04·05·06·07·08·12·14·67도 같은 형태로 더한다. **`@DisplayName`에 AC ID를 반드시 남긴다** — `check-spec-coverage.sh`가 이걸로 찾는다.

- [ ] **Step 11: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogCalendarControllerTest' --tests '*CalendarMonthTest'`
Expected: PASS, 18 tests (API 16 + 단위 2)

- [ ] **Step 12: 전체 검증 후 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 달력 집계 API (AC-HOMECAL-01~14·66~67)"
```

---

## Task 2: 날짜 필터와 overallNote

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogSummaryResponse.java`
- Modify: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-HOMECAL-15, 16, 17, 73

**Interfaces:**
- Consumes: `CalendarMonth.KST` (Task 1)
- Produces: `GET /api/v1/brew-logs?date=YYYY-MM-DD` — 기존 필터 셋과 `AND`
- Produces: `BrewLogSummaryResponse`에 `String overallNote` 필드 추가 (**레코드의 마지막 컴포넌트**)
- Produces: `BrewLogService.list(Long viewerId, Long recipeId, Long userId, Long beanBatchId, LocalDate date, PageParams params)` — **기존 5인자 시그니처를 대체한다. 오버로드하지 않는다.**

> **`date`를 `Instant` 범위로 바꿔 넘긴다.** `findVisible`에 `at time zone`을 넣으면 인덱스(`idx_brew_logs_alive`)를 못 탄다. 컨트롤러에서 `LocalDate`를 받아 서비스가 `[startInclusive, endExclusive)`로 바꾼다 — Task 1의 `CalendarMonth`와 같은 방식이다.

- [ ] **Step 1: 실패하는 테스트 작성**

Modify `BrewLogControllerTest.java` — 기존 테스트는 건드리지 않고 더한다.

```java
  @Test
  @DisplayName("AC-HOMECAL-15 · date는 KST 기준 하루로 필터한다")
  void date는_KST_하루로_거른다() throws Exception {
    Long me = 로그인한_사용자();
    기록을_남긴다(me, Instant.parse("2026-09-18T23:00:00Z")); // KST 09-19
    기록을_남긴다(me, Instant.parse("2026-09-19T14:59:59Z")); // KST 09-19
    기록을_남긴다(me, Instant.parse("2026-09-19T15:00:00Z")); // KST 09-20

    mockMvc
        .perform(get("/api/v1/brew-logs").param("date", "2026-09-19").header(AUTH, 토큰(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
  }

  @Test
  @DisplayName("AC-HOMECAL-17 · date 형식이 틀리면 400이다")
  void date_형식이_틀리면_사백이다() throws Exception {
    Long me = 로그인한_사용자();

    mockMvc
        .perform(get("/api/v1/brew-logs").param("date", "2026-9-19").header(AUTH, 토큰(me)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-HOMECAL-73 · 목록 요약 응답에 overallNote가 담긴다")
  void 요약에_메모가_담긴다() throws Exception {
    Long me = 로그인한_사용자();
    메모가_있는_기록을_남긴다(me, "산미가 강했다");

    mockMvc
        .perform(get("/api/v1/brew-logs").header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$.content[0].overallNote").value("산미가 강했다"));
  }
```

AC-HOMECAL-16(date + userId AND)도 같은 형태로 더한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `date` 파라미터가 무시돼 `content.length()`가 3이고, `overallNote` 경로가 없다.

- [ ] **Step 3: 최소 구현**

1. `BrewLogSummaryResponse`에 `String overallNote`를 **마지막 컴포넌트로** 더하고 `from`에 `log.getOverallNote()`를 넘긴다. 클래스 주석의 「`overallNote`만 뺐다」를 고친다 — **틀린 주석을 남겨두지 않는다.**
2. `findVisible`에 `:startInclusive`/`:endExclusive` 조건을 더한다 (`:startInclusive is null or b.brewedAt >= :startInclusive` 형태, `countQuery`에도 **같이**).
3. `BrewLogService.list`에 `LocalDate date`를 받아 `date == null ? null : date.atStartOfDay(CalendarMonth.KST).toInstant()`로 바꾼다.
4. 컨트롤러에 `@RequestParam(required = false) String date`를 받아 파싱한다. `DateTimeParseException`을 `BusinessException(INVALID_REQUEST)`로 바꾼다 — **`@DateTimeFormat`을 쓰지 않는다.** 그쪽은 `MethodArgumentTypeMismatchException`이 나서 `code`가 달라진다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS. **기존 테스트도 전부 통과해야 한다** — `list` 시그니처를 바꿨으므로 호출부 누락이 있으면 여기서 잡힌다.

- [ ] **Step 5: 전체 검증 후 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 날짜 필터와 요약의 메모 (AC-HOMECAL-15~17·73)"
```

---

## Task 3: 맞팔로우 목록 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/user/infrastructure/FollowRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/user/application/UserService.java`
- Modify: `backend/src/main/java/com/kaldinote/user/presentation/UserController.java`
- Create: `backend/src/test/java/com/kaldinote/user/presentation/MutualFollowControllerTest.java`

**Covers:** AC-HOMECAL-18~24

**Interfaces:**
- Produces: `GET /api/v1/users/me/mutual-follows` → `List<PublicProfileResponse>` (**페이지 봉투가 아니라 배열**)
- Produces: `UserService.mutualFollows(Long viewerId): List<PublicProfileResponse>`
- Consumes: `PublicProfileResponse` (기존, 그대로 재사용 — AC-HOMECAL-22가 `email`·`role` 부재를 잡는다)

> **경로 충돌 없음.** `/users/me/mutual-follows`는 `/users` 뒤에 세그먼트가 둘이고 `@GetMapping("/{id}")`는 하나다. 매칭되지 않는다.

> **정렬을 SQL에서 끝낸다.** 자바에서 정렬하면 「볼 수 있는 기록의 마지막 시각」을 사람마다 따로 세게 된다. `left join`과 `max()`로 한 번에 낸다 — **무기록자가 빠지면 안 되므로 `left join`이다.**

- [ ] **Step 1: 실패하는 테스트 작성**

Create `MutualFollowControllerTest.java`:

```java
  @Test
  @DisplayName("AC-HOMECAL-18 · 맞팔로우인 사람만 담긴다")
  void 맞팔로우만_담는다() throws Exception {
    Long me = 로그인한_사용자();
    Long mutual = 다른_사용자("지연");
    Long onlyIFollow = 다른_사용자("민재");
    Long onlyFollowsMe = 다른_사용자("하은");
    맞팔로우를_맺는다(me, mutual);
    팔로우한다(me, onlyIFollow);
    팔로우한다(onlyFollowsMe, me);

    mockMvc
        .perform(get("/api/v1/users/me/mutual-follows").header(AUTH, 토큰(me)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].id").value(mutual));
  }

  @Test
  @DisplayName("AC-HOMECAL-20 · 기록이 없는 맞팔로우는 맨 뒤에 닉네임 오름차순으로 놓인다")
  void 무기록자는_맨_뒤에_이름순이다() throws Exception {
    Long me = 로그인한_사용자();
    Long 지연 = 맞팔로우_사용자("지연");
    Long 하은 = 맞팔로우_사용자("하은");
    Long 민재 = 맞팔로우_사용자("민재");
    기록을_남긴다(지연, Instant.parse("2026-09-10T01:00:00Z"), BrewLogVisibility.FRIENDS);

    mockMvc
        .perform(get("/api/v1/users/me/mutual-follows").header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$[0].id").value(지연))
        .andExpect(jsonPath("$[1].id").value(민재))
        .andExpect(jsonPath("$[2].id").value(하은));
  }

  @Test
  @DisplayName("AC-HOMECAL-22 · 응답에 email과 role이 없다")
  void 이메일과_역할을_안_내보낸다() throws Exception {
    Long me = 로그인한_사용자();
    맞팔로우_사용자("지연");

    mockMvc
        .perform(get("/api/v1/users/me/mutual-follows").header(AUTH, 토큰(me)))
        .andExpect(jsonPath("$[0].email").doesNotExist())
        .andExpect(jsonPath("$[0].role").doesNotExist())
        .andExpect(jsonPath("$[0].createdAt").doesNotExist());
  }
```

AC-19·21·23·24도 같은 형태로 더한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*MutualFollowControllerTest'`
Expected: FAIL — 404. 엔드포인트가 없다.

- [ ] **Step 3: 리포지토리 쿼리 추가**

```java
  /**
   * 맞팔로우인 사용자를, 호출자가 볼 수 있는 그 사람 기록의 마지막 시각이 최근인 순으로.
   *
   * <p><b>left join인 이유:</b> 기록이 한 건도 없는 맞팔로우도 레일에 나타나야 한다(AC-HOMECAL-20).
   * inner join이면 그 사람이 통째로 빠진다.
   *
   * <p>정렬 3단: ①마지막 기록 내림차순 → ②무기록자는 뒤(nulls last) → ③닉네임 오름차순.
   * ③이 없으면 PostgreSQL이 순서를 보장하지 않아 레일 순서가 요청마다 달라진다(AC-HOMECAL-21).
   */
  @Query(
      """
      select u, max(b.brewedAt) as lastBrewedAt
      from User u
        join Follow f1 on f1.followerUserId = :viewerId and f1.followeeUserId = u.id
        join Follow f2 on f2.followerUserId = u.id and f2.followeeUserId = :viewerId
        left join BrewLog b
          on b.userId = u.id
         and b.deletedAt is null
         and ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
            or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS )
      where u.id <> :viewerId
      group by u
      order by max(b.brewedAt) desc nulls last, u.nickname asc
      """)
  List<Object[]> findMutualFollowsOrderedByLastBrew(@Param("viewerId") Long viewerId);
```

> **`u.id <> :viewerId`가 AC-HOMECAL-23이다.** 자기 자신을 팔로우하는 행은 `FollowService.validateTarget`이 막고 있어 생기지 않지만, 방어적으로 둔다.

> **`b.visibility` 조건에 `PRIVATE`이 없다.** 맞팔로우 사이에서 볼 수 있는 것은 `PUBLIC`과 `FRIENDS`뿐이다. 정렬 기준이 「볼 수 있는 기록」이므로 상대의 `PRIVATE` 기록이 순서를 바꾸면 안 된다.

- [ ] **Step 4: 서비스와 컨트롤러**

```java
  /** 레일에 세울 맞팔로우 목록. 페이지 봉투가 아니라 배열이다 — 페이지네이션이 필요한 규모가 아니다. */
  public List<PublicProfileResponse> mutualFollows(Long viewerId) {
    return followRepository.findMutualFollowsOrderedByLastBrew(viewerId).stream()
        .map(row -> PublicProfileResponse.from((User) row[0]))
        .toList();
  }
```

```java
  @GetMapping("/me/mutual-follows")
  @Operation(summary = "맞팔로우 목록", description = "마지막 기록이 최근인 순. 무기록자는 맨 뒤에 닉네임 오름차순.")
  public List<PublicProfileResponse> mutualFollows(AuthenticatedUser user) {
    return userService.mutualFollows(user.id());
  }
```

`UserService`에 `FollowRepository`를 주입한다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*MutualFollowControllerTest'`
Expected: PASS, 7 tests

- [ ] **Step 6: 백엔드 전체 검증 후 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(user): 맞팔로우 목록 API (AC-HOMECAL-18~24)"
```

- [ ] **Step 7: ★ 실제 응답을 떠 둔다**

```bash
cd backend && ./gradlew bootRun &
node ../scripts/open-as.mjs   # 또는 테스트 로그인으로 토큰 확보
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/v1/brew-logs/calendar?month=2026-09' | tee /tmp/calendar.json
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/v1/users/me/mutual-follows' | tee /tmp/mutual.json
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/v1/brew-logs?date=2026-09-19' | tee /tmp/day.json
```

**이 셋이 Task 4 이후 프론트 픽스처의 원본이다.** 지어내지 않는다 — 테스트 54개가 초록인데 화면이 안 열린 적이 있다(`docs/conventions/frontend.md`).

---

## Task 4: KST 날짜 공용화 · 토큰 · 건수 라벨

**Files:**
- Create: `frontend/src/lib/kstDate.ts`, `frontend/src/lib/kstDate.test.ts`
- Create: `frontend/src/lib/tokens.test.ts`
- Create: `frontend/src/features/calendar/brewCountLabel.ts`, `brewCountLabel.test.ts`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`

**Covers:** AC-HOMECAL-41, 53, 54

**Interfaces:**
- Produces: `toKstDate(iso: string): string` — `"2026-09-18T23:00:00Z"` → `"2026-09-19"`
- Produces: `kstToday(): string`, `kstMonthOf(date: string): string`, `addMonths(month: string, delta: number): string`
- Produces: `brewCountLabel(count: number): string` — `1` → `"1 BREW"`, 그 외 `"N BREWS"`
- Produces: CSS 변수 `--signal-record`

> **이 태스크를 먼저 하는 이유:** AC-HOMECAL-54는 **기존 화면의 버그 수정**이고 달력과 독립이다. 먼저 초록으로 만들어 두면, 이후 달력 작업 중 날짜가 어긋났을 때 원인이 달력 쪽임을 안다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// frontend/src/lib/kstDate.test.ts
import { describe, expect, it } from "vitest";
import { toKstDate } from "./kstDate";

describe("toKstDate", () => {
  it("UTC 전날 23시는 KST 다음 날이다", () => {
    expect(toKstDate("2026-09-18T23:00:00Z")).toBe("2026-09-19");
  });

  it("KST 자정 경계가 15:00:00Z에서 갈린다", () => {
    expect(toKstDate("2026-09-19T14:59:59Z")).toBe("2026-09-19");
    expect(toKstDate("2026-09-19T15:00:00Z")).toBe("2026-09-20");
  });
});
```

```ts
// frontend/src/features/calendar/brewCountLabel.test.ts
import { describe, expect, it } from "vitest";
import { brewCountLabel } from "./brewCountLabel";

describe("brewCountLabel", () => {
  it("AC-HOMECAL-41 · 1건은 1 BREW, 0건은 0 BREWS다", () => {
    expect(brewCountLabel(1)).toBe("1 BREW");
    expect(brewCountLabel(0)).toBe("0 BREWS");
    expect(brewCountLabel(9)).toBe("9 BREWS");
  });
});
```

```ts
// frontend/src/lib/tokens.test.ts — AC-HOMECAL-53
// globals.css를 읽어 :root와 다크 블록의 --signal-record 값을 문자열로 대조한다.
// 기존 토큰 테스트가 있으면 그 방식을 그대로 따른다.
```

`BrewLogCard.test.tsx`·`BrewDetail.test.tsx`에 AC-HOMECAL-54를 더한다:

```tsx
  it("AC-HOMECAL-54 · UTC 전날 23시 기록을 KST 날짜로 보여준다", () => {
    render(<BrewLogCard log={{ ...brewLogFixture, brewedAt: "2026-09-18T23:00:00Z" }} recipeLabel="V60" />);

    expect(screen.getByText("2026-09-19")).toBeInTheDocument();
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test kstDate brewCountLabel tokens BrewLogCard BrewDetail`
Expected: FAIL — `kstDate.ts`가 없고, `BrewLogCard`가 `2026-09-18`을 보여준다.

- [ ] **Step 3: 최소 구현**

```ts
// frontend/src/lib/kstDate.ts
/**
 * 날짜는 언제나 한국 시간 기준이다 — docs/specs/2026-09-19-home-calendar.md
 *
 * <p>서버가 주는 brewedAt은 UTC다. 앞 10글자를 그냥 자르면 한국 시간 아침에 내린 기록이
 * 전날로 보인다. 오프셋 값을 여기 한 곳에만 둔다.
 */
const KST_OFFSET_MINUTES = 540;

/** `2026-09-18T23:00:00Z` → `2026-09-19` */
export function toKstDate(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}
```

`kstToday`·`kstMonthOf`·`addMonths`도 같은 파일에 둔다.

`globals.css`의 `:root`에 더한다 — 다크 블록 **두 곳 모두**에 값을 준다(`@media`와 `[data-theme="dark"]`):

```css
  /*
   * 달력의 기록 점 — docs/specs/2026-09-19-home-calendar.md
   *
   * ★ 이 용도 외에는 쓰지 않는다. 팔레트의 유채색은 에스프레소 하나뿐이고,
   *   여기에 신호색이 하나 더 들어오는 것은 「기록이 있는 날」을 위해서만 허용된다.
   */
  --signal-record: oklch(0.55 0.16 30);
```

`@theme inline`에 `--color-signal-record: var(--signal-record);`를 더한다.

`BrewLogCard.formatBrewedDate`와 `BrewDetail`의 `log.brewedAt.slice(0, 10)`을 `toKstDate(log.brewedAt)`으로 바꾼다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test kstDate brewCountLabel tokens BrewLogCard BrewDetail`
Expected: PASS

- [ ] **Step 5: 전체 검증 후 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "fix(web): 날짜를 KST 기준으로 통일 (AC-HOMECAL-41·53~54)"
```

---

## Task 5: 달력 그리드 컴포넌트

**Files:**
- Create: `frontend/src/features/calendar/monthGrid.ts`, `monthGrid.test.ts`
- Create: `frontend/src/features/calendar/components/Calendar.tsx`, `Calendar.test.tsx`

**Covers:** AC-HOMECAL-25, 26, 35, 45, 46

**Interfaces:**
- Consumes: `toKstDate`, `kstToday` (Task 4)
- Produces: `buildMonthGrid(month: string): GridCell[]` — `GridCell = { date: string; inMonth: boolean }`. **월요일 시작**, 항상 7의 배수 길이
- Produces: `<Calendar month days selectedDate onSelect variant />` — `variant: "mobile" | "web"`
- Produces: `days`는 `Map<string, { count: number; primaryRecipeName?: string }>`

> **컴포넌트를 두 벌 만들지 않는다.** `variant`로 CSS만 가른다. 두 벌이면 aria-label·키보드 이동 같은 규칙이 한쪽에만 적용되는 사고가 난다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
  it("AC-HOMECAL-25 · 요일 헤더의 첫 칸이 월이고 마지막이 일이다", () => {
    render(<Calendar month="2026-09" days={new Map()} selectedDate={null} onSelect={() => {}} variant="mobile" />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("월");
    expect(headers[6]).toHaveTextContent("일");
  });

  it("AC-HOMECAL-26 · 기록이 2건인 날에도 점은 1개다", () => {
    const days = new Map([["2026-09-05", { count: 2 }]]);
    render(<Calendar month="2026-09" days={days} selectedDate={null} onSelect={() => {}} variant="mobile" />);

    const cell = screen.getByRole("button", { name: "9월 5일, 기록 2건" });
    expect(cell.querySelectorAll("[data-record-dot]")).toHaveLength(1);
  });

  it("AC-HOMECAL-45 · aria-label이 건수를 말한다", () => {
    const days = new Map([["2026-09-19", { count: 2 }]]);
    render(<Calendar month="2026-09" days={days} selectedDate={null} onSelect={() => {}} variant="mobile" />);

    expect(screen.getByRole("button", { name: "9월 19일, 기록 2건" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "9월 3일, 기록 없음" })).toBeInTheDocument();
  });

  it("AC-HOMECAL-46 · 선택된 셀에 aria-current가 정확히 하나다", () => {
    render(<Calendar month="2026-09" days={new Map()} selectedDate="2026-09-05" onSelect={() => {}} variant="mobile" />);

    const current = document.querySelectorAll('[aria-current="date"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("9월 5일, 기록 없음");
  });

  it("AC-HOMECAL-35 · 화살표 키로 하루·일주일 이동한다", async () => {
    const onSelect = vi.fn();
    render(<Calendar month="2026-09" days={new Map()} selectedDate="2026-09-19" onSelect={onSelect} variant="mobile" />);

    screen.getByRole("button", { name: "9월 19일, 기록 없음" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-20");
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("2026-09-27");
  });
```

`monthGrid.test.ts`에 격자 계산 테스트를 더한다 — `2026-09-01`이 화요일이므로 첫 칸(월요일)이 `2026-08-31`이고 `inMonth: false`다. 6주에 걸치는 달(`2026-08`)은 길이가 42다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test Calendar monthGrid`
Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: 최소 구현**

`buildMonthGrid`는 그 달 1일의 요일을 구해 월요일까지 되감고, 7의 배수가 될 때까지 뒤를 채운다. `Calendar.tsx`는 `role="grid"`, 요일 헤더에 `role="columnheader"`, 각 날짜 칸을 `button`으로 그린다. `variant === "web"`일 때만 대표 레시피명과 `외 N건`을 렌더한다. 키보드 이동은 `onKeyDown`에서 `ArrowLeft/Right`는 ±1일, `ArrowUp/Down`은 ±7일로 계산해 `onSelect`를 부른다.

**다른 달 칸(`inMonth: false`)은 `button`이 아니다** — 웹은 배경만 칠하고, 모바일은 빈 `div`다(AC-HOMECAL-69).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test Calendar monthGrid`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 달력 그리드 (AC-HOMECAL-25·26·35·45~46)"
```

---

## Task 6: 월 네비게이션

**Files:**
- Create: `frontend/src/features/calendar/components/MonthNav.tsx`, `MonthNav.test.tsx`

**Covers:** AC-HOMECAL-32, 40

**Interfaces:**
- Consumes: `brewCountLabel`, `addMonths`, `kstToday` (Task 4)
- Produces: `<MonthNav month totalCount ownerNickname onPrev onNext />` — `ownerNickname`이 `undefined`면 내 달력

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
  it("AC-HOMECAL-32 · 이번 달에서 다음 달 버튼이 비활성이다", () => {
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    render(<MonthNav month="2026-09" totalCount={9} onPrev={() => {}} onNext={() => {}} />);

    expect(screen.getByRole("button", { name: "다음 달" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전 달" })).toBeEnabled();
  });

  it("AC-HOMECAL-40 · 남의 달력은 닉네임이 앞에 붙는다", () => {
    render(<MonthNav month="2026-09" totalCount={6} ownerNickname="지연" onPrev={() => {}} onNext={() => {}} />);

    expect(screen.getByText("2026.09")).toBeInTheDocument();
    expect(screen.getByText("지연 · 6 BREWS")).toBeInTheDocument();
  });
```

내 달력이 `9 BREWS`인 것도 같은 파일에서 검증한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test MonthNav`
Expected: FAIL — 모듈이 없다.

- [ ] **Step 3: 최소 구현**

`month === kstMonthOf(kstToday())`이면 다음 달 버튼에 `disabled`. 라벨은 `ownerNickname ? `${ownerNickname} · ${brewCountLabel(totalCount)}` : brewCountLabel(totalCount)`.

- [ ] **Step 4: 테스트 실행 — 통과 확인** → **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 월 네비게이션 (AC-HOMECAL-32·40)"
```

---

## Task 7: 날짜별 목록과 roast dot

**Files:**
- Create: `frontend/src/features/calendar/components/DayList.tsx`, `DayList.test.tsx`
- Create: `frontend/src/features/calendar/components/RoastDot.tsx`, `RoastDot.test.tsx`

**Covers:** AC-HOMECAL-42, 43, 75, 76

**Interfaces:**
- Consumes: `useEntityLabels`(기존), `formatRatio`(기존 `lib/format.ts`)
- Produces: `<DayList date logs ownerNickname variant />`
- Produces: `<RoastDot roastLevel />` — `roastLevel`이 `undefined`면 **아무것도 렌더하지 않는다**

> **대표 수치는 계산하지 않는다.** `extractionYieldPercent`와 `brewRatio`는 서버가 반올림해서 준다. 프론트는 `?? `로 고르고 포맷만 한다(`lib/format.ts` 주석).

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
  it("AC-HOMECAL-42 · 목록 헤더가 날짜·요일·건수를 담는다", () => {
    render(<DayList date="2026-09-19" logs={[logA, logB]} variant="mobile" />);

    expect(screen.getByText("09.19 SAT · 2 BREWS")).toBeInTheDocument();
  });

  it("AC-HOMECAL-43 · 수율이 없으면 비율을 보여준다", () => {
    const withYield = { ...logA, extractionYieldPercent: 20.4 };
    const withoutYield = { ...logB, extractionYieldPercent: undefined, brewRatio: 15.6 };
    render(<DayList date="2026-09-19" logs={[withYield, withoutYield]} variant="mobile" />);

    expect(screen.getByText("20.4 %")).toBeInTheDocument();
    expect(screen.getByText("1:15.6")).toBeInTheDocument();
  });

  it("AC-HOMECAL-76 · 원두를 연결하지 않은 기록은 roast dot이 없다", () => {
    render(<DayList date="2026-09-19" logs={[{ ...logA, beanBatchId: undefined }]} variant="mobile" />);

    expect(document.querySelector("[data-roast-dot]")).toBeNull();
  });
```

```tsx
  it("AC-HOMECAL-75 · roast dot 색이 로스팅 강도에 따라 다르다", () => {
    const { container: light } = render(<RoastDot roastLevel="LIGHT" />);
    const { container: dark } = render(<RoastDot roastLevel="DARK" />);

    expect(getComputedStyle(light.firstElementChild!).backgroundColor).not.toBe(
      getComputedStyle(dark.firstElementChild!).backgroundColor,
    );
  });
```

> `!` 금지 규칙 때문에 위 단언은 `firstElementChild`를 먼저 `expect(...).not.toBeNull()`로 좁히고 지역 변수에 담아 쓴다. **테스트 코드도 같은 규칙을 지킨다.**

- [ ] **Step 2: 테스트 실행 — 실패 확인** → **Step 3: 최소 구현**

목록 헤더는 `MM.DD` + 영문 요일 3글자 대문자 + `brewCountLabel`. `ownerNickname`이 있으면 요일과 건수 사이에 끼운다. roast dot 색은 핸드오프의 5단계 명도를 `roastLevel`에 매핑한 상수 테이블로 둔다.

- [ ] **Step 4: 테스트 실행 — 통과 확인** → **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 날짜별 목록과 로스팅 점 (AC-HOMECAL-42~43·75~76)"
```

---

## Task 8: 팔로우 레일

**Files:**
- Create: `frontend/src/features/calendar/api.ts`, `schema.ts`
- Create: `frontend/src/features/calendar/components/FollowRail.tsx`, `FollowRail.test.tsx`

**Covers:** AC-HOMECAL-36, 44, 47

**Interfaces:**
- Consumes: `authedRequest`, `backendUrl` (기존 `lib/`), `useMe` (기존 `features/user/queries.ts`)
- Produces: `useCalendar(userId, month, onSessionLost)`, `useMutualFollows(onSessionLost)`, `useDayLogs(userId, date, onSessionLost)`
- Produces: `calendarSchema`, `mutualFollowListSchema`
- Produces: `<FollowRail me mutuals selectedUserId onSelect />`

> **스키마는 Task 3 Step 7에서 뜬 실제 응답으로 쓴다.** `/tmp/calendar.json`·`/tmp/mutual.json`을 열어 키를 확인하고 `z.object`를 맞춘다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
  it("AC-HOMECAL-36 · 첫 칸이 나이고 기본 선택이다", () => {
    render(<FollowRail me={meFixture} mutuals={[지연, 민재]} selectedUserId={meFixture.id} onSelect={() => {}} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveTextContent("나");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("AC-HOMECAL-44 · profileImageUrl이 없으면 닉네임 첫 글자가 뜬다", () => {
    render(<FollowRail me={meFixture} mutuals={[{ id: 12, nickname: "지연" }]} selectedUserId={meFixture.id} onSelect={() => {}} />);

    const tab = screen.getByRole("tab", { name: /지연/ });
    expect(tab.querySelector("img")).toBeNull();
    expect(tab).toHaveTextContent("지");
  });

  it("AC-HOMECAL-47 · tablist 역할을 갖는다", () => {
    render(<FollowRail me={meFixture} mutuals={[지연]} selectedUserId={12} onSelect={() => {}} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인** → **Step 3: 최소 구현**

레일은 「나」 칸을 `me`로 직접 만들고 그 뒤에 `mutuals`를 **서버가 준 순서 그대로** 붙인다 — **프론트에서 다시 정렬하지 않는다.** 정렬은 서버의 책임이고 두 곳에서 하면 갈라진다.

- [ ] **Step 4: 테스트 실행 — 통과 확인** → **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 팔로우 레일 (AC-HOMECAL-36·44·47)"
```

---

## Task 9: 홈 화면 조립 (모바일)

**Files:**
- Modify: `frontend/src/app/page.tsx` (전면 교체), `frontend/src/app/page.test.tsx`
- Create: `frontend/e2e/home-calendar.spec.ts`
- Modify: `frontend/e2e/stubs.ts`

**Covers:** AC-HOMECAL-27~31, 33, 34, 37~39, 48~52, 57

**Interfaces:**
- Consumes: Task 5~8의 컴포넌트와 훅 전부
- Produces: 홈의 상태 — `selectedUserId` / `selectedMonth` / `selectedDate`

> **상태를 한 곳에 둔다.** 세 값 모두 `page.tsx`가 갖고, 하위 컴포넌트는 받기만 한다. 레일이 자기 선택을 따로 갖기 시작하면 「사람을 바꾸면 selectedDate 초기화」(AC-HOMECAL-38) 같은 규칙이 두 곳에 흩어진다.

- [ ] **Step 1: 실패하는 테스트 작성 (컴포넌트)**

`page.test.tsx`를 **교체**한다 — 기존 「최근 기록 3개」 테스트는 그 화면이 사라지므로 남기지 않는다.

```tsx
  it("AC-HOMECAL-27 · 진입하면 오늘이 선택돼 있다", async () => {
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    renderHome();

    expect(await screen.findByRole("button", { name: /9월 19일/ })).toHaveAttribute("aria-current", "date");
  });

  it("AC-HOMECAL-29 · 빈 날짜를 누르면 선택되고 빈 문구가 뜬다", async () => {
    renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "9월 3일, 기록 없음" }));

    expect(screen.getByRole("button", { name: "9월 3일, 기록 없음" })).toHaveAttribute("aria-current", "date");
    expect(screen.getByText("이 날에는 기록이 없습니다.")).toBeInTheDocument();
  });

  it("AC-HOMECAL-33 · 이전 달로 넘기면 선택 없음 상태가 된다", async () => {
    renderHome();

    await userEvent.click(await screen.findByRole("button", { name: "이전 달" }));

    expect(screen.getByText("2026.08")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
  });

  it("AC-HOMECAL-38 · 사람을 바꾸면 month는 유지되고 selectedDate는 초기화된다", async () => {
    vi.setSystemTime(new Date("2026-09-19T01:00:00Z"));
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "이전 달" }));
    await userEvent.click(screen.getByRole("button", { name: "8월 11일, 기록 없음" }));

    await userEvent.click(screen.getByRole("tab", { name: /지연/ }));

    expect(screen.getByText("2026.08")).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0);
  });

  it("AC-HOMECAL-50 · 이전 달로 넘길 때 추가 요청이 없다", async () => {
    const calls: string[] = [];
    server.events.on("request:start", ({ request }) => calls.push(request.url));
    renderHome();
    await screen.findByText("2026.09");
    const before = calls.filter((u) => u.includes("month=2026-08")).length;

    await userEvent.click(screen.getByRole("button", { name: "이전 달" }));
    await screen.findByText("2026.08");

    expect(calls.filter((u) => u.includes("month=2026-08"))).toHaveLength(before);
  });

  it("AC-HOMECAL-52 · 로딩 중에도 그리드 골격이 유지된다", () => {
    server.use(http.get("*/brew-logs/calendar", () => delay("infinite")));
    renderHome();

    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(document.querySelector("[data-record-dot]")).toBeNull();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });
```

AC-28·37·39도 같은 파일에 더한다.

- [ ] **Step 2: 실패하는 테스트 작성 (e2e)**

Create `frontend/e2e/home-calendar.spec.ts` — 390px 뷰포트. `stubs.ts`에 달력·맞팔로우·날짜별 목록 핸들러를 더한다.

```ts
test("AC-HOMECAL-30 · 기록이 1건인 날을 눌러도 상세로 이동하지 않는다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("day-list-row")).toHaveCount(1);
});

test("AC-HOMECAL-51 · 기록이 4건인 날에도 달력 위치가 변하지 않는다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "9월 2일, 기록 1건" }).click();
  const before = await page.getByRole("grid").boundingBox();
  await page.getByRole("button", { name: "9월 12일, 기록 4건" }).click();
  const after = await page.getByRole("grid").boundingBox();

  expect(after?.y).toBe(before?.y);
});

test("AC-HOMECAL-49 · 기록을 저장하고 돌아오면 점이 찍혀 있다", async ({ page }) => {
  // 저장 후 홈 복귀 시 달력 쿼리가 다시 나가는지까지 확인한다.
});
```

AC-31·34·48·57도 같은 파일에 더한다.

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test page && pnpm e2e home-calendar`
Expected: FAIL — 홈이 아직 「최근 기록」이다.

- [ ] **Step 4: 홈 구현**

`page.tsx`를 달력으로 교체한다. 상태 셋을 `useState`로 갖고, `useCalendar(selectedUserId, selectedMonth)`와 `useCalendar(selectedUserId, addMonths(selectedMonth, -1))`를 **둘 다 건다** — 후자가 프리페치다(AC-HOMECAL-50). 날짜가 선택됐을 때만 `useDayLogs`를 `enabled`로 부른다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test && pnpm e2e home-calendar`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 홈을 달력으로 (AC-HOMECAL-27~34·37~39·48~52·57)"
```

---

## Task 10: 웹 레이아웃

**Files:**
- Create: `frontend/src/components/layout/WebTopBar.tsx`, `WebTopBar.test.tsx`
- Modify: `frontend/src/app/page.tsx` — 2컬럼 분기
- Modify: `frontend/src/features/calendar/components/Calendar.tsx` — `variant="web"` 셀
- Modify: `frontend/src/features/calendar/components/DayList.tsx` — 카드 형태
- Modify: `frontend/src/features/calendar/components/FollowRail.tsx` — pill 형태
- Create: `frontend/public/logo-symbol.svg` (핸드오프 `assets/`에서 복사)
- Create: `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-55, 56, 58~65, 68~72, 74, 77~79

**Interfaces:**
- Consumes: Task 5~9 전부
- Produces: `<WebTopBar me />` — 로고·`홈`·`레시피`·`기록`·`기록하기`·아바타

> **`<760px`에서 상단 바를 렌더하지 않는다.** 하단 탭바와 동시에 뜨면 최상위 이동 수단이 둘이 된다. CSS `display`로만 감추지 말고 **DOM에서 빼거나** `hidden` 속성을 준다 — AC-HOMECAL-58이 탭바 부재를 함께 단언한다.

- [ ] **Step 1: 로고 에셋 복사**

```bash
cp "docs/design/design_handoff_kaldi_note/assets/logo-symbol.svg" frontend/public/logo-symbol.svg
```

`currentColor` 상속판이므로 색을 CSS로 준다. **락업(`logo-lockup-*.svg`)을 쓰지 않는다** — 워드마크가 `<text>`라 폰트 의존이 생긴다.

- [ ] **Step 2: 실패하는 테스트 작성 (e2e, 1440×900)**

```ts
test("AC-HOMECAL-55 · 1100px에서 2컬럼이다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/");

  const column = page.getByTestId("day-column");
  await expect(column).toBeVisible();
  expect((await column.boundingBox())?.width).toBe(420);
});

test("AC-HOMECAL-56 · 1099px에서 1컬럼이고 셀은 웹 박스다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1099, height: 900 });
  await page.goto("/");

  await expect(page.getByTestId("day-column")).toBeHidden();
  await expect(page.getByRole("button", { name: /9월 2일/ })).toContainText("Hoffmann V60");
});

test("AC-HOMECAL-64 · 기록이 3건이면 외 2건이 뜬다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: /9월 5일/ })).toContainText("외 2건");
});

test("AC-HOMECAL-68 · 6주에 걸친 달도 그리드 전체 높이가 같다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const before = await page.getByRole("grid").boundingBox();
  await page.getByRole("button", { name: "이전 달" }).click();
  const after = await page.getByRole("grid").boundingBox();

  expect(after?.height).toBe(before?.height);
  await expect(page.getByTestId("calendar-row")).toHaveCount(6);
});

test("AC-HOMECAL-79 · 우측 컬럼만 스크롤한다", async ({ page }) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /9월 12일/ }).click();

  const before = await page.getByRole("grid").boundingBox();
  await page.getByTestId("day-column").evaluate((el) => el.scrollBy(0, 300));
  const after = await page.getByRole("grid").boundingBox();

  expect(after?.y).toBe(before?.y);
});
```

나머지 AC-58~63·65·69~72·74·77·78도 같은 파일에 더한다.

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e home-calendar-web`
Expected: FAIL — 1440px에서도 모바일 레이아웃이다.

- [ ] **Step 4: 구현**

1. `WebTopBar` — `hidden lg:flex`가 아니라 **미디어 쿼리 분기로 DOM을 가른다.**
2. `page.tsx`에 `≥1100px` 2컬럼 / `760–1099px` 1컬럼 / `<760px` 모바일 분기.
3. `Calendar`의 `variant="web"`에 박스 셀·격자선·요약 줄·`외 N건`·다른 달 배경.
4. `DayList`의 `variant="web"`에 카드·태그 줄·메모·Observation 블록.
5. `FollowRail`의 웹 pill.

**경계값을 CSS에 리터럴로 적는다** — `@media (min-width: 1100px)`, `@media (min-width: 760px)`. AC-HOMECAL-55·56·57이 각각 `1100`/`1099`/`759`를 단언한다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test && pnpm e2e`
Expected: PASS — **기존 e2e도 전부 통과해야 한다.** 홈을 바꿨으므로 `layout.spec.ts`·`structure.spec.ts` 등이 홈을 밟고 있으면 함께 고친다.

- [ ] **Step 6: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
cd .. && git add . && git commit -m "feat(web): 홈 달력의 웹 레이아웃 (AC-HOMECAL-55~56·58~65·68~72·74·77~79)"
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — **AC 79개가 전부 테스트에서 발견돼야 한다**
- [ ] 스펙의 `status`를 `구현완료`로, `plan`에 이 문서 경로를 적는다
- [ ] `docs/JOURNAL.md`에 세션 일지를 적는다
- [ ] 스펙의 「수동 확인」 6개를 밟고 결과를 적는다 (전부 비차단형)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 79개 중 79개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:**
- `CalendarMonth.KST`(Task 1)를 Task 2가 `date` 변환에 재사용한다 — 오프셋이 한 곳이다
- `BrewLogService.list`의 시그니처 변경(Task 2)이 `BrewLogController.list` 한 곳에만 영향을 준다 — `grep -rn "brewLogService.list"`로 확인했다
- `PublicProfileResponse`(기존)를 Task 3이 그대로 쓴다 — 새 DTO를 만들지 않으므로 프론트 `publicProfileSchema`도 재사용된다
- `toKstDate`(Task 4)를 Task 5·7·9가 공유한다
- `variant: "mobile" | "web"`이 Task 5·7·8·10에서 같은 유니언이다

**확인한 가정 (계획 작성 중 실제로 조사함):**
- `pnpm e2e` = `playwright test` — `frontend/package.json:17`. 이 문서의 명령어가 맞다.
- `vi.setSystemTime`은 이미 쓰이고 있다 — `frontend/src/app/brews/new/page.test.tsx`, `components/LoadingState.test.tsx`. AC-HOMECAL-27·32·38이 이 방식을 쓸 수 있다.
- `BrewLogService.list` 호출부는 `BrewLogController.list` 한 곳뿐이다 — `grep -rn "brewLogService.list"`로 확인했다.

**★ 기존 e2e가 깨질 지점 (Task 9에서 반드시 함께 고친다):**

| 파일 | 왜 깨지나 |
|---|---|
| `e2e/screens.ts` | `SCREENS`의 첫 항목이 `{ path: "/", hasTabBar: true }`다. 이걸 순회하는 **`readability.spec.ts`·`layout.spec.ts`·`touch-targets.spec.ts`·`reskin.spec.ts` 넷**이 새 홈을 밟는다. 달력 셀은 44px이므로 `touch-targets`는 통과해야 정상이고, **통과하지 않으면 셀 높이가 규격에서 벗어난 것**이다 |
| `e2e/polish.spec.ts:59` | 홈을 직접 연다 |
| `e2e/pwa.spec.ts:365` | **`page.route("**/api/v1/brew-logs*")`가 `/brew-logs/calendar`까지 가로채 `pageOf([])`를 준다.** 달력 스키마와 형태가 달라 파싱에서 터진다. 그 라우트를 `**/api/v1/brew-logs?*`로 좁히거나 달력 핸들러를 따로 준다 |

**여전히 검증되지 않은 가정:**
- **네이티브 쿼리의 `:userId is null` 타입 추론.** PostgreSQL이 파라미터 타입을 못 정하면 실패한다. Task 1 Step 6에 `cast(:userId as bigint)` 대안을 적어 뒀다. **Task 1에서 실제로 돌려 확인한다.**
- **`left join` + `max()` + `nulls last` 정렬이 JPQL에서 파싱되는가.** Hibernate 7이 `nulls last`를 지원하는 것으로 알고 있으나 **확인하지 않았다.** 실패하면 `order by case when max(b.brewedAt) is null then 1 else 0 end, max(b.brewedAt) desc, u.nickname asc`로 바꾼다 — 의미는 같다.
- **웹 상단 바가 `SCREENS` 순회 테스트와 충돌하는가.** 그 넷은 `hasTabBar: true`인 화면에 탭바가 있다고 단언한다. 기본 뷰포트가 `<760px`이면 홈에도 탭바가 있어 통과하지만, **Playwright 기본 뷰포트를 확인하지 않았다.** Task 10 시작 전에 `playwright.config.ts`를 본다.
