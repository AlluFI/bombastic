# Developer 1 — Step-by-Step Implementation Plan (Frontend / Game Engine)

## 1. Project setup & scaffolding

--Goal: Create a clean repo structure and minimal playable shell so later pieces slot in easily.
### Tasks
--Initialize project (git, npm, project structure).
--Create basic HTML lobby page + game page (no canvas — purely DOM).
--Add a simple CSS reset and layout container for the game grid and HUD.
--Create a small dev server command (e.g., npm run dev) for static files.
--Add linting (ESLint) and a basic build step if desired.
### Estimated time
2–4 hours
### Technical aspects / learning
HTML semantics, ES modules
Basic npm scripts
Simple dev server (e.g., lite-server, serve, or http-server)

### Testing criteria
index.html loads in browser and shows lobby and game screens.
Dev server runs and auto-reloads on file change (if using a watcher).

2. DOM map/grid system (Bomberman-style map)

Goal: Implement the game board as a DOM grid of pre-created tile elements. No per-frame DOM creation/destruction.

Tasks

Design tile types: floor, unbreakable wall, breakable block.

Pre-create DOM elements for the entire map at level load.

Use CSS grid or absolutely positioned tiles (absolute + transforms recommended).

Add data attributes (data-x, data-y, data-type) for logic.

Estimated time

1–2 days

Technical aspects / learning

CSS Grid vs absolute positioning performance trade-offs.

Prefer transforming elements instead of changing layout-affecting properties.

Use will-change: transform on moving items to hint the compositor.

Testing criteria

Map renders correctly with all tile types.

No runtime DOM creations when moving players; tiles are reused.

Inspect the Elements panel: number of nodes is stable during play.

3. Player character rendering & movement system (60 FPS)

Goal: Smooth, responsive, keyboard-controlled character movement using requestAnimationFrame + transforms.

Tasks

Represent players as absolutely positioned DOM elements (one element per player).

Implement a key state map using keydown/keyup (no long-press glitches).

Implement movement logic with a fixed logic timestep (e.g., 60 Hz) and render with rAF:

Separate update (game logic) and render (apply transforms to DOM).

Use transform: translate3d(x, y, 0) for moving player elements.

Implement collision with walls/blocks and tile-grid snapping (Bomberman step movement).

Provide smooth interpolation when necessary.

Estimated time

2–3 days

Technical aspects / learning

requestAnimationFrame, fixed timestep / accumulator pattern (game loop).

Key handling pattern:

const keyState = {};
window.addEventListener('keydown', e => { keyState[e.code] = true; });
window.addEventListener('keyup', e => { keyState[e.code] = false; });


Use transforms for movement; avoid top/left changes per frame.

Performance tips: batch DOM writes, avoid layout thrashing.

Testing criteria

Movement is responsive with no input delay (latency < ~50ms perceived).

No long-press accumulation issues: hold and release actions behave predictably.

FPS is stable at ~60 on target machines (see §Performance testing).

Players cannot pass through walls or blocks.

4. Bomb placement & explosion propagation

Goal: Bomb placement by player, timed explosion, blast propagation along grid, tile destruction.

Tasks

Add bomb DOM element(s) that sit on grid tiles.

On placement, schedule explosion after a delay (e.g., 2s).

On explosion: highlight blast tiles, destroy breakable blocks, damage players.

Implement chain reactions (bomb triggers bombs in its radius).

Provide visual and audio cues for countdown and explosion.

Estimated time

3–4 days

Technical aspects / learning

Use game state to mark bombs and explosion tiles instead of frequent DOM operations.

Perform explosion algorithm purely on grid coordinates, then update the DOM in one batch.

Keep explosion animation done with CSS animations or transitions, but state changes (tile destruction) should be handled via JS in one repaint.

Testing criteria

Bombs explode after the correct delay.

Explosion radius propagates correctly and stops at unbreakable walls.

Chain reactions occur reliably.

No frame drops when multiple bombs explode (use batched DOM updates).

5. Breakable/unbreakable blocks & power-up spawning

Goal: Implement destructible blocks that sometimes spawn power-ups when destroyed.

Tasks

Implement logic to remove breakable block DOM and replace with floor.

Implement a power-up spawn chance on block destruction.

Add at least 2 power-ups (you specified two — e.g., Speed Up and Extra Bomb/Blast Up).

Represent power-ups as DOM elements; pickup removes power-up and applies effect.

Estimated time

2–3 days

Technical aspects / learning

Power-up effects must update player stats (speed, bomb count, blast radius).

Make power-up effects finite or permanent based on game design.

Ensure power-up DOM creation is limited and batched.

Testing criteria

Breakable blocks are destroyed by blasts and sometimes spawn power-ups.

Power-ups can be collected by any player and affect stats equally.

Power-ups appear/disappear correctly across clients (tie-in with networking).

6. HUD, timer, scoreboard, and lives/score system

Goal: Real-time visible scoreboard, lives display, and a shared timer.

Tasks

Design HUD area: player list, lives, score, timer, round time.

Timer: either count-up or countdown (decide with team). Implement as authoritative value from server in multiplayer mode, local in single-player.

Score updates: bombs destroyed, eliminations, power-up pickups.

Display end-of-game winner screen.

Estimated time

1 day

Technical aspects / learning

DOM updates for HUD should be done only when values change.

Use accessible markup (ARIA) for HUD items for better inclusivity.

Testing criteria

HUD updates in real time with no visible lag.

Timer is synchronized to server in multiplayer; shows same value to all players.

Winner screen displays correct player name.

7. Pause / Resume / Quit menu and global notifications

Goal: Implement in-game menu that can pause/resume/quit; show who performed action to all players.

Tasks

Implement pause modal with Resume and Quit actions.

Implement notification banner (e.g., “Alex paused the game”).

Ensure pausing does not stop requestAnimationFrame (rAF continues but game update loop halts or uses a paused flag), so DevTools performance is stable.

Ensure pause/resume/quit events are emitted to server for multiplayer and displayed to all players.

Estimated time

1 day

Technical aspects / learning

Pause pattern: keep rAF running but early-exit update step based on isPaused flag; render still runs to keep UI responsive.

Avoid canceling rAF on pause — that would cause inconsistent frame sets on resume.

Testing criteria

Pausing shows banner with player name to all players.

Resuming shows banner with player name.

Quitting shows banner and returns players to lobby.

No dropped frames reported when pausing/resuming (rAF still active).

8. Sound effects & audio

Goal: Integrate sound effects for start/end, bomb tick/explosion, power-up pickup.

Tasks

Select or create small SFX files (WAV/MP3/OGG).

Implement a simple audio manager (play/stop/volume).

Use Web Audio API or a tiny library (optional) — you can write a lightweight wrapper over Audio or AudioContext.

Hook sounds to events (bomb placed, explosion, powerup pickup, game start/end).

Respect browser autoplay policies (require user gesture before starting audio or show a “Click to enable sound” prompt).

Estimated time

6–8 hours

Technical aspects / learning

Web Audio API basics; handling decode and play.

Mobile & autoplay constraints.

Testing criteria

Sounds play at the right times.

Audio does not block the main thread.

Volume controls (optional) work.

9. Performance optimization & 60 FPS guarantee

Goal: Ensure the game runs smoothly at 60 FPS; eliminate jank.

Tasks

Use requestAnimationFrame for rendering. Use a fixed logic timestep for game updates.

Avoid layout thrashing:

Read from DOM once, write in batches.

Avoid querying layout (offsetWidth, getBoundingClientRect) inside the main loop unless necessary.

Use transform for moving elements.

Reuse DOM nodes; avoid creating or removing DOM frequently.

Use CSS animations for purely visual things (like bomb pulsing) where possible.

Use the Performance API (performance.now()) to measure frame times.

Create a small FPS monitor overlay for debugging (compute frames over last 1s).

Test on target devices; profile in Chrome DevTools Performance panel.

Estimated time

2–3 days

Technical aspects / learning

requestAnimationFrame

fixed timestep pattern (e.g., 60Hz logic step)

batching DOM writes

CSS will-change, transform: translate3d, opacity vs layout properties

DevTools Performance profiling

Testing criteria

Average frame time < 16.67ms (60 FPS), spikes rare and short.

FPS monitor stays pinned near 60 during normal gameplay and during explosions.

CPU usage is reasonable (no runaway event handlers).

No dropped frames when pausing/resuming.

10. Integration hooks for networking & NPC

Goal: Make frontend capable of syncing with Node server and NPC manager (Developer 2 & 3 work).

Tasks

Define a client-side network interface module (e.g., networkClient.send(msg) / networkClient.on('state', handler)).

Expose game engine functions to accept authoritative state updates:

applyRemotePlayerState(id, x, y, bombs, ... )

applyExplosionEvent(...)

Make sure the local update/render loop uses server updates for remote players but still renders them as DOM elements.

Implement interpolation/extrapolation for remote players to hide latency.

Estimated time

1–2 days

Technical aspects / learning

WebSocket event-driven structure

Interpolation strategies: linear interpolation between server updates

Reconciliation for local player vs server authoritative state

Testing criteria

With simulated network latency, remote players' movement is smooth.

Local player input feels immediate (client-side prediction if implemented).

Game stays at 60 FPS while network messages are processed.

11. Polish, accessibility, and final testing

Goal: Final checks, accessibility, cross-browser issues, and bug fixes.

Tasks

Add keyboard remapping option (optional).

Ensure color contrast and ARIA labels for HUD.

Test in Chrome, Firefox, Edge.

Run stress tests with 4 players and many bombs/powerups.

Create test checklist and known issues log for the team.

Estimated time

2–3 days

Testing criteria

Cross-browser functional parity.

Accessibility basics present.

No crashes under stress test.

Test report with performance metrics and bug list.

Total estimated time (Developer 1)

~3–4 weeks (approx. 120–160 hours), depending on depth of polish and device testing. If you must compress schedule, prioritize minimal viable mechanics (movement, bombs, explosions, HUD, multiplayer hooks) and defer polish.

Testing / QA Checklist (summary)

 Game loads and lobby works.

 2–4 player DOM elements render and are visible.

 Player movement is smooth and responsive (no input lag).

 Bombs place and explode correctly; chain reactions work.

 Breakable blocks are destroyed; power-ups spawn and apply effects.

 HUD updates live for score/lives; timer synchronized.

 Pause/Resume/Quit shows who performed the action to all players.

 rAF loop runs continuously; update loop can be paused without stopping rAF.

 FPS stays at ~60 on target hardware; frame durations mostly < 16.67ms.

 Keyboard controls have no long-press glitches.

 Sounds play correctly and do not block main thread.

 Game works with simulated latency; remote players are smooth.

 No use of <canvas> anywhere.

Practical code & technique notes (quick tips)

Movement rendering: set elem.style.transform = translate3d(${x}px, ${y}px, 0); instead of top/left.

Game loop skeleton (fixed timestep + rAF):

const STEP = 1000/60; // 16.666ms
let last = performance.now();
let acc = 0;

function gameLoop(now) {
  acc += now - last;
  last = now;
  while (acc >= STEP) {
    update(STEP); // game logic
    acc -= STEP;
  }
  render(acc / STEP); // interpolation if needed
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);


Key handling: keep a key-state map; use keydown/keyup only to set booleans (avoid repeated processing in keydown).

Batch DOM updates: compute all new transform values in JS, then apply them in a single loop (writing only to style.transform).

Minimize reflow: do reads (getBoundingClientRect etc.) before writes and avoid them inside loops.

Learning resources (recommended)

MDN

requestAnimationFrame — https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame

Web Audio API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

Performance & performance.now() — https://developer.mozilla.org/en-US/docs/Web/API/Performance

Game loop & fixed timestep articles

“Fix Your Timestep” by Glenn Fiedler — https://gafferongames.com/post/fix_your_timestep/

Performance & rendering

“Jank-free animations” patterns and CSS will-change — articles on web.dev (search “avoid layout thrash” / “compositing and rendering”)

Google Web Fundamentals: Rendering performance — https://developers.google.com/web/fundamentals/performance/rendering

WebSocket basics

MDN WebSockets — https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API

Audio

Howler.js docs (optional lightweight library) — https://howlerjs.com/

Pathfinding / AI resources to coordinate with Developer 3

A* basics: https://www.redblobgames.com/pathfinding/a-star/introduction.html