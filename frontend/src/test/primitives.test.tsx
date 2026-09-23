import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  Card,
  Eyebrow,
  Hero,
  Input,
  MetricRow,
  Select,
  Shell,
} from "@/components/ui";

/**
 * UI 프리미티브 — docs/specs/2026-09-17-design-system-v2.md
 *
 * <p>이 계획의 핵심이다. 버튼 하나를 고치려면 수십 곳을 동시에 고쳐야 했다 —
 * 같은 문자열이 8곳·7곳에 복붙돼 있었고, 순서만 다른 변종까지 있었다.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const UI_DIR = join("src", "components", "ui");

/** 프리미티브 밖의 앱 코드. 스타일은 여기 있으면 안 된다. */
const OUTSIDE = walk("src").filter(
  (path) =>
    /\.tsx$/.test(path) &&
    !path.startsWith(UI_DIR) &&
    !/\.test\.tsx$/.test(path),
);

describe("UI 프리미티브", () => {
  it("AC-DS2-18 · src/components/ui에 프리미티브 6종이 있다", () => {
    for (const [name, component] of Object.entries({
      Button,
      Input,
      Select,
      Card,
      Badge,
      MetricRow,
    })) {
      expect(typeof component, name).toBe("function");
    }
  });

  it("AC-DS2-19 · Button이 변형 4종을 가진다", () => {
    const classesOf = (ui: React.ReactElement): string => {
      const { container, unmount } = render(ui);
      const cls = container.querySelector("button")?.className ?? "";
      unmount();
      return cls;
    };

    const primary = classesOf(<Button variant="primary">저장</Button>);
    const secondary = classesOf(<Button variant="secondary">취소</Button>);
    const ghost = classesOf(<Button variant="ghost">더 보기</Button>);
    const disabled = classesOf(<Button disabled>저장</Button>);

    const all = [primary, secondary, ghost];
    expect(new Set(all).size, "세 변형이 서로 달라야 한다").toBe(3);
    // disabled는 변형이 아니라 상태다 — 어느 변형에든 붙는다.
    expect(disabled).toMatch(/disabled:/);
  });

  it("AC-BTN-15 · ButtonLink가 변형 색 테이블을 자체 선언하지 않는다", () => {
    // docs/specs/2026-09-21-button-color-fidelity.md — 색 테이블이 두 곳에 복붙돼 있으면
    // 한쪽만 고쳤을 때 같은 화면에서 두 색이 섞인다.
    const source = readFileSync(
      join("src", "components", "ui", "ButtonLink.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/const\s+VARIANT\s*[:=]/);
    expect(source).toMatch(
      /import\s*\{[^}]*BUTTON_VARIANT[^}]*\}\s*from\s*"\.\/Button"/,
    );
  });

  it("AC-DS2-21 · 프리미티브가 터치 타깃 44px을 보장한다", () => {
    // jsdom은 Tailwind를 로드하지 않아 계산된 높이를 잴 수 없다. 클래스로 본다 —
    // 실제 렌더 높이는 e2e의 AC-TOUCH-01이 스윕으로 잰다.
    const cases: [string, React.ReactElement][] = [
      ["Button", <Button key="b">확인</Button>],
      ["Input", <Input key="i" label="원두량" />],
      ["Select", <Select key="s" label="드리퍼" options={[]} />],
    ];

    for (const [name, ui] of cases) {
      const { container, unmount } = render(ui);
      const control = container.querySelector("button, input, select");
      expect(control?.className, name).toMatch(/\bmin-h-11\b/);
      unmount();
    }
  });

  it("AC-DS2-20 · 프리미티브 밖에서 컨트롤 스타일을 직접 쓰지 않는다", () => {
    /*
     * 지금 이 문자열이 8곳·7곳에 복붙돼 있다. 되돌아가는 것을 막는다.
     *
     * <p><b>요소 이름으로 찾지 않는다.</b> JSX의 `onClick={() => …}`에 `>`가 들어 있어
     * `<button[^>]*className`이 거기서 끊긴다 — 처음엔 그렇게 썼다가 7곳만 잡혔다.
     * 그리고 버튼처럼 생긴 `<Link>`도 같은 스타일을 들고 있으므로 요소로 거르면 새어 나간다.
     *
     * <p>대신 **클래스 조합**으로 본다. `min-h-11`(터치 타깃)과 `rounded-control`(컨트롤 모서리)이
     * 함께 있으면 그것은 컨트롤이고, 프리미티브 밖에 있으면 안 된다.
     */
    const bad: string[] = [];
    for (const path of OUTSIDE) {
      // `className="…"`(JSX)와 `className: "…"`(props 객체) 둘 다 본다.
      // 객체 형태를 빠뜨려 RecipeForm의 shared가 리터럴로 남아 있었다(2026-09-17).
      for (const match of readFileSync(path, "utf8").matchAll(
        /className[:=]\s*"([^"]*)"/g,
      )) {
        const cls = match[1];
        if (/\bmin-h-11\b/.test(cls) && /\brounded-control\b/.test(cls)) {
          bad.push(`${path}: ${cls.slice(0, 50)}…`);
        }
      }
    }

    expect(bad).toEqual([]);
  });

  it("Input이 label을 접근 가능한 이름으로 연결한다", () => {
    render(<Input label="원두량" />);
    expect(screen.getByLabelText("원두량")).toBeDefined();
  });

  it("MetricRow가 dt·dd 쌍을 낸다", () => {
    const { container } = render(<MetricRow label="비율" value="1:16.7" />);
    expect(container.querySelector("dt")?.textContent).toBe("비율");
    expect(container.querySelector("dd")?.textContent).toBe("1:16.7");
  });

  it("AC-SKIN-07 · MetricRow가 원장 행이다 — 위쪽 구분선을 갖는다", () => {
    const { container } = render(<MetricRow label="원두량" value="30.0g" />);
    expect(container.firstElementChild?.className).toMatch(
      /\bborder-t\b.*\bborder-divider\b/,
    );
  });

  it("AC-SKIN-07 · bare면 선을 그리지 않는다", () => {
    // 히어로 안쪽처럼 이미 구분된 자리에서 쓴다.
    const { container } = render(
      <MetricRow label="원두량" value="30.0g" bare />,
    );
    expect(container.firstElementChild?.className).not.toMatch(/\bborder-t\b/);
  });

  it("AC-DS2-22 · 오류 상태 입력의 보더가 danger다", () => {
    // 지금은 입력칸이 그대로고 문구만 아래에 뜬다. 그래서 무엇이 틀렸는지 눈으로 찾게 된다.
    render(<Input label="원두량" error="숫자를 입력하세요" />);
    expect(screen.getByLabelText("원두량").className).toMatch(/\bborder-danger\b/);
  });

  it("AC-DS2-23 · 오류 상태 입력에 aria-invalid가 붙는다", () => {
    render(<Input label="원두량" error="숫자를 입력하세요" />);
    const input = screen.getByLabelText("원두량");

    // 색만 바꾸면 스크린리더 사용자와 색각 이상 사용자에게는 아무 변화가 없다.
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      screen.getByText("숫자를 입력하세요").id,
    );
  });

  it("AC-DS2-24 · 오류가 없으면 aria-invalid가 붙지 않는다", () => {
    render(<Input label="원두량" />);
    // "false"가 아니라 부재여야 한다 — 보조기술이 「검증된 적 없음」과 「통과」를 구분한다.
    expect(screen.getByLabelText("원두량").hasAttribute("aria-invalid")).toBe(
      false,
    );
  });

  it("AC-DS2-22 · AC-DS2-23 · Select도 같게 동작한다", () => {
    render(<Select label="드리퍼" options={[]} error="선택하세요" />);
    const select = screen.getByLabelText("드리퍼");

    expect(select.className).toMatch(/\bborder-danger\b/);
    expect(select.getAttribute("aria-invalid")).toBe("true");
  });

  it("AC-SKIN-06 · Hero와 Eyebrow가 프리미티브로 있다", () => {
    for (const [name, component] of Object.entries({ Hero, Eyebrow, Shell })) {
      expect(typeof component, name).toBe("function");
    }
  });

  it("AC-SKIN-03 · Hero가 data-hero를 단다", () => {
    // 화면의 대표 수치가 이 안에 들어간다. e2e가 data-lead의 조상에서 이것을 찾는다.
    const { container } = render(
      <Hero eyebrow="RATIO" lead="1:16.7">
        <MetricRow label="원두" value="30.0g" />
      </Hero>,
    );
    expect(container.querySelector("[data-hero]")).not.toBeNull();
  });

  it("AC-SKIN-05 · Eyebrow가 data-eyebrow를 단다", () => {
    const { container } = render(<Eyebrow>CURATED</Eyebrow>);
    const el = container.querySelector("[data-eyebrow]");
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe("CURATED");
  });

  it("AC-SKIN-01 · Shell이 화면 공통 컨테이너를 낸다", () => {
    const { container } = render(<Shell><p>본문</p></Shell>);
    const main = container.querySelector("main");
    expect(main?.className).toMatch(/\bmax-w-2xl\b/);
    expect(main?.className).toMatch(/\bpx-6\b/);
  });
});