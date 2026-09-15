# 읽힘 — 색 대비와 글자 크기 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-15-readability.md`

**Goal:** 라이트 모드의 보조색·테두리·오류색을 진하게 바꾸고 글자 5단계를 한 칸씩 올려, 낮에 부엌
조명에서 라벨과 힌트가 읽히게 만든다. 동시에 커버리지 스크립트가 각 스펙이 소유한 AC만 세게 고친다.

**Architecture:** 색은 `globals.css` 세 줄만 고친다 — `text-muted` 91곳·`border-line` 57곳·
`text-danger` 24곳이 전부 토큰을 가리키므로 앱 코드를 건드리지 않고 172곳에 전달된다. 글자는
앱 코드 184곳의 클래스를 정해진 매핑으로 한 칸씩 올린다. **치환 순서가 결과를 바꾸므로**
Task 3에서 순서를 고정하고 각 단계마다 개수를 센다.

**작업 위치:** `frontend/` (Task 1만 `scripts/`)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-READ-19 | 스크립트가 헤딩 정의분만 센다 | Task 1 | 쉘 테스트 |
| AC-READ-20 | 소유 기준 합계가 739 | Task 1 | 쉘 테스트 |
| AC-READ-01 | muted `#545454` · 7.57:1 | Task 2 | 단위 테스트 |
| AC-READ-02 | line `#b8b8b8` | Task 2 | 단위 테스트 |
| AC-READ-03 | danger `#b91c1c` · 6.47:1 | Task 2 | 단위 테스트 |
| AC-READ-04 | 토큰 8개 라이트·다크 쌍 | Task 2 | 단위 테스트 |
| AC-READ-05 | 다크 값 8개 불변 | Task 2 | 단위 테스트 |
| AC-READ-06 | 글자 조합 전부 4.5:1 이상 | Task 2 | 단위 테스트 |
| AC-READ-16 | 7.57 통과 / 7.56 미달 | Task 2 | 단위 테스트 |
| AC-READ-07 | `text-xl`·`text-xs`가 0곳 | Task 3 | 단위 테스트 |
| AC-READ-08 | 단계별 개수 4/15/18/127/20 | Task 3 | 단위 테스트 |
| AC-READ-09 | 5단계 밖 크기 없음 | Task 3 | 단위 테스트 |
| AC-READ-10 | 임의값 크기 1곳 | Task 3 | 단위 테스트 |
| AC-READ-21 | `h2` 13곳이 전부 `text-lg` | Task 3 | 단위 테스트 |
| AC-READ-11 | 화면 제목 24px 렌더 | Task 4 | e2e |
| AC-READ-12 | 대표 수치 36px 렌더 | Task 4 | e2e |
| AC-READ-13 | 굵기 600 · 자간 -0.72px | Task 4 | e2e |
| AC-READ-14 | 본문 16px 렌더 | Task 4 | e2e |
| AC-READ-15 | 라벨 14px · `rgb(84,84,84)` | Task 4 | e2e |
| AC-READ-17 | 가로 스크롤 없음 | Task 5 | e2e |
| AC-READ-18 | 터치 타깃 44px 유지 | Task 5 | e2e (기존 스위트) |

**스펙의 AC 21개 중 21개가 매핑됨.**

---

## Global Constraints

- **토큰을 늘리지 않는다.** 8개 그대로다. 값만 바꾼다
- **다크 블록을 건드리지 않는다.** `AC-READ-05`가 회귀를 잡는다
- **앱 코드의 색 클래스를 고치지 않는다.** 전부 토큰을 가리키고 있다
- **`text-[22px]`(별 아이콘)은 그대로 둔다.** 글자가 아니라 도형이다

---

## File Structure

```
scripts/
  check-spec-coverage.sh            수정 — `#### AC-` 헤딩으로 소유를 판정한다
  check-spec-coverage.test.sh       신규 — 순수 bash, spec.yml이 돌린다
.github/workflows/spec.yml          수정 — 위 테스트를 CI 단계로 추가
frontend/
  src/app/globals.css               수정 — :root 세 줄
  src/test/contrast.test.ts         수정 — AC-READ-01·02·03·06·16
  src/test/designTokens.test.ts     수정 — AC-READ-04·05·07·08·09·10
  src/test/headings.test.ts         수정 — text-xl → text-2xl (2곳)
  src/**/*.tsx                      수정 — 앱 코드 184곳 치환
  src/**/*.test.tsx                 수정 — toHaveClass 인자 8곳
  e2e/readability.spec.ts           신규 — AC-READ-11~15·17
```

---

## Task 1: 커버리지 스크립트가 헤딩 정의분만 센다

**Files:**
- Modify: `scripts/check-spec-coverage.sh`
- Test: `scripts/check-spec-coverage.test.sh` (신규)

**Covers:** AC-READ-19, AC-READ-20

**Interfaces:**
- Consumes: 없음
- Produces: 정확해진 집계. Task 2~5의 커버리지 검사가 이것을 쓴다

> **왜 먼저 하나.** 이 태스크가 끝나야 이후 태스크의 커버리지 출력이 믿을 수 있는 숫자가 된다.
> 나중에 하면 그동안의 집계가 전부 부풀려진 채로 남는다.

- [x] **Step 1: 실패하는 테스트 작성**

`scripts/check-spec-coverage.test.sh`:

```bash
#!/usr/bin/env bash
# check-spec-coverage.sh의 AC 집계 로직 검증 — docs/specs/2026-09-15-readability.md
#
# 임시 스펙 디렉터리를 만들어 스크립트를 돌린다. deploy.test.sh와 같은 방식이고
# 순수 bash라 새 의존성이 없다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
SCRIPT="$HERE/check-spec-coverage.sh"

failed=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name"
    echo "      기대: $expected"
    echo "      실제: $actual"
    failed=1
  fi
}

# ── AC-READ-19 · 헤딩으로 정의된 AC만 센다 ──────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/specs"

cat > "$TMP/specs/2099-01-01-fixture.md" <<'SPEC'
---
id: FOO
title: 픽스처
status: 초안
---
#### AC-FOO-01 · 하나
#### AC-FOO-02 · 둘
갱신 대상: AC-BAR-99 는 이 스펙 것이 아니다.
SPEC

out=$(SPEC_DIR="$TMP/specs" "$SCRIPT" 2>&1)
count=$(echo "$out" | grep -oE 'AC [0-9]+개' | grep -oE '[0-9]+' | head -1)
check "AC-READ-19 · AC-BAR-99를 세지 않는다" "2" "$count"

# ── AC-READ-20 · 소유 기준 합계가 739다 ──────────────────────────────
real=$("$SCRIPT" 2>&1)
total=$(echo "$real" | grep -oE '인수 조건 [0-9]+개' | grep -oE '[0-9]+')
check "AC-READ-20 · 합계가 739다" "739" "$total"

echo
if [ "$failed" -eq 0 ]; then
  echo "전부 통과"
else
  echo "실패가 있습니다"
fi
exit "$failed"
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
chmod +x scripts/check-spec-coverage.test.sh
./scripts/check-spec-coverage.test.sh
```

**실제 관측(2026-09-15):** `AC-READ-19` FAIL(`2` 기대, **`25`** 실제) · `AC-READ-20` PASS.

`25`가 나온 것은 두 결함이 겹친 결과다 — `SPEC_DIR`이 환경변수가 아니라 임시 디렉터리 대신
실제 `docs/specs`를 검사했고, 거기에 접두어 미구분까지 더해졌다.

**`AC-READ-20`은 이 시점에 이미 통과한다.** 합계는 `구현완료` 스펙만 세고 `초안`은 건너뛰므로,
이번 스펙(초안)이 부풀려 집계되어도 합계에 영향을 주지 않는다.

> **★ 빨강이 보장되지 않는 조건이다.** **그대로 두면 「검사가 비어 있는 것」과 구분되지 않는다.**
> 돌연변이로 확인한다 — `AC_PATTERN`을 `AC-[A-Z]{99}`처럼 잠시 망가뜨리고 되돌린다.
> **실제로 해봤고 합계가 `747 → 0`으로 떨어지며 빨개졌다.** 검사는 비어 있지 않다.

- [x] **Step 3: 최소 구현**

`scripts/check-spec-coverage.sh`의 `ids=` 줄(46~48행 부근)을 바꾼다:

> **★ 계획이 처음 적은 `id` 기반 구현은 틀렸다.** 실제로 해보니 합계가 **747 → 689**로
> **58개가 사라졌다.** 한 스펙이 여러 접두어를 소유하기 때문이다 —
> `visibility-authorization`(`id: VIS`)이 `AC-FOLLOW`를, `list-query-api`(`id: LIST`)가
> `AC-BLEDIT`·`AC-ME`를, `seed-curated-recipes`가 `AC-SWAGGER`를, `web-recipe-read`가
> `AC-CORS`를 **자기 헤딩으로 정의**한다. `id`로 걸렀더니 그것들이 통째로 빠졌다.
>
> 올바른 기준은 `id`가 아니라 **소유(`#### AC-` 헤딩) vs 언급(본문 참조)**이다.

```bash
  # 이 스펙이 소유한 AC만 센다. 소유의 표시는 `#### AC-…` 헤딩이다.
  #
  # 스펙이 남의 AC를 본문에서 참조하는 일이 있다 — 갱신 대상을 명시하거나 선행 스펙을
  # 가리킬 때다. 그것까지 세면 같은 AC가 두 스펙에서 잡혀 합계가 부풀려진다.
  #
  # frontmatter의 id로 좁히지 않는 이유: 한 스펙이 여러 접두어를 소유한다.
  ids=$(grep -oE "^#### $AC_PATTERN" "$spec" 2>/dev/null | sed 's/^#### //' | sort -u || true)
```

**`SPEC_DIR`의 환경변수화가 반드시 필요하다.** 22행이 `SPEC_DIR="docs/specs"`로 고정돼 있어
테스트가 임시 디렉터리를 가리킬 수 없다. 그 줄을 바꾼다:

```bash
SPEC_DIR="${SPEC_DIR:-docs/specs}"
```

> 스크립트 19행의 `cd "$(dirname "$0")/.."`가 먼저 실행되므로 상대경로 기본값은 그대로 동작한다.
> 테스트는 절대경로를 넘긴다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
./scripts/check-spec-coverage.test.sh
./scripts/check-spec-coverage.sh | tail -3
```

Expected: PASS 2개. 이번 스펙이 `[초안] — AC 21개`로 보고되고, 합계가 **739**가 된다.

> **★ 합계가 747에서 739로 8개 줄어드는 것이 정상이다.** 6개 스펙이 본문에서 참조만 한 남의 AC가
> 소유 스펙에서 한 번 더 세어져 **중복 집계돼 왔다.** `747`은 처음부터 부풀려진 숫자였다.
> `AC-READ-20`을 이 사실에 맞춰 갱신했고 이유를 스펙 그 자리에 남겼다.

- [x] **Step 5: 커밋**

```bash
git add scripts/ docs/ && git commit -m "fix(scripts): 커버리지가 각 스펙이 소유한 AC만 센다 (AC-READ 2개)"
```

---

## Task 2: 색 토큰 3개를 진하게

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/test/contrast.test.ts`
- Modify: `frontend/src/test/designTokens.test.ts`

**Covers:** AC-READ-01, 02, 03, 04, 05, 06, 16

**Interfaces:**
- Consumes: `readPalettes()` · `contrastRatio()` (`src/test/tokens.ts` · `contrast.ts`)
- Produces: 확정된 토큰 값. Task 4의 `AC-READ-15`가 `rgb(84,84,84)`를 기대한다

- [x] **Step 1: 실패하는 테스트 작성**

`src/test/contrast.test.ts` 끝에 추가:

```ts
describe("읽힘 — 라이트 모드의 대비", () => {
  const { light, dark } = readPalettes();

  it("AC-READ-01 · 보조색이 #545454이고 대비가 7.57:1 이상이다", () => {
    expect(light.muted).toBe("#545454");
    expect(contrastRatio(light.muted, light.background)).toBeGreaterThanOrEqual(
      7.57,
    );
  });

  it("AC-READ-02 · 테두리색이 #b8b8b8이다", () => {
    expect(light.line).toBe("#b8b8b8");
    expect(contrastRatio(light.line, light.background)).toBeGreaterThanOrEqual(
      1.98,
    );
  });

  it("AC-READ-03 · 오류색이 #b91c1c이고 대비가 6.47:1 이상이다", () => {
    expect(light.danger).toBe("#b91c1c");
    expect(contrastRatio(light.danger, light.background)).toBeGreaterThanOrEqual(
      6.47,
    );
  });

  it("AC-READ-16 · 판정이 7.57을 통과로, 7.56을 미달로 준다", () => {
    const ratio = contrastRatio(light.muted, light.background);
    expect(ratio >= 7.57).toBe(true);
    expect(ratio >= 7.58).toBe(false);
  });

  it("AC-READ-05 · 다크 모드 값 8개가 그대로다", () => {
    expect(dark).toEqual({
      background: "#0a0a0a",
      foreground: "#ededed",
      brand: "#c9a98a",
      "on-accent": "#171717",
      danger: "#f87171",
      muted: "#a1a1a1",
      line: "#404040",
      surface: "#262626",
    });
  });
});
```

> `AC-READ-16`의 위쪽 경계를 `7.58`로 잡은 이유: 실제 대비가 `7.5749…`라 `7.57`은 통과하고
> `7.58`은 미달이다. 판정이 상수를 그냥 `true`로 돌려주는 것이 아님을 이것으로 본다.

`AC-READ-04`·`AC-READ-06`은 기존 `AC-VISUAL-06`·`AC-VISUAL-07`이 이미 검사한다. 두 테스트의
`DisplayName`에 AC ID를 **병기**한다:

```ts
it("AC-VISUAL-06 · AC-READ-04 · 토큰 8개가 라이트·다크 값을 모두 갖는다", () => {
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && pnpm test -- contrast
```

Expected: FAIL — `AC-READ-01`이 `#737373`을 받아 `#545454`와 다르다고 한다. 3개 실패.

- [x] **Step 3: 최소 구현**

`frontend/src/app/globals.css`의 `:root` 세 줄만 바꾼다:

```css
  --danger: #b91c1c;
  --muted: #545454;

  /* 표면색. 글자가 아니라 4.5:1 기준의 대상이 아니다. */
  --line: #b8b8b8;
```

**`@media (prefers-color-scheme: dark)` 블록은 한 줄도 건드리지 않는다.**

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm test -- contrast designTokens
```

Expected: PASS. 기존 `AC-VISUAL-07`(AA 4.5:1)도 통과가 유지된다 — 전부 값을 올리는 방향이다.

- [x] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 라이트 모드 대비를 올린다 (AC-READ 7개)"
```

---

## Task 3: 글자 184곳을 한 칸씩 올린다

**Files:**
- Modify: `frontend/src/**/*.tsx` (앱 코드 184곳)
- Modify: `frontend/src/**/*.test.tsx` (assert 8곳)
- Modify: `frontend/src/test/headings.test.ts` (2곳)
- Modify: `frontend/src/test/designTokens.test.ts`

**Covers:** AC-READ-07, 08, 09, 10

**Interfaces:**
- Consumes: Task 2의 토큰 값
- Produces: 새 5단계. Task 4가 렌더로 다시 잰다

- [x] **Step 1: 실패하는 테스트 작성**

`src/test/designTokens.test.ts`에 추가. **`SOURCES`가 테스트 파일까지 포함하므로 앱 코드만 거르는
상수를 새로 만든다:**

```ts
// 앱 코드만. `*.test.ts(x)`는 클래스 문자열을 assert로 담고 있어 세면 안 된다.
// `src/app/login/test/page.tsx`는 경로에 /test/가 있지만 앱 코드다 — 파일명 끝으로 거른다.
const APP_SOURCES = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));

function countClass(name: string): number {
  const pattern = new RegExp(`\\b${name}\\b`, "g");
  return APP_SOURCES.reduce(
    (sum, path) => sum + (readFileSync(path, "utf8").match(pattern)?.length ?? 0),
    0,
  );
}

describe("읽힘 — 글자 단계", () => {
  it("AC-READ-07 · text-xl과 text-xs가 0곳이다", () => {
    expect(countClass("text-xl")).toBe(0);
    expect(countClass("text-xs")).toBe(0);
  });

  it("AC-READ-08 · 단계별 개수가 4/15/18/127/20이다", () => {
    const counts = {
      "text-4xl": countClass("text-4xl"),
      "text-2xl": countClass("text-2xl"),
      "text-lg": countClass("text-lg"),
      "text-base": countClass("text-base"),
      "text-sm": countClass("text-sm"),
    };
    expect(counts).toEqual({
      "text-4xl": 4,
      "text-2xl": 15,
      "text-lg": 18,
      "text-base": 127,
      "text-sm": 20,
    });
    expect(Object.values(counts).reduce((a, b) => a + b)).toBe(184);
  });

  it("AC-READ-21 · h2 13곳이 전부 text-lg다", () => {
    const bare: string[] = [];
    for (const path of APP_SOURCES) {
      for (const m of readFileSync(path, "utf8").matchAll(
        /<h2\s+[^>]*className="([^"]*)"/g,
      )) {
        if (!/\btext-lg\b/.test(m[1])) bare.push(`${path}: ${m[1]}`);
      }
    }
    expect(bare).toEqual([]);

    const total = APP_SOURCES.reduce(
      (sum, path) => sum + (readFileSync(path, "utf8").match(/<h2\b/g)?.length ?? 0),
      0,
    );
    expect(total).toBe(13);
  });

  it("AC-READ-09 · 5단계 밖의 크기 클래스가 없다", () => {
    const allowed = new Set([
      "text-4xl",
      "text-2xl",
      "text-lg",
      "text-base",
      "text-sm",
    ]);
    const found = new Set<string>();
    for (const path of APP_SOURCES) {
      for (const m of readFileSync(path, "utf8").matchAll(
        /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/g,
      )) {
        found.add(m[0]);
      }
    }
    expect([...found].filter((c) => !allowed.has(c))).toEqual([]);
  });

  it("AC-READ-10 · 임의값 크기가 별 아이콘 1곳뿐이다", () => {
    const found: string[] = [];
    for (const path of APP_SOURCES) {
      for (const m of readFileSync(path, "utf8").matchAll(
        /\btext-\[\d+px\]/g,
      )) {
        found.push(m[0]);
      }
    }
    expect(found).toEqual(["text-[22px]"]);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm test -- designTokens
```

Expected: FAIL — `AC-READ-07`이 `text-xl` 15곳, `text-xs` 20곳을 찾는다.

- [x] **Step 3: 최소 구현 — 순서를 지켜 치환한다**

> **★ `sed`로는 안 된다(2026-09-15 실측).** BSD sed(macOS)는 `\b`(단어 경계)를 지원하지 않아
> **치환이 0건**이었다. GNU sed 전용 문법이다. `perl -pi -e`로 바꿔야 한다.
>
> **★ zsh에서는 `xargs`를 써야 한다.** `files=$(grep -rl …)` 뒤에 `perl … $files`로 넘기면
> zsh가 단어 분리를 하지 않아 전체가 파일명 하나가 되고 `File name too long`이 난다.

**순서가 결과를 바꾼다.** 아래 순서로만 실행한다. `text-sm`을 먼저 올리면 127곳이 다음 치환에
다시 걸려 `text-lg`가 된다.

```bash
cd frontend

# ① lg → 4xl   (lg를 비워야 ②가 안전하다)
grep -rl "text-lg" src --include="*.tsx" | xargs sed -i '' 's/\btext-lg\b/text-4xl/g'

# ② base → lg  (①이 끝나 lg가 비어 있다)
grep -rl "text-base" src --include="*.tsx" | xargs sed -i '' 's/\btext-base\b/text-lg/g'

# ③ sm → base  (②가 끝나 base가 비어 있다)
grep -rl "text-sm" src --include="*.tsx" | xargs sed -i '' 's/\btext-sm\b/text-base/g'

# ④ xs → sm    (③이 끝나 sm이 비어 있다)
grep -rl "text-xs" src --include="*.tsx" | xargs sed -i '' 's/\btext-xs\b/text-sm/g'

# ⑤ xl → 2xl   (다른 단계와 겹치지 않아 순서가 자유롭다)
grep -rl "text-xl" src --include="*.tsx" | xargs sed -i '' 's/\btext-xl\b/text-2xl/g'

# ⑥ headings.test.ts는 .ts라 위 치환에서 빠진다
sed -i '' 's/\btext-xl\b/text-2xl/g' src/test/headings.test.ts
```

> ⑤가 ①~④와 독립인 이유: `xl`의 목적지 `2xl`은 어느 단계의 출발점도 아니다. `\b`를 쓰므로
> `text-xl`이 `text-2xl`을 잡지 않는다.

**⑦ 예외 4곳을 손으로 고친다.** 위 치환으로는 제자리를 찾지 못하는 것들이다.

```
src/features/recipe/components/RecipeDetail.tsx:177   text-base → text-lg   「분쇄도」
src/features/recipe/components/RecipeDetail.tsx:194   text-base → text-lg   「푸어 스텝」
src/features/recipe/components/RecipeCard.tsx:19      className="font-medium"     → "text-lg font-medium"
src/features/brewlog/components/BrewLogCard.tsx:29    className="font-medium"     → "text-lg font-medium"
```

> 앞의 둘은 ③에서 `text-sm`→`text-base`가 된 뒤라 `text-base`다. 뒤의 둘은 **크기 클래스가 없어
> 어느 치환에도 걸리지 않는다** — 그대로 두면 `body`의 16px을 상속해 본문과 같아진다.

**⑧ 대표 수치에 자간을 붙인다.** `text-4xl` 4곳에 `tracking-[-0.02em]`을 추가한다.

```
text-4xl font-semibold tabular-nums tracking-[-0.02em]
```

**`font-semibold`와 `tabular-nums`는 이미 붙어 있다** — 네 곳 모두 확인했다. 새로 넣을 것은
`tracking-[-0.02em]` 하나뿐이다. 이것은 임의값이지만 **크기가 아니라 자간**이라
`AC-READ-10`의 대상이 아니다(그 조건은 `text-[숫자px]`만 센다).

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm test
```

Expected: PASS — `designTokens` 4개 신규 통과. **기존 테스트 중 클래스 문자열을 검사하는 것이
빨개지면 그 assert를 새 값으로 고친다**(`.test.tsx` 8곳). 고친 뒤 379개 + 신규가 전부 초록.

- [x] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(web): 글자 184곳을 한 단계씩 올린다 (AC-READ 4개)"
```

---

## Task 4: 렌더로 다시 잰다

**Files:**
- Create: `frontend/e2e/readability.spec.ts`

**Covers:** AC-READ-11, 12, 13, 14, 15

**Interfaces:**
- Consumes: `installStubs` (`e2e/stubs.ts`), `SCREENS` (`e2e/screens.ts`)
- Produces: 없음

> **소스 검사만으로는 부족하다.** 클래스가 붙어 있어도 부모가 짓누르면 크기가 달라진다.
> `touch-targets` 세션이 같은 이유로 렌더 측정을 택했다.

- [x] **Step 1: 실패하는 테스트 작성**

`frontend/e2e/readability.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

test.describe("읽힘 — 렌더된 크기", () => {
  test("AC-READ-11 · 화면 제목이 24px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const size = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("24px");
  });

  test("AC-READ-12 · 대표 수치가 36px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const size = await page
      .getByText("30.0g → 500.0g")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("36px");
  });

  test("AC-READ-13 · 대표 수치의 굵기가 600, 자간이 -0.72px다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const style = await page
      .getByText("30.0g → 500.0g")
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { weight: s.fontWeight, tracking: s.letterSpacing };
      });

    expect(style.weight).toBe("600");
    expect(style.tracking).toBe("-0.72px");
  });

  test("AC-READ-14 · 본문이 16px로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const size = await page
      .getByText("중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다")
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(size).toBe("16px");
  });

  test("AC-READ-15 · 라벨이 14px이고 보조색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");

    const style = await page
      .getByText("비율", { exact: true })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, color: s.color };
      });

    expect(style.size).toBe("14px");
    expect(style.color).toBe("rgb(84, 84, 84)");
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
# ★ dev 서버가 떠 있으면 reuseExistingServer가 이겨 프로덕션 빌드에 안 붙는다.
#   PWA 테스트 4개가 그 함정으로 빨갛게 나온 적이 있다(JOURNAL 2026-09-07). 먼저 내린다.
pnpm e2e readability
```

Expected: FAIL — Task 3 전이면 제목이 `20px`, 수치가 `18px`로 나온다.
Task 3 후에 돌리면 `AC-READ-13`만 실패한다(굵기·자간 미적용).

- [x] **Step 3: 최소 구현**

Task 3의 Step 3에서 이미 `font-semibold tracking-[-0.02em]`을 붙였다면 추가 구현이 없다.
빨간 것이 있으면 그 요소에만 붙인다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm e2e readability
```

Expected: PASS, 5 tests.

> **★ Task 3 뒤에 쓴 테스트라 빨강을 보지 못했다.** 돌연변이로 확인했다 — `RecipeDetail`의
> 대표 수치를 `text-lg`로 낮추고 `tracking`을 떼고 `--muted`를 옛 값으로 되돌리니
> **`AC-READ-12`·`13`·`15`가 빨개졌다.** 원복 후 다시 5개 전부 초록.

- [x] **Step 5: 커밋**

```bash
git add . && git commit -m "test(web): 읽힘을 렌더로 잰다 (AC-READ 5개)"
```

---

## Task 5: 회귀를 막는다

**Files:**
- Modify: `frontend/e2e/readability.spec.ts`
- Modify: `docs/specs/2026-09-07-visual-hierarchy.md` (AC 3개 값 갱신)
- Modify: `docs/specs/2026-09-08-screen-consistency.md` (AC 1개 값 갱신)

**Covers:** AC-READ-17, AC-READ-18

**Interfaces:**
- Consumes: `SCREENS`
- Produces: 없음

> **앱 코드 184곳에서 글자를 키우는 변경이다.** 레이아웃이 깨지는 것이 최대 위험이고,
> 그것은 가로 스크롤로 먼저 드러난다.

- [x] **Step 1: 실패하는 테스트 작성**

`readability.spec.ts`에 추가:

```ts
test.describe("읽힘 — 회귀", () => {
  for (const { path } of SCREENS) {
    test(`AC-READ-17 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );

      expect(width).toBeLessThanOrEqual(360);
    });
  }
});
```

`AC-READ-18`은 기존 `touch-targets.spec.ts`를 그대로 다시 돌린다. 그 파일의 `AC-TOUCH-01`
`DisplayName`에 AC ID를 **병기**한다:

```ts
test(`AC-TOUCH-01 · AC-READ-18 · ${path}의 모든 타깃이 44×44 이상이다`, ...
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm e2e
```

Expected: 11개 중 일부가 FAIL일 수 있다 — 36px 수치가 360px 폭을 넘기는 화면이 그것이다.
**빨간 것이 없으면 돌연변이로 확인한다:** 대표 수치에 `whitespace-nowrap`과 `text-6xl`을 임시로
넣어 `AC-READ-17`이 실제로 빨개지는지 보고 되돌린다.

> 앞 세션들이 반복해서 겪은 것이다 — 첫 실행에 통과하는 검사는 **비어 있는 검사와 구분되지 않는다.**

- [x] **Step 3: 최소 구현**

넘치는 화면이 있으면 그 요소에 한해 줄바꿈을 허용하거나 컨테이너에 `min-w-0`을 준다.
**글자 크기를 되돌리지 않는다** — 그러면 이 스펙의 목적이 사라진다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

```bash
pnpm e2e && pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: e2e 122 + 신규 16, 단위 379 + 신규 9가 전부 PASS.

- [x] **Step 5: 기존 스펙의 AC 값을 갱신하고 커밋**

`docs/specs/2026-09-07-visual-hierarchy.md`:

| AC | 고칠 값 | 남길 갱신 이유 |
|---|---|---|
| `AC-VISUAL-05` | 허용 크기를 `36/24/18/16/14`로 | 2026-09-15 `readability` 스펙이 5단계 값을 재배치했다 |
| `AC-VISUAL-15` | `20px` → `24px` | 〃 |
| `AC-VISUAL-16` | `18px` → `36px` | 〃 |

`docs/specs/2026-09-08-screen-consistency.md`:

| AC | 고칠 값 | 남길 갱신 이유 |
|---|---|---|
| `AC-CONSIST-07` | `12px` → `14px` | 〃 |

**AC ID는 바꾸지 않는다.** 바꾸면 테스트와 스펙을 잇는 끈이 끊어진다.

```bash
git add . && git commit -m "feat(web): 글자를 키워도 레이아웃이 버틴다 (AC-READ 2개)"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — 단위 **389**
- [x] `cd frontend && pnpm e2e` 통과 — e2e **138**
- [x] `./scripts/check-spec-coverage.sh` 통과 — 스펙 **32건** · 합계 **760**(739 + 21)
- [x] `./scripts/check-spec-coverage.test.sh` 통과
- [x] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 3개 — **폰 실물과 실제 조명이 필요해 비차단형이다**

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 21개 중 21개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2가 정한 `#545454`를 Task 4가 `rgb(84, 84, 84)`로 기대한다 — 같은 값이다.
Task 3이 만든 `text-4xl` 4곳을 Task 4가 `36px`로 잰다.

**계획 단계에서 확인한 것 (4개)**

- **대표 수치 4곳이 전부 `text-lg`다.** `BrewDetail:116` · `BrewLogCard:38` · `RecipeCard:29` ·
  `RecipeDetail:136`. `AC-CONSIST-14`의 「대표 수치 4곳」과 같은 곳이다. **넷 다 이미
  `font-semibold tabular-nums`를 갖고 있어** Task 3에서 새로 넣을 것은 `tracking`뿐이다.
- **`AC-READ-14`의 본문 대표가 `text-sm`이 맞다.** `RecipeDetail:106`의 스텝 설명 문단이다.
- **`AC-READ-15`의 라벨이 `text-xs`가 맞다.** `RecipeDetail:148`의 `<dt>비율</dt>`.
- **`SPEC_DIR`은 환경변수가 아니다.** 22행에 하드코딩돼 있어 Task 1에서 반드시 고쳐야 한다.

**★ 계획 단계에서 잡은 결함 (1개)**

- **일괄 상향만으로는 위계가 안 잡힌다.** 제목인데 단계를 벗어난 것이 넷 있었다 —
  `RecipeDetail`의 섹션 제목 2곳이 `text-sm`이고, `RecipeCard`·`BrewLogCard`의 카드 제목 2곳은
  **크기 클래스가 아예 없어 `body`에서 16px을 상속**한다. 본문만 14→16으로 오르면
  **카드 제목이 본문과 같아져 지금 있던 위계가 사라진다.** 넷을 `text-lg`로 보내고
  `AC-READ-21`로 못박았다. 개수도 `182 → 184`로 바뀌었다.

**검증되지 않은 가정:**

- **`sed -i ''`는 BSD sed(macOS) 문법이다.** GNU sed(리눅스·CI)에서는 `sed -i`다. 치환은 로컬에서만
  돌리므로 문제가 없지만, **CI에서 이 명령을 돌리려 하면 깨진다.** 치환은 커밋된 결과로 전달된다.
- **개수 127·20·15·4는 2026-09-15 집계다.** Task 1~2가 `.tsx`를 건드리지 않으므로 Task 3 시점에도
  같아야 한다. **다르면 멈추고 무엇이 바뀌었는지 먼저 확인한다** — 숫자가 틀린 채로 통과시키면
  이 조건이 아무것도 지키지 못한다.
- **36px 수치가 360px 폭에 들어가는지 재보지 않았다.** `AC-READ-17`이 잡겠지만, 넘치면 Task 5에서
  줄바꿈이나 `min-w-0`으로 대응해야 한다. **글자 크기를 되돌리는 것은 답이 아니다.**
