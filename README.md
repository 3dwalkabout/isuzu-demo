# Isuzu D-Max Configurator Demo

Interactive vehicle configurator built with Three.js, React and TypeScript. Users inspect the vehicle, pick a preset body colour and show or hide accessories. The app is a static build with no server.

## Requirements

- Node 22.12 or newer

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # typecheck and production build into dist/
npm run preview    # serve the production build locally
npm run typecheck  # typecheck only
```

## Layout

- `src/assets/icons/` prepared toolbar icons, inlined so they follow `currentColor`
- `src/styles/` base styles and icon tokens
- `public/` static files served as is

Source model files (`.fbx`, `.blend`, the original `.glb`) are not committed.
