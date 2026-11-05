# Our Home

A private, local apartment planner with an editable 2D floor plan, a real 3D scene, a furniture catalog, saved versions, shopping lists and a budget. The interface and built-in content are in English. No account, paid API or key is required. Optional live co-op uses the included local server.

## Start locally

Use Node.js 22.12 or newer and npm:

```powershell
cd C:\Users\Zawadzki\Desktop\dom
npm install
npm run dev -- --host 127.0.0.1
```

Open the address printed in the terminal, normally http://127.0.0.1:5173/. Use the same host and port each time: `localhost` and `127.0.0.1` have separate browser storage.

## Edit room dimensions and position

1. Click a room in the left sidebar, choose **Rooms**, or click **Edit room** while a furniture item is selected.
2. Enter **Room width** and **Room depth** in metres. Press Enter or click outside the field to apply.
3. **Scale furniture with room** is enabled by default, so shrinking a furnished room adjusts its contents instead of silently rejecting the change. Turn it off to preserve furniture dimensions; furniture is repositioned within the room where possible. An item that is physically too large produces a clear message.
4. Set **Room X** and **Room Z** to position the room’s top-left corner in project coordinates. Negative coordinates are allowed. Furniture and openings move with the room.
5. Click **Move room in 2D**, then drag the room floor. The whole room and its contents move together. A drag is one undo step.
6. Use **Outline** to drag individual corners or walls. Outline editing preserves furniture dimensions and will explain if furniture prevents that particular edit.

Room transformations are atomic: the outline, furniture and openings update together, use the same model in 2D and 3D, and are included in undo/redo, autosave, versions and JSON exports. Neighbouring rooms are independent; moving or resizing one does not automatically move its neighbours. Check shared boundaries after layout changes. A single room can be 1–20 metres wide/deep.

## Colours, materials and textures

- **Furniture and decor:** select an item, then open **Colour & material** in the inspector. Choose a colour preset or enter a HEX value, select a material, then choose a texture. The finish is applied to the editable 3D geometry, not a picture replacing the object.
- **Rooms:** select a room and click **Surfaces** beside Layout. Choose **Floor**, **All walls**, or a specific wall from the **Choose surface** menu. You can also click a wall in the 2D or 3D view to open its finish directly. Doors and window frames have their own **Opening finish** controls.
- **Individual walls:** a wall override affects only the selected room-facing surface. The other side of a shared wall can have a different finish. **Use room default** removes that override; **Apply to all walls** copies it throughout the room. Editing All walls replaces that room’s existing overrides.
- **Presets:** wood grain, woven linen, tiles, brick, concrete, marble and wallpaper stripes. Match material chooses wood/linen automatically where appropriate; Solid colour disables the pattern.
- **Custom images:** click **Upload texture** and choose PNG, JPG or WebP up to 5 MB. The image is resized to a maximum of 768 pixels on its longest edge and embedded in the project as WebP. It is included in local saves, versions and JSON export/import, with no external hosting. JSON imports support files up to 50 MB.
- **Appearance:** Texture repeat controls how often the pattern repeats; a higher value makes it smaller. Texture rotation changes its angle. Roughness controls how shiny/matte the finish looks. Colour tints the texture; **Use image colours** sets a white tint. **Remove texture** removes the pattern and its embedded image.

Surface edits support undo/redo. Older projects without finish settings keep working. Mapping is procedural: small/curved parts may stretch a pattern. There is no UV editor, normal-map upload or per-triangle painting.

## Other controls

- **2D plan:** drag furniture. Move, Rotate and Scale apply to furniture; Move room applies to rooms. Scroll to zoom; drag empty background to pan. Fit plan resets the view. Grid, dimensions and 10 cm snapping are independent.
- **Openings:** select Door, Window or Opening, then click a wall. Click an opening to edit its width, height, offset or sill. Shared wall segments are generated once and openings are cut through both sides.
- **3D view:** left-drag to orbit, right-drag to pan, scroll to zoom. Select furniture, choose Move/Rotate/Scale, then drag the coloured manipulator. Position, dimensions, colour, material, cost and notes are also editable in the inspector.
- **Walk:** WASD to move, left/right arrows to turn, drag to look around. Choosing a room finds a free starting position. Doors and passages connect rooms; walls and optionally furniture block movement.
- **Catalog:** 25 parametric model types. Each added item has a unique ID and independent properties. The catalog searches for free floor space. Use Duplicate to create another editable item.
- **Flowers:** yellow, white and pink freesias are separate catalog items. Choose a ceramic, glass or slim vase. To place flowers on a table, first add them on free floor space, set Above floor to the tabletop height, then move them onto the table.
- **Projector:** the bedroom contains a projector and screen, without a TV. Enable projection in its properties. Moving and rotating it changes the image’s hit point on the nearest wall/screen and its size. This is a geometric preview, not an optical simulation of a specific product.
- **Palette and lighting:** ten colour presets, custom colours and eight material types. Wood/fabric surfaces are procedural. The sun/moon button switches daylight and evening lighting. Occluding walls are lowered in the overview and restored in Walk.
- **History:** Undo/Redo, Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y. Delete removes a selected furniture item; Escape clears selection. History contains up to 60 session states and is not persisted between sessions.
- **Planning:** project name/notes, room ideas, and full saved versions with thumbnails, restore and export.
- **Budget and shopping:** enter prices in KRW, mark purchased items, add notes/links and filter by room/status. PLN conversion is optional, with a manually editable illustrative rate. Zero means not priced yet. No prices are claimed as current offers.
- **Phone:** room selection, 2D/3D preview, catalog and basic property editing. Precise manipulators and keyboard walking are designed primarily for a desktop.

## Local data and English migration

Dexie stores the current project and versions in IndexedDB. Autosave runs after 400 ms without edits. Wait for **Saved locally**, or press **Save**, before closing. JSON export is a portable backup; it includes the current project, while versions can be exported individually. Invalid imports do not replace the project. Clearing browser data removes local projects.

Existing projects are retained. Known old default room/furniture names and material values are migrated to English on load/import/restore. Custom names, notes, IDs, prices and layouts are preserved. The database name remains unchanged to keep access to existing data.

## Checks

```powershell
npm run lint
npm test
npm run build
npm run test:e2e
```

If Playwright Chromium is missing, run `npx playwright install chromium` once. Browser tests start the development server automatically or reuse one at 127.0.0.1:5173.

## Architecture and scope

- `src/model/`: types, geometry, wall segmentation, collision checks, room transformations, English migration, seed data, Zustand, Dexie and JSON validation.
- `src/editor/`: SVG floor-plan editing and navigation.
- `src/scene/`: React Three Fiber, parametric furniture, materials, camera, walking and projection.
- `src/components/`: app controls, inspector, catalog, room previews, versions, budget and shopping.
- `tests/editor.spec.ts`: browser interaction checks, including room transformations, persistence, English UI and 3D-to-2D furniture movement.

The example has seven rooms totalling 80.7 m² including the balcony. Its dimensions, budget and exchange rate are illustrative. Positions are metres: X/Z on the floor, Y above it; rotations are degrees. Walls are derived from room outlines, 2.7 m high and 12 cm thick. The 3D bundle loads separately.

This is a concept planner, not professional CAD or a photorealistic renderer. Furniture uses parametric geometry, rectangular footprint/height collision checks and SVG catalog previews. Rooms start as rectangles with editable corners. Adjacent room outlines are independent; overlapping rooms are not automatically prevented. Room resizing with scaling disabled can require manual adjustment of furniture arrangements. GLB/glTF imports, arbitrary polygon drawing, photorealistic rendering and cross-device synchronisation remain future work.

## Live co-op over the internet

1. Run `npm run share`. It builds the app, starts a host if needed and opens a temporary public HTTPS tunnel. On Windows it downloads the official Cloudflare Tunnel client on first use. On other systems install `cloudflared` first.
2. Open the printed address (or your existing local editor at the same port), choose **Co-op**, enter your name and click **Create shared session**.
3. Click **Copy invite link** and send the link to your partner. Opening it joins that exact project. Their previous local project is backed up in saved versions.
4. Edit in 2D or 3D. Movement is transmitted during dragging; colours, textures, room geometry and other project edits are shared. Camera, selection and editor view stay personal. Coloured outlines show partner activity. A dragged object is reserved until release. Undo affects your own edits and preserves independent partner changes.
5. Keep the host computer, app server and tunnel running. The public address changes when the temporary tunnel restarts; create/copy a fresh invitation address then. Shared sessions are stored in `.local-share/`, so a session can be rejoined on the same server after a restart. Do not delete this folder if you want to keep shared projects. Invite links grant editing access; share privately.

Loss of connection pauses editing and retries automatically. Leaving co-op keeps the current project as a local copy. The app requires no account or paid API. Co-op adds a small local WebSocket server; solo use remains local. A permanent address and availability while the computer is off require deploying this server on an always-on host with HTTPS/WebSocket support.

`npm start` serves the built app and co-op on port 4173. `SHARE_PORT` changes the sharing port (default 5173); `PORT` changes the standalone server port. For your own reverse proxy set `PUBLIC_URL` to the public HTTPS origin. Forward WebSocket upgrades at `/__coop` to the same server. Public tunnel visitors receive compiled assets only, without Vite source routes.

Co-op checks: `npm test`, `npx playwright test tests/coop.spec.ts`. To also exercise the public tunnel, run the latter with `COOP_TEST_PUBLIC=1` while sharing is active.

## GitHub Pages

The frontend is a static build and supports repository paths such as `https://USER.github.io/our-home/`. `.github/workflows/pages.yml` installs dependencies, runs tests/lint, builds and publishes `dist` on pushes to `main`. In repository Settings → Pages, choose **GitHub Actions**. The compiled frontend contains no saved projects or private co-op session files. Existing browser saves are per origin: export from the local editor and import on Pages to move a project there.

Pages does not run the WebSocket server. Solo editing, 2D/3D, textures, save/export/import and budget work entirely in the browser while the host PC is off. Live co-op connects to a separate server:

1. Start `npm run share -- --site https://USER.github.io/our-home/` on the host. This allows that exact Pages origin and prints the live server’s HTTPS address. Keep the host running for co-op. Alternatively run `npm start` behind a permanent HTTPS proxy and set `COOP_ALLOWED_ORIGINS=https://USER.github.io`.
2. On Pages, choose **Co-op** and enter that address in **Live server address**, then create a session. Invitations stay on Pages and include the live server address, so the partner does not configure it separately.
3. Optionally set the repository Actions variable `COOP_SERVER_URL` to the live server’s HTTPS origin, then rerun the publish workflow. It becomes the initial server address for visitors; the editable field can override it. Do not put invite tokens or credentials in this variable. For a temporary tunnel, update it after restarting the tunnel or enter the new address in the app.

The live server accepts its own origin plus explicitly allowed origins from `COOP_ALLOWED_ORIGINS` (comma separated) or the host-only `.local-share/allowed-origins.json`. It still requires the private invitation token to join. Browser storage, tokens and session documents are never committed. GitHub Pages keeps the application available independently of co-op server availability.
