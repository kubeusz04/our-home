# Our Home — implementation and verification

## Delivered

- React, TypeScript and Vite with Tailwind; seven illustrative rooms and a shared model in metres.
- SVG floor-plan editor: furniture, corners, walls, openings, dimensions, grid, snapping, zoom and pan.
- React Three Fiber scene: outline-derived floors, shared wall segmentation, opening cutouts, orbit camera and walking.
- 25 parametric furniture types with independent IDs, dimensions, position, rotation, materials, colour, notes and costs.
- Three freesia colours, vase options, day/evening lighting and a geometric projector preview.
- Undo/redo, Dexie autosave, manual saving, validated JSON import/export, full versions, KRW/PLN budget and shopping.
- Error handling, model tests, browser interaction tests and documentation.

## Room editing fix and English interface

The previous room-size fields reused outline validation, which rejected resizing when existing furniture no longer fit. There were no explicit room-position controls. This is now handled by a dedicated atomic room transformation:

- Room width/depth fields with an explicit Scale furniture with room option.
- Room X/Z position fields; contents and openings move with the room.
- Move room in 2D tool, including one-step undo for each drag.
- Edit room shortcut in the furniture inspector.
- Supported dimensions and invalid positions have English validation messages.
- One shared transformation updates geometry, furniture and openings before saving.

All application labels, dialogs, controls, help, notifications, default room/furniture names, materials, document title and metadata are English. Existing local projects and versions retain IDs and custom data; known defaults are migrated on load, import or restore. The existing IndexedDB database name is deliberately retained.

## Validation approach

Browser plugin not available; use Playwright at http://127.0.0.1:5173/. Check desktop 1536 × 1024 and mobile 390 × 844. Target flow: open a furnished room → shrink dimensions → change X/Z → drag the room → undo → switch to 3D → save → refresh → verify dimensions, contents and position.

Unit coverage includes collision geometry, history, shared-wall cutouts, projector hit points, room resizing, room translation, unchanged source data, undo and legacy English migration. Browser coverage includes furniture movement in both directions between 2D/3D, materials, local persistence, openings, versions, budget, shopping, imports, mobile overflow, all seven rooms, outline/zoom, room transformations and the English interface.

## Visual direction and known scope

`docs/design-concept.png` is the original concept reference, not application UI or a scene background. The working application uses native React controls, SVG and editable Three.js geometry. Its warm neutral/olive palette and panel layout follow that direction. Language and branding are now English, location-specific labels have been removed, and KRW remains the main editable budget currency.

The room editor is concept-level. Moving or resizing a room does not automatically adjust neighbouring room outlines. Parametric geometry and SVG thumbnails are intentional. GLB/glTF import and photorealistic rendering are future work; see README for the full scope and controls.

## Latest verification — 5 November 2026

- Lint: clean. TypeScript and production build: passed.
- Model tests: 14 passed, including shrinking a furnished room, translating contents/openings, undo and English migration.
- Browser tests: 8 passed, including room dimensions, numeric positioning, room dragging, undo, 3D preview, save/reload and all English app views.
- Playwright manual check: correct Our Home title and URL, meaningful content, no framework error overlay, zero console errors or warnings.
- Desktop 1536 × 1024 and mobile 390 × 844 inspected visually. The room-size and position controls are visible and usable; no horizontal page overflow on mobile.
- Browser plugin unavailable; verification used Playwright. Screenshots are stored outside the project.

## Surface editing extension

- Typed optional SurfaceStyle on furniture/openings, plus floor finish, room wall default and per-wall overrides. Existing schema-version-1 projects remain compatible.
- Shared wall segmentation retains both room-facing owners. 3D wall faces use the corresponding room’s own style, so finishes on opposite sides are independent.
- Eight material options, seven procedural patterns, solid colour, custom images, repeat, rotation and roughness. All controls update actual mesh materials.
- Raster image uploads are decoded/resized locally and embedded in project data, including versions and JSON. Invalid types/settings are rejected. File upload state is tied to the selected target.
- Texture bindings own their transforms and dispose GPU textures when replaced/unmounted. Decoded custom images have a bounded cache. Three.js materials are refreshed when switching between no map and a texture.
- 2D wall selection leaves opening areas clickable. Click a wall to open Surfaces, or select a target from the inspector. The Surfaces tab stays open when switching between a wall and the floor.
- Added tests for finish validation, legacy defaults, independent object/wall/floor edits, undo, shared wall sides, image upload, persistence, JSON roundtrip, live rendering, invalid files, opening finishes and mobile controls.

### Surface extension verification — 5 November 2026

- Lint and production/TypeScript build passed without warnings.
- 21 model tests passed.
- All 12 browser scenarios verified. One unrelated initial page navigation failed transiently with Chromium `ERR_NO_BUFFER_SPACE`; `playwright test --last-failed` reran that scenario successfully. The other 11 passed in the full run.
- Browser checks confirmed actual image texture rendering on the sofa, the transition from a solid wall to a brick map without a reload, independent wall/floor settings, saved image roundtrips and selectable textured doors.
- Desktop 1536 × 1024 and mobile 390 × 844 inspected through Playwright and view_image. The controls fit both viewports, with no horizontal page overflow.
- Final fresh manual session: expected title/URL, real WebGL canvas, no error overlay and zero console warnings or errors.
- Screenshots are outside the repository. Browser plugin unavailable; Playwright used for QA.

## Live co-op

Implemented a same-origin WebSocket authority with private invite tokens, validated property edits, object reservations, peer presence, live 2D/3D movement, optimistic reconciliation, automatic reconnect and author-specific undo/redo. Both editors use the shared document model; views and camera remain personal. Session snapshots persist on the host; joining backs up the previous local project. Public internet sharing uses a temporary Cloudflare HTTPS tunnel, with a repeatable `npm run share` launcher. Public requests expose the compiled application only. Requires the host and tunnel to remain running; always-on hosting is outside the local app.

Protocol tests cover independent edits, selective undo, coalesced create/edit/delete and stale or unsafe changes. Two-browser interaction coverage checks invitation joining, movement received before release, shared colour, undo retaining partner colour and offline/reconnect. Run with COOP_TEST_PUBLIC=1 for a local/public cross-origin pair through the tunnel.

Final co-op verification (2026-11-05): build and lint clean; 25 unit/integration tests pass, including authenticated invites, stale-write rejection, broadcasting and persistence after server restart. All 12 existing browser flows pass. Two-client co-op test passes locally and through a public HTTPS tunnel, including movement before release in both 2D and 3D, shared colour/texture, selective undo and reconnection. Desktop and 390 px mobile dialogs render without horizontal overflow; no page errors or framework overlay observed. Public Vite and private-session routes return 404. Browser plugin not available; QA used Playwright.

## GitHub Pages support

Added a Pages Actions workflow and relative asset base, including the icon and lazy 3D chunk. The app can connect to a separate HTTPS live server; invitations preserve the Pages repository path and carry the live endpoint. The endpoint is configurable in the co-op dialog or with the repository COOP_SERVER_URL variable. WebSocket origins are checked against explicit host configuration; share --site configures the Pages origin. Static solo use does not require the co-op server. Local saves require JSON export/import when moving from localhost to Pages because browser storage is origin-specific.

Pages release verified at https://kubeusz04.github.io/our-home/ (2026-11-05): successful Actions deployment, HTTP 200, loaded lazy 3D scene, desktop/mobile layouts without horizontal overflow or page errors. Two independent browser contexts on the deployed Pages URL passed live 2D/3D movement before release, shared colour/texture, selective undo and reconnection through the separate HTTPS server. Additional offline check confirms a failed co-op connection can be cancelled to continue solo editing. Current checks: 27 unit/integration tests, build and lint pass. GitHub repository: https://github.com/kubeusz04/our-home.
