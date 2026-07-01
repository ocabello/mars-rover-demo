# Project Ark-3

A browser-based Mars rover platformer with a **human verification intro** (wave + “pew pew” via camera/mic) before gameplay.

## Quick start

```bash
python3 server.py --port 8080
```

Open [http://localhost:8080](http://localhost:8080) — **required** for camera/mic access. The bundled `server.py` sets iframe-friendly headers (`frame-ancestors *`; no `X-Frame-Options`).

For iframe embeds, replace the `GAME_TITLE`, `ONE_LINE_PITCH`, and `GAME_URL` placeholders in `index.html` and add `cover-1200x630.png` at the site root.

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
