# Sherwood Chess

A 3D chess game built with [three.js](https://threejs.org). The board rests on an ancient oak stump in a sun-dappled
Sherwood Forest clearing, beside a waterfall and a river, with an archery butt, a longbow and quiver, a campfire,
bluebells, ferns, drifting leaves and fireflies. The forest also has sound: the waterfall, the river and birdsong.

## Features

- **Play the computer:** five difficulty levels, from *Squire* (a beginner who blunders) up to *Outlaw King*
  (deep iterative-deepening search). Play as White, Black or a random side. The engine runs in a Web Worker,
  so the scene never freezes while it thinks.
- **Two players:** hot-seat play on one device, with an option to turn the view toward whoever is to move.
- **Four piece sets**, switchable at any time, even mid-game:
  - **Classic:** turned Staunton pieces in boxwood and ebony.
  - **Medieval:** footmen with spears and shields, castle towers with banners, armoured warhorses, mitred bishops, and a crowned queen and king.
  - **Modern:** minimalist Bauhaus forms in glazed ceramic and brushed metal.
  - **Cyberpunk:** neon-lit gunmetal with hovering, spinning holographic cores.
- **Interactive tutorial (36 lessons in 8 chapters):** every lesson has you *do* something on the 3D board:
  - name squares and find pieces by clicking them
  - collect stars with each piece to learn how it moves (with a par score and a shortest-path hint)
  - capture, pick the most valuable capture, promote, castle (including the "no castling through check" rule) and capture en passant
  - give check, then escape it each of the three ways
  - checkmate patterns: back rank, queen and king, smothered mate, avoiding stalemate, and a mate-in-2 rook ladder against the computer
  - tactics and openings: control the centre, stop (and play) the Scholar's Mate, and the knight fork.
    Wrong moves are explained, and some are punished on the board before being taken back.
  - practice against the computer with a live checklist: develop and castle, mate with king and queen,
    the two-rook "lawnmower" mate, and escorting a pawn to promotion

  Progress is saved in your browser.
- The full rules of chess: castling, en passant, promotion with a choice of piece, check, checkmate, stalemate,
  the fifty-move rule, threefold repetition and insufficient material.
- Move list, captured pieces with a material count, undo, hints, and captured pieces standing on the stump beside the board.
- Works with a mouse or touch. The layout adapts to phones, and the camera fits the board to the screen.

## Running

No build step and no dependencies: three.js is included in `vendor/`. ES modules need to be served over HTTP, so
start any static file server in the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. `npm start` runs the same command, and `npx serve .` also works.

The game can be hosted as-is on any static host, such as GitHub Pages.

### Controls

| Action | Mouse | Touch |
| --- | --- | --- |
| Select / move a piece | Click the piece, then a highlighted square | Tap, then tap |
| Look around | Drag | Drag |
| Zoom | Scroll | Pinch |
| Rotate to the other side | `F` key or **View** button | **View** button |
| Undo | `U` / `Ctrl+Z` or **Undo** | **Undo** |
| Cancel selection | `Esc` | Tap an empty spot |

On the **Settings** screen you can switch between *Beautiful* and *Fast* graphics (Fast is for slower
devices). The game also lowers its resolution by itself if the frame rate drops.

## Tests

```bash
npm test
```

- `tests/perft.test.mjs` checks move generation against standard perft node counts for five positions
  (including the tricky "Kiwipete" position, en passant and promotion edge cases).
- `tests/ai.test.mjs` checks that the engine finds mate in one, wins hanging material and converts K+Q vs K.
- `tests/lessons.test.mjs` loads every lesson, plays each solution, and confirms every star drill can be solved within par.

## Project layout

```
index.html            UI shell, import map
styles.css            Parchment-and-oak interface styling
src/main.js           Bootstraps renderer, scene, game, UI and tutorial
src/chess/engine.js   Rules engine (legal moves, SAN, draws)
src/chess/ai.js       Alpha-beta search, evaluation, difficulty levels
src/chess/ai.worker.js  Runs the search off the main thread
src/scene/            Forest environment, water shaders, board, procedural textures
src/pieces/           The four piece sets (all procedural geometry)
src/game/controller.js  Input, animation, game flow, camera
src/game/ui.js        Menus, HUD, modals
src/tutorial/         Lesson definitions and the lesson runner
src/audio.js          Procedural Web Audio (no sound files)
```

All textures, models and sounds are generated in code, so there are no image, model or audio files to load.
