# Isuzu D-Max Configurator Demo

Interactive vehicle configurator built with Three.js, React and TypeScript. Users inspect the vehicle, pick a preset body colour, configure accessories and animate the four doors. The app is a static build with no server.

## Requirements

- Node 22.18 or newer

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck and production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # typecheck only
```

## cPanel deployment

Build with relative paths so the demo works in either a domain root or a subfolder:

```bash
npm ci
npm run build -- --base=./
```

In cPanel File Manager, open the target domain's document root (often `public_html`) and create a dedicated folder for the demo, such as `car-configurator`. Upload the contents of `dist/` directly into that folder: `index.html`, `assets/`, `models/`, `hdri/`, `textures/` and, once a track is added, `audio/`. Preserve the folder structure. Do not upload the source project or `node_modules`.

Open `https://your-domain/car-configurator/` and check the vehicle, colours, accessories and doors. The page title and description are defined in the source `index.html`; rebuild and upload after changing them. HTTPS and ordinary static-file hosting are sufficient; no Node server is needed in cPanel.

**Compression.** The `.glb` model files, `.hdr` environment map and the main `.js` bundle are large. Enable gzip or Brotli on the server for `.glb`, `.hdr`, `.js` and `.css` to roughly halve transfer size (9.9 MB gzip vs 15.4 MB raw for the full build). In cPanel this is usually on by default for text files; check that `.glb` and `.hdr` are included. Without compression, load time at 5 Mbit/s is around 30 s; with gzip it drops to around 20 s.

**Audio caching.** Once a background track is added under `public/audio/`, set a long `Cache-Control` header on that folder (for example `max-age=31536000, immutable`) so returning visitors do not re-download it. Rename the file when the track changes so the new URL bypasses the cache.

## Configuration

Colours and accessories are data, edit them without touching other code:

- `src/config/colours.ts` lists the body colours (`id`, `name`, `hex`) and the default. Names match the Australian D-MAX X-TERRAIN customiser checked on 9 November 2026; hex values remain display approximations. Colours change only the shared `carpaint` material; finish and clearcoat come from `src/viewer/materials.ts`.
- `src/config/accessories.ts` lists each accessory (`id`, `label`, `defaultVisible`). The model nodes behind an accessory are listed per model in `src/config/models.ts`, all shown or hidden together. After `gltfpack` a name can match a wrapper group and its mesh, both are toggled
- `src/config/models.ts` lists the vehicles the viewer can show. Each entry has the `id`, `label`, optimised `.glb` under `public/models/`, the paint and accent material names, the accessory-to-node mapping, whether doors are supported, an optional colour subset and the camera framing and limits. A model offers only the accessories listed for it, and the model picker appears once more than one model is listed. To add a vehicle, run `scripts/optimise-model.mjs` with `--out public/models/<name>.glb`, add an entry, and the config test resolves every name against that file
- `src/viewer/materials.ts` holds the tuned materials by name: `carpaint` (body), `carpaint_second` (grille accents), `tire` and the glass materials

| Accessory | Model node |
| --- | --- |
| Roof rails | `rail_01` |
| Side steps | `rubber_02` |
| Mud flaps | `rubber_01` |
| Bed liner finish | `trunk` (always visible; switches between black liner and body paint) |

The bed liner changes only its own material. With the liner off, the tray follows the current body colour and finish. Other black trim is unaffected.

## Motion and interface

The toolbar keeps the original ticket SVGs: Configure and Present on the left; Paint, Wheels, Accessories, Trim and Interior in the centre; Reflections, Photo, Sound and View on the right, followed by Fullscreen and a separate Reset camera button. The arrow bouncing off a surface is Reflections. On phones the toolbar uses two rows. The View icon, including its upward chevron, opens Front, Front 3/4, Side, Rear 3/4, Back, Top and Driver views, defined in `src/config/views.ts`.

Fullscreen (`src/components/useFullscreen.ts`) expands the whole app, so the toolbar and panels stay available, and the button follows the browser's fullscreen state, including exit with Escape. Browsers without the Fullscreen API, such as iPhone Safari, do not show the button and keep the normal layout. Configuration and camera are unchanged on enter and exit. Lucide supplies supporting close, check and reset icons. Escape or Close dismisses a panel and returns focus to its selector.

The upper-right camera guide shows left-button drag and wheel scrolling on desktop, and one-finger drag and two-finger pinch on phones or coarse pointers. It does not intercept gestures over the scene.

Reflections fades environment specular and clearcoat radiance over 300 ms. It preserves diffuse illumination, direct-light highlights, paint properties and shadows. A shared shader uniform updates existing materials without recreating the scene, recompiling on each toggle or refreshing shadow maps. Reduced motion applies the choice immediately; the toggle state survives camera resets and asset retries. `reflections.test.ts` covers reversal, shared materials and lighting preservation.

Present slowly orbits the current build. A camera gesture, configuration selector or Reset stops presentation. Reduced-motion preferences disable automatic rotation. Accessories holds the fitted parts; Trim holds the bed liner finish; Interior holds the four animated door controls. Wheels and Sound are disabled, with accessible names and tooltips explaining why: the supplied asset has one wheel design and no audio. Add genuine model/audio assets before enabling them.

Photo downloads a PNG of the scene without the interface. View presets animate the camera and lens, retain the configuration, support reduced motion and can be interrupted by a gesture. Driver uses a calibrated right-hand-drive eye position with a tiny orbit radius for looking around inside the cabin. Exterior presets restore zoom and above-ground orbit limits. The roof cuts away for Top. Tooltips use the same charcoal surfaces and appear on hover or keyboard focus; expanded controls suppress them.

Paint, bed liner, accessory fitting and all four doors use reversible transitions, with immediate changes for reduced-motion preferences. `src/viewer/doors.ts` separates the supplied model's combined door meshes and matching inner door cards; pivots and openings are calibrated to this export. Seats, floor, roof and pillars remain stationary. Model changes require checking the openings again. Reset preserves the selected configuration.

`doorEdges.ts` closes the exterior skins' open borders with painted edge ribbons. Lower door edges meet the inner card; window frames use a thin return without filling the glass opening. Adjacent front/rear edge caps lean slightly into their own panel to avoid coplanar faces when closed. They share body paint, move with the hinges and participate in shadows/reflections.

## Garage and lighting

`LOOK.studio.ambient` controls the floor, walls, concrete and roof's indirect brightness separately. The two shadowed interior fixtures lift the vehicle bay without increasing overall exposure or washing out body paint.

`src/viewer/studio.ts` builds the physical room, with its floor at the vehicle's minimum height. The roof cuts away for overhead inspection while retaining its shadow geometry. Skirting shares the black painted-steel pillar finish and ends at roller-door openings. Roller shutters have side guides and bottom rails.

Locally hosted CC0 scans provide concrete floor/walls, ribbed shutters and painted steel. Original source URLs, authors, CC0 license links, optimisation details and verified checksums are recorded in `public/textures/garage/SOURCES.md` and `manifest.json`. `studioTextures.ts` loads colour maps as sRGB and surface maps as linear data, with optional-map fallbacks and disposal tied to the room. UVs retain the scans' physical scale. HDR `autoshop_01` from Poly Haven supplies reflections and ambient illumination, without being displayed as a panorama.

`src/viewer/lighting.ts` configures the scene lights from `look.ts`. The key daylight origin is outside the complete room, and its shadow camera contains every wall, roof and column. Tests check this coverage and that solid parts of the enclosure block daylight. Direct daylight enters through the actual skylight. Two shadowed spotlights beneath the roof provide interior fill; the floor uses restrained environment illumination so those shadows remain visible. The car casts its own shadow onto the floor; no painted shadow planes sit beneath it. Shadow maps update when doors or accessories move.

## Code map and checks

- `src/App.tsx`, `src/components/`, `src/styles/` — layout and controls.
- `src/config/`, `src/state/` — available options and configuration rules.
- `src/viewer/useViewer.ts` — React lifecycle and selection synchronisation.
- `src/viewer/createViewer.ts` — scene integration, loading and camera views.
- `src/viewer/cameraMotion.ts`, `motion.ts`, `doors.ts`, `accessoryMotion.ts` — camera and part motion.
- `src/viewer/materials.ts` — vehicle paint, glass, trim and tray finishes.
- `src/viewer/studio.ts`, `studioTextures.ts`, `lighting.ts`, `look.ts` — room surfaces and lighting.

Run `npm run build` and `npm test` after behavioural changes. Tests cover configuration, shipped model parts, door openings, material transitions, camera motion, texture scale/ownership and enclosure shadows. Check the actual scene on desktop and phone as well. Source model files are not committed.
