import { test, expect } from "@playwright/test";
async function start(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
}
test("przesuwanie sofy, materiały, historia, 3D i zapis po odświeżeniu", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByTestId("plan-seed-2").click();
  await page.getByLabel("Avoid collisions").uncheck();
  const sofa = page.getByTestId("plan-seed-2");
  const before = await page.getByLabel("X", { exact: true }).inputValue();
  const box = await sofa.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 25,
    box!.y + box!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  const moved = await page.getByLabel("X", { exact: true }).inputValue();
  expect(moved).not.toBe(before);
  await page.getByRole("button", { name: "Dusty Pink", exact: true }).click();
  await page.getByLabel("Material", { exact: true }).selectOption("matte");
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue(
    "fabric",
  );
  await page
    .getByRole("button", { name: "Redo (Ctrl+Shift+Z)", exact: true })
    .click();
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue(
    "matte",
  );
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(moved);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("safely saved");
  await page.reload();
  await expect(page.getByText("Saved locally", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await page.getByTestId("plan-seed-2").click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(moved);
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue(
    "matte",
  );
  expect(errors).toEqual([]);
});
test("pomieszczenia, frezje, otwory i zachowanie granic", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Add room", exact: true }).click();
  await page.getByPlaceholder("Room name").fill("Studio");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await expect(page.getByRole("button", { name: /Studio 9.0/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Plants & freesias", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add: Pink freesias", exact: true })
    .click();
  await expect(page.getByLabel("Item name")).toHaveValue("Pink freesias");
  await page.getByLabel("Freesia vase").selectOption("glass");
  const x = await page.getByLabel("X", { exact: true }).inputValue();
  await page.getByLabel("X", { exact: true }).fill("-40");
  await page.getByLabel("X", { exact: true }).press("Tab");
  await expect(page.getByLabel("X", { exact: true })).toHaveValue(x);
  await expect(page.getByRole("status")).toContainText("must fit");
  await page.getByRole("button", { name: "Door", exact: true }).click();
  const openings = page.locator('[data-testid^="opening-"]');
  const beforeOpenings = await openings.count();
  const wall = page.locator(".wall-hit").last();
  const b = await wall.boundingBox();
  await page.mouse.click(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await expect(openings).toHaveCount(beforeOpenings + 1);
  await openings.last().locator("rect").click();
  await expect(
    page.getByRole("heading", { name: "Door", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Opening width", { exact: true }).fill("0.8");
  await page.getByLabel("Opening width", { exact: true }).press("Tab");
  await expect(openings.last().locator("rect")).toHaveAttribute("width", "0.8");
  await page
    .getByRole("button", { name: "Delete opening", exact: true })
    .click();
  await expect(openings).toHaveCount(beforeOpenings);
});
test("warianty, budżet, lista zakupów i poprawny import/eksport", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Planning", exact: true }).click();
  await page.getByLabel("Version name").fill("Evening freesias");
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Evening freesias", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Budget", exact: true }).click();
  await page.getByLabel("Cost: Cloud sofa", { exact: true }).fill("300000");
  await page.getByLabel("Cost: Cloud sofa", { exact: true }).press("Tab");
  await expect(
    page.getByText("₩300,000", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Purchased: Cloud sofa", { exact: true }).check();
  await page
    .getByRole("button", { name: "Shopping list", exact: true })
    .click();
  await expect(
    page.getByLabel("Purchased: Cloud sofa", { exact: true }),
  ).toBeChecked();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const d = await download;
  const stream = await d.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const json = Buffer.concat(chunks).toString();
  expect(JSON.parse(json).rooms).toHaveLength(7);
  await page.locator("input[type=file]").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect(page.getByRole("status")).toContainText("imported");
  await page.locator("input[type=file]").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":9}'),
  });
  await expect(page.getByRole("status")).toContainText("Invalid");
});
test("telefon: bez przepełnienia, zmiana widoku i podstawowa edycja", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByTestId("plan-seed-2").click();
  await page.getByLabel("Item name").fill("Our sofa");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Item name")).toHaveValue("Our sofa");
});
import { PerspectiveCamera, Vector3 } from "three";
test("manipulator 3D przesuwa tę samą sofę w planie 2D", async ({ page }) => {
  await start(page);
  await page.getByTestId("plan-seed-2").click();
  await page.getByLabel("Avoid collisions").uncheck();
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator('.scene-editor[data-ready="true"]')).toBeVisible();
  const box = (await page.locator("canvas").boundingBox())!;
  const camera = new PerspectiveCamera(39, box.width / box.height, 0.05, 100);
  camera.position.set(-5, 11, -7);
  camera.lookAt(4.4, 0, 3.3);
  camera.updateMatrixWorld();
  const coords = [1.4, 1].map((x) => {
    const p = new Vector3(x, 0, 3.5).project(camera);
    return {
      x: box.x + ((p.x + 1) / 2) * box.width,
      y: box.y + ((1 - p.y) / 2) * box.height,
    };
  });
  const before = await page.getByLabel("X", { exact: true }).inputValue();
  await page.mouse.move(coords[0].x, coords[0].y);
  // Hover changes the active gizmo plane; let its world matrix reach a rendered frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.mouse.down();
  await page.mouse.move(coords[1].x, coords[1].y, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByLabel("Item name")).toHaveValue("Cloud sofa");
  await expect(page.getByLabel("X", { exact: true })).not.toHaveValue(before);
  const after = await page.getByLabel("X", { exact: true }).inputValue();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  const transform = await page
    .getByTestId("plan-seed-2")
    .getAttribute("transform");
  const position = transform!.match(/translate\(([-.\d]+) ([-.\d]+)\)/)!;
  expect(Number(position[1])).toBeCloseTo(Number(after), 5);
  expect(Number(position[2])).toBeCloseTo(3.5, 5);
});
test("siedem pokoi: notatki, narożnik, cofanie obrysu i zoom bez błędów", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await start(page);
  const rows = page.locator(".room-row");
  for (let i = 0; i < 7; i++) {
    await rows.nth(i).click();
    await page.getByLabel("Room notes").fill(`Pomysł dla pokoju ${i}`);
    await expect(page.getByLabel("Room notes")).toHaveValue(
      `Pomysł dla pokoju ${i}`,
    );
  }
  await rows.first().click();
  await page.getByRole("button", { name: "Outline", exact: true }).click();
  const corner = page.locator(".corner-handle").first();
  const box = (await corner.boundingBox())!;
  const before = await page
    .getByLabel("Room width", { exact: true })
    .inputValue();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - 10,
    box.y + box.height / 2 - 10,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Room width", { exact: true })).not.toHaveValue(
    before,
  );
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(page.getByLabel("Room width", { exact: true })).toHaveValue(
    before,
  );
  const svg = page.getByRole("application");
  const viewBox = await svg.getAttribute("viewBox");
  await svg.hover();
  await page.mouse.wheel(0, -120);
  await expect(svg).not.toHaveAttribute("viewBox", viewBox!);
  expect(errors).toEqual([]);
});
test("resize and position a furnished room, drag it, undo, and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await page.locator(".room-row").first().click();
  const originalSofa = await page
    .getByTestId("plan-seed-2")
    .getAttribute("transform");
  await page.getByLabel("Room width", { exact: true }).fill("4");
  await page.getByLabel("Room width", { exact: true }).press("Enter");
  await page.getByLabel("Room depth", { exact: true }).fill("3.6");
  await page.getByLabel("Room depth", { exact: true }).press("Enter");
  await expect(page.getByLabel("Room width", { exact: true })).toHaveValue("4");
  await expect(page.getByLabel("Room depth", { exact: true })).toHaveValue(
    "3.6",
  );
  await expect(page.getByTestId("plan-seed-2")).not.toHaveAttribute(
    "transform",
    originalSofa!,
  );
  await page.getByLabel("Room X", { exact: true }).fill("-2");
  await page.getByLabel("Room X", { exact: true }).press("Enter");
  await page.getByLabel("Room Z", { exact: true }).fill("1");
  await page.getByLabel("Room Z", { exact: true }).press("Enter");
  await expect(page.getByLabel("Room X", { exact: true })).toHaveValue("-2");
  await expect(page.getByLabel("Room Z", { exact: true })).toHaveValue("1");
  await page
    .getByRole("button", { name: "Move room in 2D", exact: true })
    .click();
  const room = page.getByTestId("room-floor-living");
  const box = (await room.boundingBox())!;
  // An empty part of the room floor; furniture is ignored by the room-moving tool.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.5 + 25,
    box.y + box.height * 0.35 + 18,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Room X", { exact: true })).not.toHaveValue(
    "-2",
  );
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(page.getByLabel("Room X", { exact: true })).toHaveValue("-2");
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-editor[data-ready=true]")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("safely saved");
  await page.reload();
  await page.getByText("Saved locally", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await page.locator(".room-row").first().click();
  await expect(page.getByLabel("Room width", { exact: true })).toHaveValue("4");
  await expect(page.getByLabel("Room depth", { exact: true })).toHaveValue(
    "3.6",
  );
  await expect(page.getByLabel("Room X", { exact: true })).toHaveValue("-2");
  await expect(page.getByLabel("Room Z", { exact: true })).toHaveValue("1");
  expect(errors).toEqual([]);
});
test("all application views and default data are English", async ({ page }) => {
  await start(page);
  await expect(page).toHaveTitle("Our Home — our shared space");
  expect(await page.locator("html").getAttribute("lang")).toBe("en");
  for (const name of [
    "Project",
    "Rooms",
    "Planning",
    "Budget",
    "Shopping list",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(await page.locator("body").innerText()).not.toMatch(
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|Nasz Dom|Nasze miejsce|Seulu/,
    );
  }
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await page.getByTestId("plan-seed-2").click();
  await expect(page.getByLabel("Item name")).toHaveValue("Cloud sofa");
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue(
    "fabric",
  );
  await page.getByRole("button", { name: "Edit room", exact: true }).click();
  await expect(page.getByLabel("Room width", { exact: true })).toBeVisible();
});
async function exportedProject(page: import("@playwright/test").Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const d = await event,
    stream = await d.createReadStream(),
    chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function textureImage(page: import("@playwright/test").Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f5d675";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#4b695b";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);
    return c.toDataURL("image/png").split(",")[1];
  });
  return {
    name: "woven-test.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  };
}
test("item image texture renders, survives save and JSON import, and can be removed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByTestId("plan-seed-2").click();
  await page
    .getByLabel("Texture image")
    .setInputFiles(await textureImage(page));
  await expect(page.getByLabel("Texture pattern")).toHaveValue("custom");
  await expect(page.getByText("woven-test.png", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Use image colours", exact: true })
    .click();
  await page.getByLabel("Texture repeat").fill("2.5");
  await page.getByLabel("Texture repeat").press("Enter");
  await page.getByLabel("Texture rotation").fill("45");
  await page.getByLabel("Texture rotation").press("Enter");
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-editor[data-ready=true]")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("safely saved");
  const data = await exportedProject(page);
  const f = data.furniture.find((f: { id: string }) => f.id === "seed-2");
  expect(f.surface.texture).toBe("custom");
  expect(f.surface.image).toMatch(/^data:image\/webp;base64,/);
  expect(f.surface.repeat).toBe(2.5);
  expect(f.surface.rotation).toBe(45);
  expect(f.color).toBe("#ffffff");
  expect(
    data.furniture.find((f: { id: string }) => f.id === "seed-3").surface,
  ).toBeUndefined();
  await page.reload();
  await page.getByText("Saved locally", { exact: true }).waitFor();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await page.getByTestId("plan-seed-2").click();
  await expect(page.getByLabel("Texture pattern")).toHaveValue("custom");
  await expect(page.getByLabel("Texture repeat")).toHaveValue("2.5");
  await page
    .getByRole("button", { name: "Remove texture", exact: true })
    .click();
  await expect(page.getByLabel("Texture pattern")).toHaveValue("none");
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles({
      name: "textured.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page.getByTestId("plan-seed-2").click();
  await expect(page.getByLabel("Texture pattern")).toHaveValue("custom");
  expect(errors).toEqual([]);
});
test("individual walls and floors have independent saved finishes and live 3D changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await page.locator(".room-row").first().click();
  await page.getByRole("button", { name: "Surfaces", exact: true }).click();
  await page.getByLabel("Surface target").selectOption("walls");
  await page.getByLabel("HEX value").fill("#D3B99B");
  await page.getByLabel("HEX value").press("Enter");
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-editor[data-ready=true]")).toBeVisible();
  const before = await page.locator("canvas").screenshot();
  await page.getByLabel("Texture pattern").selectOption("brick");
  await expect
    .poll(async () =>
      Buffer.compare(before, await page.locator("canvas").screenshot()),
    )
    .not.toBe(0);
  await page.getByLabel("Surface target").selectOption("wall-1");
  await page.getByLabel("Texture pattern").selectOption("stripes");
  await page.getByLabel("HEX value").fill("#92A381");
  await page.getByLabel("HEX value").press("Enter");
  await page.getByLabel("Surface target").selectOption("floor");
  await page.getByLabel("Texture pattern").selectOption("tiles");
  await page.getByLabel("Material", { exact: true }).selectOption("stone");
  await page.getByLabel("Texture repeat").fill("3");
  await page.getByLabel("Texture repeat").press("Enter");
  const data = await exportedProject(page);
  const room = data.rooms.find((r: { id: string }) => r.id === "living");
  expect(room.wallSurface.texture).toBe("brick");
  expect(room.wallSurfaces["1"].texture).toBe("stripes");
  expect(room.wallSurfaces["1"].color).toBe("#92A381");
  expect(room.floorSurface.texture).toBe("tiles");
  expect(room.floorSurface.repeat).toBe(3);
  expect(
    data.rooms.find((r: { id: string }) => r.id === "kitchen").wallSurface,
  ).toBeUndefined();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("safely saved");
  await page.reload();
  await page.getByText("Saved locally", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await page.locator(".room-row").first().click();
  await page.getByRole("button", { name: "Surfaces", exact: true }).click();
  await page.getByLabel("Surface target").selectOption("wall-1");
  await expect(page.getByLabel("Texture pattern")).toHaveValue("stripes");
  await page
    .getByRole("button", { name: "Apply to all walls", exact: true })
    .click();
  await page.getByLabel("Surface target").selectOption("wall-2");
  await expect(page.getByLabel("Texture pattern")).toHaveValue("stripes");
  await page
    .getByRole("button", { name: "Undo (Ctrl+Z)", exact: true })
    .click();
  await expect(page.getByLabel("Texture pattern")).toHaveValue("brick");
  expect(errors).toEqual([]);
});
test("wall selection opens its finish editor and invalid images do not overwrite a finish", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByTestId("wall-living-0").click();
  await expect(page.getByLabel("Surface target")).toHaveValue("wall-0");
  const before = await page.getByLabel("Texture pattern").inputValue();
  await page.getByLabel("Texture image").setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByRole("status")).toContainText("PNG, JPG or WebP");
  await expect(page.getByLabel("Texture pattern")).toHaveValue(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Surface target").selectOption("floor");
  await page.getByLabel("Texture pattern").selectOption("marble");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("door finishes remain selectable when wall editing is enabled", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByTestId("opening-o3").locator("rect").click();
  await expect(
    page.getByRole("heading", { name: "Door", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Texture pattern").selectOption("wood");
  await page.getByLabel("HEX value").fill("#886544");
  await page.getByLabel("HEX value").press("Enter");
  const data = await exportedProject(page);
  expect(
    data.openings.find((o: { id: string }) => o.id === "o3").surface.color,
  ).toBe("#886544");
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-editor[data-ready=true]")).toBeVisible();
});
