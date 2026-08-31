import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { comandanteC40, myComandante } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { UserGrinderDialog } from "./UserGrinderDialog";

const GRINDERS_URL = "http://localhost:8080/api/v1/gear/grinders";
const USER_GRINDERS_URL = "http://localhost:8080/api/v1/gear/user-grinders";

/** 등록 요청의 본문을 붙잡아 두고, 실제 응답 픽스처를 돌려준다. */
function captureCreate() {
  const captured: { body: unknown } = { body: null };
  server.use(
    http.get(GRINDERS_URL, () => HttpResponse.json([comandanteC40])),
    http.post(USER_GRINDERS_URL, async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json(myComandante, { status: 201 });
    }),
  );
  return captured;
}

describe("UserGrinderDialog", () => {
  it("AC-WEBBREW-02 · 모델을 골라 등록하면 그 본문으로 요청한다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();
    const onCreated = vi.fn();

    renderWithQuery(
      <UserGrinderDialog onCreated={onCreated} onCancel={vi.fn()} />,
    );
    await screen.findByRole("option", { name: "Comandante C40 MK4" });
    await user.selectOptions(screen.getByLabelText("모델"), "1");
    await user.type(screen.getByLabelText("별명"), "집");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() =>
      expect(captured.body).toEqual({ grinderModelId: 1, nickname: "집" }),
    );
    expect(onCreated).toHaveBeenCalledWith(myComandante);
  });

  it("AC-WEBBREW-04 · 별명 없이도 등록된다", async () => {
    const user = userEvent.setup();
    const captured = captureCreate();

    renderWithQuery(
      <UserGrinderDialog onCreated={vi.fn()} onCancel={vi.fn()} />,
    );
    await screen.findByRole("option", { name: "Comandante C40 MK4" });
    await user.selectOptions(screen.getByLabelText("모델"), "1");
    await user.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(captured.body).not.toBeNull());
    expect(captured.body).toEqual({ grinderModelId: 1 });
  });
});
