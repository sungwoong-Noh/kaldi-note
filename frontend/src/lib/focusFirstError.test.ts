import { afterEach, describe, expect, it } from "vitest";
import { focusFirstInvalidField } from "./focusFirstError";

function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusFirstInvalidField", () => {
  it("DOM 순서상 첫 번째 aria-invalid=true 요소로 포커스가 간다", () => {
    const container = mount(`
      <input id="a" />
      <input id="b" aria-invalid="true" />
      <input id="c" aria-invalid="true" />
    `);

    focusFirstInvalidField(container);

    expect(document.activeElement).toBe(container.querySelector("#b"));
  });

  it("invalid 필드가 없으면 [data-general-error]로 포커스가 간다", () => {
    const container = mount(`
      <input id="a" />
      <p id="msg" data-general-error tabindex="-1">문제가 있습니다</p>
    `);

    focusFirstInvalidField(container);

    expect(document.activeElement).toBe(container.querySelector("#msg"));
  });

  it("둘 다 없으면 아무 일도 하지 않는다", () => {
    const container = mount(`<input id="a" />`);

    expect(() => focusFirstInvalidField(container)).not.toThrow();
    expect(document.activeElement).not.toBe(container.querySelector("#a"));
  });

  it("container가 null이면 아무 일도 하지 않는다", () => {
    expect(() => focusFirstInvalidField(null)).not.toThrow();
  });
});
