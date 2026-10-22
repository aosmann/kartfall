# Kartfall

**Answer right. Boost ahead.** A kart racer for the EduGames portal. Every question is painted on the road as three coloured answer pads; drive over the right one for a turbo boost, the wrong one skids you and the right answer turns green. Dodge cones, tyre stacks, oil and themed obstacles, grab coins, fly off the jumps. Four tracks (Sunny Meadow, Canyon Run, Frosty Peaks, Beach Bay), 2/3/5 laps, solo against five cat bots or a live class race.

Play: https://aosmann.github.io/kartfall/

- Steer: swipe or drag left/right, or ← → / A D. The kart accelerates by itself. Camera: chase view (default) or driver's seat (camera button or C).
- Three.js r128 pinned and saved locally (`three.min.js`, `GLTFLoader.js`, `RoundedBoxGeometry.js`); everything works offline after the first visit (service worker).
- `questions.js` and `flags/` are the shared EduGames bank, byte-identical to the other games. Never edit them here.
- Bot drivers use the EduGames cat avatars (`avatars/`).

## Credits
- Scenery models (forest tiles, pit tents) and engine/skid/impact sounds: **Kenney – Starter Kit Racing**, CC0 (https://github.com/KenneyNL/Starter-Kit-Racing).
- Everything else (tracks, karts, props, UI, synth cues) is original to this project.

## EduGames contract (v1)

`game.json` settings: `level` (topic default), `laps` (2 / 3 / 5, default 3), `track` (`meadow` | `desert` | `snow` | `beach`, default `meadow`).

```
?topic=<id>&level=1-3&laps=3&track=meadow&regions=eu,as&lock=1
```

Posts `edu-ready`, `edu-progress` after every answer and `edu-result` at the end (finish or "End race" from pause); every result is also appended to `localStorage['edu-results']` (last 200). Extra result fields: `position`, `racers`, `laps`, `track`, `coins`, `duration`, `timeUsed`, `cause` (`finish` | `quit`), `mode` (`solo` | `race`). `score` = 10 per right answer + 2 per coin + finishing bonus (1st +50, 2nd +30, 3rd +20, 4th +10, 5th +5).

## Race extension (class races)

Only when embedded (`topic` present) with `&race=1&seed=<n>` (optional `&me=<peerId>`, optional `&avatar=<url>` for the student's own driver):

| Direction | Message |
|---|---|
| game → portal on load | `{type:'edu-ready', game:'kartfall', race:true}` |
| portal → game, start | `{type:'edu-go'}` (3-2-1 lights, then GO) |
| game → portal, ~6×/s | `{type:'edu-state', state:{d, x, lap, speed, fin}}` |
| portal → game, ~6×/s | `{type:'edu-peers', peers:[{id, name, avatar, d, x, lap, fin}]}` |

Same `seed` + `track` + `laps` → same gates, obstacles and coins for everyone. Bots are off.

## Teacher view

`?spectate=1&seed=<n>&laps=<n>&track=<id>` — overview of the whole circuit, every kart with a name + cat-avatar label, live ranking, podium when everyone has finished.
