# Mars Rover — Save the Earth

A browser-based platformer where you pilot a Mars rover to collect minerals, microbes, and water while avoiding craters, hostile aliens, and falling asteroids.

## How to Play

Open `index.html` in a web browser (or serve locally):

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

### Controls

| Key | Action |
|-----|--------|
| ← → | Move left / right |
| ↑ or Space | Jump |

### Goal

Collect the required number of **minerals**, **microbes**, and **water** shown in the HUD to clear each level. You have **3 lives** — fall into a crater, touch an alien, or get hit by an asteroid and you lose one.

### Levels

1. **Dusty Plains** — Learn the basics; collect minerals, avoid craters
2. **Microbe Valley** — Aliens appear; collect minerals and microbes
3. **Ice Cap Search** — Water introduced; more craters and faster aliens
4. **Asteroid Storm** — Falling asteroids join the fight
5. **Final Frontier** — Everything at max difficulty

## Tech

Vanilla HTML5 Canvas — no build step required.
