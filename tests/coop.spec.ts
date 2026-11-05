import { PerspectiveCamera, Vector3 } from "three";
import { test, expect } from "@playwright/test";
test("internet co-op streams a drag before release and preserves partner edits on undo", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.COOP_TEST_SITE || "/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Co-op", exact: true }).click();
  await page.getByLabel("Your name").fill("Alex");
  if (process.env.COOP_TEST_SERVER)
    await page
      .getByLabel("Live server address")
      .fill(process.env.COOP_TEST_SERVER);
  await page
    .getByRole("button", { name: "Create shared session", exact: true })
    .click();
  await expect(page.getByTestId("shared-status")).toContainText("Connected");
  const invite = await page.getByLabel("Partner invite link").inputValue();
  const externalSite =
    process.env.COOP_TEST_PUBLIC || process.env.COOP_TEST_SITE;
  const target = externalSite ? invite : new URL(invite).hash;
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
  });
  const partner = await context.newPage();
  partner.on("pageerror", (e) => errors.push(e.message));
  await partner.goto(externalSite ? target : `http://127.0.0.1:5173/${target}`);
  await expect(partner.getByLabel("Co-op status")).toContainText(
    "Live together",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "Close co-op dialog" }).click();
  await partner.getByRole("button", { name: "Close co-op dialog" }).click();
  for (const p of [page, partner]) {
    await p.getByRole("button", { name: "2D plan", exact: true }).click();
    await p.getByTestId("plan-seed-2").click();
    await p.getByLabel("Avoid collisions").uncheck();
  }
  const before = await partner.getByLabel("X", { exact: true }).inputValue();
  const box = (await page.getByTestId("plan-seed-2").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, {
    steps: 10,
  });
  await expect(partner.getByLabel("X", { exact: true })).not.toHaveValue(
    before,
  );
  const moved = await partner.getByLabel("X", { exact: true }).inputValue();
  await page.mouse.up();
  await partner
    .getByRole("button", { name: "Dusty Pink", exact: true })
    .click();
  await expect(page.getByLabel("HEX value", { exact: true })).toHaveValue(
    "#CF9B9E",
  );
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(partner.getByLabel("X", { exact: true })).toHaveValue(before);
  await expect(page.getByLabel("X", { exact: true })).not.toHaveValue(moved);
  await expect(partner.getByLabel("HEX value", { exact: true })).toHaveValue(
    "#CF9B9E",
  );
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.locator('.scene-editor[data-ready="true"]')).toBeVisible();
  const canvas = (await page.locator("canvas").boundingBox())!;
  const camera = new PerspectiveCamera(
    39,
    canvas.width / canvas.height,
    0.05,
    100,
  );
  camera.position.set(-5, 11, -7);
  camera.lookAt(4.4, 0, 3.3);
  camera.updateMatrixWorld();
  const coords = [1.4, 1].map((x) => {
    const p = new Vector3(x, 0, 3.5).project(camera);
    return {
      x: canvas.x + ((p.x + 1) / 2) * canvas.width,
      y: canvas.y + ((1 - p.y) / 2) * canvas.height,
    };
  });
  await page.mouse.move(coords[0].x, coords[0].y);
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
  await page.mouse.down();
  await page.mouse.move(coords[1].x, coords[1].y, { steps: 12 });
  await expect(partner.getByLabel("X", { exact: true })).not.toHaveValue(
    before,
  );
  await page.mouse.up();
  await expect(partner.locator(".peer-activity")).toHaveCount(0);
  await partner
    .getByLabel("Texture pattern", { exact: true })
    .selectOption("linen");
  await expect(page.getByLabel("Texture pattern", { exact: true })).toHaveValue(
    "linen",
  );
  await context.setOffline(true);
  await expect(partner.getByLabel("Co-op status")).toContainText(
    "Reconnecting",
  );
  await context.setOffline(false);
  await expect(partner.getByLabel("Co-op status")).toContainText(
    "Live together",
    { timeout: 30000 },
  );
  expect(errors).toEqual([]);
  await context.close();
});

test("an unavailable co-op server can be cancelled without blocking solo editing", async ({
  page,
  context,
}) => {
  await page.goto(process.env.COOP_TEST_SITE || "/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Co-op", exact: true }).click();
  if (process.env.COOP_TEST_SERVER)
    await page
      .getByLabel("Live server address")
      .fill(process.env.COOP_TEST_SERVER);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Create shared session", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Cancel connection · keep editing locally",
      exact: true,
    })
    .click();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Close co-op dialog" }).click();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await page.getByTestId("plan-seed-2").click();
  await page.getByLabel("Item name").fill("Solo editing still works");
  await expect(page.getByLabel("Item name")).toHaveValue(
    "Solo editing still works",
  );
});
