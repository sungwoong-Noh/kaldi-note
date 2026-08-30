import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithQuery } from "@/test/render";
import { server } from "@/test/msw-server";
import {
  c40Conversion,
  comandanteC40,
  grindNotConvertibleError,
  grindOutOfRangeError,
  wilfaUniform,
} from "@/test/fixtures";
import type { GrindSettingUnit } from "../formState";
import { GrindSettingField } from "./GrindSettingField";

const GRINDERS_URL = "http://localhost:8080/api/v1/gear/grinders";
const CONVERSION_URL = "http://localhost:8080/api/v1/gear/grind-conversions";

function grindersReturn(...models: object[]) {
  return http.get(GRINDERS_URL, () => HttpResponse.json(models));
}

/** 폼 상태를 들고 있는 테스트용 부모. 실제로는 RecipeForm이 이 역할을 한다. */
function Harness() {
  const [grinderModelId, setGrinderModelId] = useState<number | null>(null);
  const [unit, setUnit] = useState<GrindSettingUnit | null>(null);
  const [value, setValue] = useState<number | null>(null);

  return (
    <GrindSettingField
      grinderModelId={grinderModelId}
      unit={unit}
      value={value}
      onGrinderChange={setGrinderModelId}
      onUnitChange={setUnit}
      onValueChange={setValue}
    />
  );
}

async function fillGrindSetting(
  user: ReturnType<typeof userEvent.setup>,
  {
    grinder,
    unit,
    value,
  }: { grinder?: { id: string; name: string }; unit: string; value: string },
) {
  if (grinder) {
    // 옵션이 도착할 때까지 기다린다. select 요소는 바로 있지만 목록은 쿼리가 끝나야 채워진다.
    await screen.findByRole("option", { name: grinder.name });
    await user.selectOptions(screen.getByLabelText("그라인더"), grinder.id);
  }
  await user.selectOptions(screen.getByLabelText("분쇄도 단위"), unit);
  await user.type(screen.getByLabelText("분쇄도 값"), value);
}

const C40 = { id: "1", name: "Comandante C40 MK4" };
const WILFA = { id: "10", name: "Wilfa Uniform" };

describe("GrindSettingField", () => {
  it("AC-WEBEDIT-25 · 셋이 채워지면 같은 그라인더로 환산을 부른다", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      grindersReturn(comandanteC40),
      http.post(CONVERSION_URL, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(c40Conversion);
      }),
    );

    renderWithQuery(<Harness />);
    await fillGrindSetting(user, { grinder: C40, unit: "CLICK", value: "22" });

    expect(await screen.findByText(/약 660 µm/)).toBeInTheDocument();
    // 400ms 디바운스가 있으므로 "2"를 거쳐 "22"를 쳐도 요청은 마지막 값 하나뿐이다.
    expect(bodies).toEqual([
      { sourceGrinderModelId: 1, sourceSetting: 22, targetGrinderModelId: 1 },
    ]);
  });

  it("AC-WEBEDIT-26 · 환산값에는 추정치라는 표기가 함께 붙는다", async () => {
    const user = userEvent.setup();
    server.use(
      grindersReturn(comandanteC40),
      http.post(CONVERSION_URL, () => HttpResponse.json(c40Conversion)),
    );

    renderWithQuery(<Harness />);
    await fillGrindSetting(user, { grinder: C40, unit: "CLICK", value: "22" });

    expect(await screen.findByText(/추정치/)).toBeInTheDocument();
  });

  it("AC-WEBEDIT-27 · 무단계 그라인더는 안내만 하고 저장을 막지 않는다", async () => {
    const user = userEvent.setup();
    server.use(
      grindersReturn(wilfaUniform),
      http.post(CONVERSION_URL, () =>
        HttpResponse.json(grindNotConvertibleError, { status: 422 }),
      ),
    );

    renderWithQuery(<Harness />);
    await fillGrindSetting(user, { grinder: WILFA, unit: "CLICK", value: "5" });

    expect(
      await screen.findByText("이 그라인더는 환산 정보가 없습니다"),
    ).toBeInTheDocument();
  });

  it("AC-WEBEDIT-28 · 범위 밖 설정값은 서버 문구로 경고한다", async () => {
    const user = userEvent.setup();
    server.use(
      grindersReturn(comandanteC40),
      http.post(CONVERSION_URL, () =>
        HttpResponse.json(grindOutOfRangeError, { status: 400 }),
      ),
    );

    renderWithQuery(<Harness />);
    await fillGrindSetting(user, { grinder: C40, unit: "CLICK", value: "60" });

    expect(
      await screen.findByText("설정값 60는 이 그라인더의 상한 50.00를 넘습니다."),
    ).toBeInTheDocument();
  });

  it("AC-WEBEDIT-29 · 단위가 마이크론이면 환산을 부르지 않는다", async () => {
    const user = userEvent.setup();
    let called = 0;
    server.use(
      grindersReturn(comandanteC40),
      http.post(CONVERSION_URL, () => {
        called += 1;
        return HttpResponse.json(c40Conversion);
      }),
    );

    renderWithQuery(<Harness />);
    await fillGrindSetting(user, { unit: "MICRON", value: "800" });

    expect(await screen.findByText(/약 800 µm/)).toBeInTheDocument();
    expect(screen.getByText(/추정치/)).toBeInTheDocument();
    // 잠깐 기다려도 호출이 없어야 한다 — 렌더 직후만 보면 아직 안 불린 것과 구분되지 않는다.
    await waitFor(() => expect(called).toBe(0));
  });

  it("셋 중 하나라도 비어 있으면 아무것도 부르지 않는다", async () => {
    const user = userEvent.setup();
    let called = 0;
    server.use(
      grindersReturn(comandanteC40),
      http.post(CONVERSION_URL, () => {
        called += 1;
        return HttpResponse.json(c40Conversion);
      }),
    );

    renderWithQuery(<Harness />);
    await screen.findByRole("option", { name: C40.name });
    await user.selectOptions(screen.getByLabelText("그라인더"), "1");
    await user.selectOptions(screen.getByLabelText("분쇄도 단위"), "CLICK");

    await waitFor(() => expect(called).toBe(0));
    expect(screen.queryByText(/µm/)).not.toBeInTheDocument();
  });
});
