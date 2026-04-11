# Block Puzzle 🎮

> **Version 5.2** — by [Sunil Malleshaiah](https://github.com/SunilCap)

A mobile-first block puzzle game built as a single-file PWA. Drag pieces onto a 10×10 board, clear rows and columns, and build your score.

## Play

Open `index.html` directly in any modern browser — no server needed. Or deploy to any static host (GitHub Pages, Netlify, Vercel).

## Features

- **10×10 board** — 26 piece shapes, drag-and-drop with 1.8× speed multiplier
- **HOLD slot** — save a piece for later
- **Power-ups** — Shuffle, Undo, Rotate, +Hold, Blast (drag-based, auto-detects row/col)
- **Treasure Chest** — earn gems by clearing lines, crack open chests for ⭐ stars
- **Daily Quests** — 3 quests per day, seeded by date, reset at midnight
- **Daily Challenges** — Easy / Medium / Hard per day with trophy awards + Play Next
- **Achievement Trophies** — 11 achievements with tap-to-explain popovers
- **Convert Trophies** — convert challenge trophies to stars
- **Daily Bonus** — streak-based login rewards
- **Particle effects** — pixel blast wave clear, combo celebrations
- **PWA** — Add to Home Screen for fullscreen play on iOS/Android

## File Structure

```
index.html   — Complete self-contained game (single file, no dependencies)
game.js      — Extracted game logic (for review / version tracking)
style.css    — Extracted styles (for review / version tracking)
README.md    — This file
```

> `index.html` is the deployable file — fully self-contained with all CSS and JS inline.

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

## Browser Support

Modern browsers + iOS Safari 9+. Includes `Array.find` polyfill and `localStorage` safety proxy.

## Ad Integration

Replace the comments inside `#lb-ad-banner` and `#game-ad` with your AdSense `<ins>` tag.

## License

MIT License — © 2025 Sunil Malleshaiah

Permission is hereby granted, free of charge, to any person obtaining a copy of this software to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
