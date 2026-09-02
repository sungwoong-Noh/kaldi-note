import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import {
  fritzRoaster,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import { useBeanLabel } from "./useEntityLabels";

const BASE = "http://localhost:8080/api/v1";

function BeanLabel({ batchId }: { batchId: number }) {
  return <p data-testid="label">{useBeanLabel(batchId, true).label}</p>;
}

beforeEach(() => {
  clearSession();
  setAccessToken("test.access.token");
});

/**
 * 조회 연쇄가 실패를 삼키지 않는지 본다.
 *
 * <p>배치가 403이면 제품 조회는 `enabled: false`로 남고, 그 상태의 `isPending`은 `true`다.
 * 판정이 pending을 먼저 보면 폴백 대신 빈 자리가 나온다 — 계획의 미확인 가정 1번이 이것이다.
 * `entityLabel.test.ts`가 함수 단위로 막고 있으나, 훅이 스냅샷을 어떤 순서로 넘기는지는 여기서만 드러난다.
 */
describe("useBeanLabel", () => {
  it("배치가 403이면 뒤 조회가 pending이어도 비공개 원두다", async () => {
    server.use(
      http.get(`${BASE}/bean-batches/3`, () =>
        HttpResponse.json(
          { code: "FORBIDDEN", message: "본인의 재고만 접근할 수 있습니다." },
          { status: 403 },
        ),
      ),
      http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    );

    renderWithQuery(<BeanLabel batchId={3} />);

    await waitFor(() =>
      expect(screen.getByTestId("label")).toHaveTextContent("비공개 원두"),
    );
  });

  it("세 조회가 모두 성공하면 로스터와 제품을 잇는다", async () => {
    server.use(
      http.get(`${BASE}/bean-batches/3`, () =>
        HttpResponse.json(yirgacheffeBatch),
      ),
      http.get(`${BASE}/bean-products/3`, () =>
        HttpResponse.json(yirgacheffeProduct),
      ),
      http.get(`${BASE}/roasters`, () => HttpResponse.json([fritzRoaster])),
    );

    renderWithQuery(<BeanLabel batchId={3} />);

    await waitFor(() =>
      expect(screen.getByTestId("label")).toHaveTextContent("프릿츠 예가체프"),
    );
  });
});
