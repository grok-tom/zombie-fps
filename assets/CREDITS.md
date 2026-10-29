# Asset credits

All vendored third-party files below are free for commercial use. Prefer credit as shown; CC0 does not require attribution.

## City buildings

| File | Author | License | Source |
|------|--------|---------|--------|
| `city/building-a.glb` | Kenney (www.kenney.nl) | CC0 1.0 | [City Kit (Commercial) 2.1](https://kenney.nl/assets/city-kit-commercial) via [OpenGameArt](https://opengameart.org/content/city-kit-commercial) (`building-a.glb`) |
| `city/building-b.glb` | Kenney | CC0 1.0 | same pack (`building-b.glb`) |
| `city/building-c.glb` | Kenney | CC0 1.0 | same pack (`building-c.glb`) |
| `city/building-d.glb` | Kenney | CC0 1.0 | same pack (`building-d.glb`) |
| `city/building-e.glb` | Kenney | CC0 1.0 | same pack (`building-e.glb`) |
| `city/building-skyscraper-a.glb` | Kenney | CC0 1.0 | same pack (`building-skyscraper-a.glb`) |
| `city/Textures/colormap.png` | Kenney | CC0 1.0 | same pack (shared atlas referenced by the GLBs) |

## Characters

| File | Author | License | Source |
|------|--------|---------|--------|
| `characters/zombie.glb` | Quaternius | CC0 / Public Domain | [Zombie on Poly Pizza](https://poly.pizza/m/VlXjG0N8Eg) (from Quaternius Zombie Apocalypse / Post-Apocalypse kit) |

## Weapons

| File | Author | License | Source |
|------|--------|---------|--------|
| `weapons/pistol.glb` | Kenney (www.kenney.nl) | CC0 1.0 | [Blaster Kit 2.1](https://kenney.nl/assets/blaster-kit) via [OpenGameArt](https://opengameart.org/content/blaster-kit) (`blaster-p.glb`, renamed) |
| `weapons/smg.glb` | Kenney | CC0 1.0 | same pack (`blaster-r.glb`, renamed as SMG stand-in) |
| `weapons/Textures/colormap.png` | Kenney | CC0 1.0 | same pack (shared atlas) |

## Procedural / local textures

| File | Author | License | Source |
|------|--------|---------|--------|
| `textures/asphalt.png` | Generated for this project | CC0 (project-owned) | Procedural 512×512 grayscale noise (Python/PIL). City Kit has no ground plane; used as asphalt fallback for Task 3 ground. |

## Notes for later tasks

- Kenney city/weapon GLBs reference relative `Textures/colormap.png`. Keep those folders next to the GLBs (already vendored).
- Zombie GLB embeds its texture (no sidecar).
- Preferred load paths for Task 2: `assets/city/building-a.glb`, `building-b.glb`, `building-c.glb`; `assets/characters/zombie.glb`; `assets/weapons/pistol.glb`; optional `assets/weapons/smg.glb`.
