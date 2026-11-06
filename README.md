# Isuzu D-Max Configurator Demo

Interactive vehicle configurator built with Three.js, React and TypeScript. Users inspect the vehicle, pick a preset body colour and show or hide accessories. The app is a static build with no server.

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

## Configuration

Colours and accessories are data, edit them without touching other code:

- `src/config/colours.ts` lists the body colours (`id`, `name`, `hex`) and the default. Names and values are demo placeholders until official ones are confirmed. Colours change only the shared `carpaint` material, finish and clearcoat come from `src/viewer/materials.ts`
- `src/config/accessories.ts` lists each accessory (`id`, `label`, `nodes`, `defaultVisible`). `nodes` are model node names, all shown or hidden together. After `gltfpack` a name can match a wrapper group and its mesh, both are toggled
- `src/viewer/materials.ts` holds the tuned materials by name: `carpaint` (body), `carpaint_second` (grille accents), `tire` and the glass materials

| Accessory | Model node |
| --- | --- |
| Roof rails | `rail_01` |
| Side steps | `rubber_02` |
| Mud flaps | `rubber_01` |
| Bed liner | `trunk` |

`npm test` checks that every accessory node and every tuned material name exists in `public/models/dmax.glb`, so a renamed node after re-running `npm run optimise-model` fails the test instead of leaving a dead control.

## Scene look

`src/viewer/look.ts` holds every value that sets the look of the scene: exposure, environment file, intensity, rotation, dome height and radius, lights and shadows. The environment image lights the vehicle and is also projected onto a dome with a real floor (`GroundedSkybox`), so reflections match the room and zooming changes how the room looks. Dome height is the eye height of the photo and sets how large the room appears, a lower value warps the floor.

The environment is `autoshop_01` (1K) from [Poly Haven](https://polyhaven.com/a/autoshop_01), released under CC0. To swap it, put another `.hdr` in `public/hdri/` and change `environment.file`. A new image changes every reflection, so recheck rotation and paint on light and dark colours.

## Layout

- `src/assets/icons/` prepared toolbar icons, inlined so they follow `currentColor`
- `src/styles/` base styles and icon tokens
- `public/` static files served as is

Source model files (`.fbx`, `.blend`, the original `.glb`) are not committed.
