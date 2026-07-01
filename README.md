# Project Ark-3

A browser-based Mars rover platformer with a **human verification intro** (wave + “pew pew” via camera/mic) before gameplay.

## Quick start

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) — **required** for camera/mic access.

1. Complete the human check (connect → wave → pew pew → approved)
2. Click **START MISSION** to begin the rover game
3. Collect good cells, gems, and water droplets; avoid craters, aliens, and asteroids

See **INSTRUCTIONS.md** for full setup, troubleshooting, and file structure.

## Controls

| Key | Action |
|-----|--------|
| ← → | Move left / right |
| ↑ or Space | Jump |

You have **3 lives**. Clear all 10 levels to save Earth.

## Tech

Vanilla HTML, CSS, and JavaScript — no build step required.
