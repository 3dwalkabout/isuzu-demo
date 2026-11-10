# Isuzu configurator

One purpose: inspect and configure the D-Max. Read README.md for setup and the code map.

- Keep visible copy to names, actions and necessary loading/error states. No taglines, helper text or repeated state labels.
- Make layout and control states explain the interaction. Preserve accessible names, keyboard operation and focus restoration.
- Keep the existing ticket artwork for the main selectors. Use Lucide only for supporting actions.
- Put option IDs and labels in `src/config/`, state rules in `src/state/`, UI in `src/App.tsx` and `src/components/`, and Three.js behaviour in `src/viewer/`.
- `useViewer` is the React boundary. Do not recreate the scene when a selection changes.
- Share concrete repeated behaviour; avoid adding frameworks or generic abstractions for a single use.
- Preserve door openings, accessory fitting, body-colour tray behaviour, reversible motion and reduced-motion support.
- Keep the visible garage as real 3D geometry. HDR imagery supplies lighting and reflections; the floor meets the model's ground height.
- Run `npm run build` and `npm test` after behavioural changes. Check changed controls in the local browser at desktop and phone widths. Do not mark visual QA complete from unit tests alone.
