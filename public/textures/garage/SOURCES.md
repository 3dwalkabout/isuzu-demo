# Garage surfaces

Downloaded and verified against Poly Haven's API checksums on 9 November 2026.
All source assets are **CC0 1.0 Universal**: https://polyhaven.com/license
License deed: https://creativecommons.org/publicdomain/zero/1.0/

| Surface | Source | Authors |
| --- | --- | --- |
| Floor | [Hangar Concrete Floor](https://polyhaven.com/a/hangar_concrete_floor) | Dimitrios Savva |
| Walls and concrete columns | [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) | Charlotte Baglioni (photography), Dario Barresi (processing) |
| Roller shutters | [Painted Metal Shutter](https://polyhaven.com/a/painted_metal_shutter) | Charlotte Baglioni (photography), Dario Barresi (baking), Rico Cilliers (processing) |
| Red/black painted pillar cladding, room skirting and red headers | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | Rob Tuytel |

The concrete and shutter scans cover 2 x 2 metres; the flat painted-steel scan
covers 2.5 x 2.5 metres. Concrete colour maps use 2K; OpenGL normal and roughness
maps use 1K. Files are hosted locally and converted from JPG to WebP at quality
85. The floor colour map is lightly brightened and desaturated (gamma 1.35,
brightness 0.04, saturation 0.25); the wall colour map is desaturated (0.2).
Normal and roughness values are not colour graded. No displacement geometry
is added to the floor, preserving tyre contact.

The shutter uses a 2K colour map. Flat painted steel uses a 1K colour map,
desaturated and lifted (gamma 2.0, brightness 0.35, saturation 0) as a neutral
wear mask multiplied by the red/black material colours. Metal surfaces use
512px OpenGL normal maps and packed ARM maps, downsampled from 1K and encoded
as lossless WebP. ARM supplies roughness (green) and exposed-metal coverage
(blue); paint remains dielectric. Existing diffuse colours are retained for
the pillars. Roller doors use actual side guides and bottom rails; rib detail
comes from the aligned scan rather than a second, conflicting set of joint lines.

`manifest.json` records the original URLs, resolutions and verified checksums,
plus SHA-256 hashes of the optimised local files. Raw downloads are excluded
from the application; only the twelve optimised maps are shipped.
