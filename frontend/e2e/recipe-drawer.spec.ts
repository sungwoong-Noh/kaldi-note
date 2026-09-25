import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

test("AC-RECIPESBREWS-66 · 상세로 이동했다가 뒤로가기하면 조건이 유지된다", async ({
  page,
}) => {
  await installStubs(page);

  await page.goto("/recipes?scope=PUBLIC&temp=HOT");
  await page.getByText("James Hoffmann Ultimate V60").click();
  await expect(page).toHaveURL(/\/recipes\/\d+$/);

  await page.goBack();

  await expect(page).toHaveURL("/recipes?scope=PUBLIC&temp=HOT");
  await expect(page.getByRole("button", { name: "Hot" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
