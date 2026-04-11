# Block Puzzle 🎮

A mobile-first block puzzle game built as a single-file PWA. Drag pieces onto a 10×10 board, clear rows and columns, and build your score.

## Play

Open `index.html` directly in any modern browser — no server needed. Or deploy to any static host (GitHub Pages, Netlify, Vercel).

## Features

- **10×10 board** — 26 piece shapes, drag-and-drop with 1.8× speed multiplier
- **HOLD slot** — save a piece for later
- **Power-ups** — Shuffle, Undo, Rotate, +Hold, Blast (progressively unlocked)
- **Treasure Chest** — earn gems by clearing lines, crack open chests for ⭐ stars
- **Daily Quests** — 3 quests per day, seeded by date, reset at midnight
- **Daily Challenges** — Easy / Medium / Hard challenge per day with trophy awards
- **Achievement Trophies** — 11 achievements with tap-to-explain popovers
- **Convert Trophies** — convert challenge trophies to stars
- **Daily Bonus** — streak-based login rewards
- **Particle effects** — pixel blast wave clear, combo celebrations
- **PWA** — Add to Home Screen for fullscreen play on iOS/Android

## File Structure

```
index.html   — Complete self-contained game (single file, no dependencies)
game.js      — Extracted game logic (reference / for review)
style.css    — Extracted styles (reference / for review)
README.md    — This file
```

> **Note:** `index.html` is the deployable file — it is fully self-contained with all CSS and JS inline. `game.js` and `style.css` are extracted copies for code review and version tracking.

## Economy

| Source | Reward |
|---|---|
| Clear 1 line | +5 gems |
| Clear 2+ lines | +5 per line + 3 bonus per extra |
| Combo bonus | +3 gems per combo level |
| Open Bronze Chest (30 gems) | +15 ⭐ |
| Open Silver Chest (60 gems) | +35 ⭐ |
| Open Gold Chest (100 gems) | +65 ⭐ |
| Daily Quest complete | +5–14 ⭐ |
| Challenge complete | +10–35 ⭐ |
| Daily Bonus | +3–20 ⭐ (streak) |

## Power-up Unlock Thresholds

| Power-up | Unlock |
|---|---|
| Shuffle | Free |
| Undo | 6 ⭐ earned |
| Rotate | 12 ⭐ earned |
| +Hold slot | 20 ⭐ earned |
| Blast | 30 ⭐ earned |

## Chest Tiers

| Tier | Capacity | Reward | Unlocks at |
|---|---|---|---|
| 📦 Bronze | 30 gems | 15 ⭐ | Start |
| 🪣 Silver | 60 gems | 35 ⭐ | 50 ⭐ total earned |
| 🏆 Gold | 100 gems | 65 ⭐ | 150 ⭐ total earned |

## localStorage Keys

| Key | Value |
|---|---|
| `bp_best` | All-time best score |
| `bp_stars` | Current star balance |
| `bp_stars_total` | Total stars ever earned |
| `bp_streak` | Login streak |
| `bp_chest_gems` | Current chest gem count |
| `bp_quests_YYYY-M-D` | Daily quest progress |
| `bp_ch_YYYY_M_D` | Challenge result per day |
| `bp_achievements` | Earned achievements |
| `bp_unlocks` | Unlocked power-ups |

## Browser Support

Modern browsers + iOS Safari 9+. Includes `Array.find` polyfill and a `localStorage` safety proxy for sandboxed iframe environments.

## Ad Integration

Ad banner placeholders are in place in the lobby and game screen. Replace the comments inside `#lb-ad-banner` and `#game-ad` with your AdSense `<ins>` tag. The AdSense loader script should go in `<head>`.

## License

MIT
