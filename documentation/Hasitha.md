# 🟦 **SPRINT 1 — Core UI Framework + Static Game Board (3–4 days)**

## 🎯 **Goals**

* Build the static DOM structure of the game.
* Create reusable UI components (menus, overlays).
* Start a modular file organization.
* Set up the render loop structure (empty for now).

---

## 🧩 **Tasks**

### 1. Create base HTML structure

* Add root containers:

  * `menu-screen`
  * `game-screen`
  * `pause-overlay`
  * `scoreboard`
  * `timer`
* Include CSS reset + grid styles.

### 2. Build DOM-based tile grid

* Use a single 2D array to generate tiles.
* Produce consistent tile IDs (`cell-0-0`, etc.).
* Use classes for wall, soft block, empty tile.

### 3. Create modular render system

* `grid.js` → renders the grid once.
* `renderer.js` → orchestrates the render calls.
* `main.js` → starts the render loop.

### 4. Create menu UI

* Join game menu
* Name input
* Game mode selection
* Difficulty selection for Single Player (but no logic yet)
* Start game button

### 5. Add simple CSS styling

* Flexbox-based layout
* Basic tile visuals (placeholder colors)
* Responsive design for different screens

---

## ✔️ **Acceptance / Testing Criteria**

* Game loads showing main menu.
* Pressing “Start Game” hides menu and shows grid.
* Grid is generated correctly every time with consistent tile coordinates.
* No scrollbars (unless intended).
* Grid fits within screen on desktop + mobile.
* All UI elements show/hide correctly via JS.
* render loop is running (even if empty).

---

## ⏱ **Est. Time: 3–4 days**

---

## 📘 **Required Knowledge**

* DOM creation & manipulation
* CSS grid / Flexbox
* ES Modules structuring
* requestAnimationFrame basics

---

## 📚 **Learning Resources**

* MDN: document.createElement
  [https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement](https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement)
* MDN: Grid layout
  [https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
* Render loop basics:
  [https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

---

# 🟦 **SPRINT 2 — Player Rendering + Animation System (4–5 days)**

## 🎯 **Goals**

* Create a system to render players and animate movement.
* Build interpolation-friendly animation logic.
* Add keyboard input → local rendering (no server yet).
* Create player DOM elements dynamically.

---

## 🧩 **Tasks**

### 1. Player DOM renderer

* Render player at tile position (px-based).
* Smooth player movement with CSS transforms.
* Add color-coded player skins.

### 2. Input handling module

* Keydown / keyup listeners
* Maintain input state object
* Prevent long-press repeated events
* Custom movement smoothing function

### 3. Local animation loop

* Move player locally (temporary)
* Interpolate and render at 60 FPS
* Ensure no stutter or jitter

### 4. Camera / viewport adjustment (optional)

* Auto-center player on various screen sizes

---

## ✔️ **Acceptance / Testing Criteria**

* Player moves smoothly from one tile to another.
* Movement is consistent at 60 FPS.
* No movement when keys aren't pressed.
* No "sticky key" bug.
* Player DOM element updates position smoothly (pixel-level).
* Animation continues even if map is large.

---

## ⏱ **Est. Time: 4–5 days**

---

## 📘 **Required Knowledge**

* CSS transforms (`translate`)
* requestAnimationFrame timing
* Linear interpolation (LERP)
* Keyboard event handling

---

## 📚 **Learning Resources**

* LERP basics: [https://gamedevbeginner.com/the-ultimate-guide-to-lerp-linear-interpolation/](https://gamedevbeginner.com/the-ultimate-guide-to-lerp-linear-interpolation/)
* Smooth animation with transforms:
  [https://developer.mozilla.org/en-US/docs/Web/CSS/transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)

---

# 🟦 **SPRINT 3 — Bombs, Explosions, and Visual Effects (4–5 days)**

## 🎯 **Goals**

* Render bombs and explosions.
* Sync styling to match game mechanics.
* DOM-based animation of cross-shaped explosions.

---

## 🧩 **Tasks**

### 1. Bomb creation and rendering (client side)

* Temporary local bombs until server integration.
* Bomb sprite or simple DOM element.
* Bomb fuse animation (CSS-based).

### 2. Explosion rendering system

* Render explosion tiles in cross shape.
* Add fade-out animation.
* Explosion should last ~500ms for visual effect.

### 3. Layering system

* Ensure correct z-index ordering:

  * Tiles
  * Soft blocks
  * Bombs
  * Explosions
  * Players

### 4. Optimize DOM updates

* Minimize layout thrashing.
* Pre-append explosion tiles + reuse.

---

## ✔️ **Acceptance / Testing Criteria**

* Bombs appear exactly where player drops them.
* Explosion correctly fills cross shape (range adjustable).
* Explosion animation fades cleanly.
* Explosion DOM removed after animation.
* Rendering has no visible lag or frame drops.

---

## ⏱ **Est. Time: 4–5 days**

---

## 📘 **Required Knowledge**

* DOM layering / stacking contexts
* CSS transitions
* Animation timing
* Efficient DOM manipulation patterns

---

## 📚 **Learning Resources**

* Stacking contexts:
  [https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index)
* CSS transitions:
  [https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions/Using_CSS_transitions)

---

# 🟦 **SPRINT 4 — Powerups + UI Polish + Responsiveness (3 days)**

## 🎯 **Goals**

* Implement DOM representation of powerups.
* Add UI elements (score, lives, timer).
* Make the game visually polished and responsive.

---

## 🧩 **Tasks**

### 1. Render powerup items

* Speed Up
* Bomb Range Up
* Color-coded icons

### 2. Powerup collection animation

* Small scale animation when picked up.

### 3. Add timer UI

* Matches server tick
* Local animation for countdown

### 4. Scoreboard UI

* DOM-based list of players + scores

### 5. Responsive CSS polish

* Scale grid on smaller screens
* Keep game playable on mobile

---

## ✔️ **Acceptance / Testing Criteria**

* Powerups appear correctly and can be collected visually.
* Timer updates smoothly (no stutters).
* Scoreboard updates dynamically.
* UI never overlaps the grid.
* Game playable on desktop + tablet/mobile.

---

## ⏱ **Est. Time: 3 days**

---

# 🟦 **SPRINT 5 — Full WebSocket Integration (With Dev 2) (3–4 days)**

> Note: This sprint overlaps with Dev 2’s work.

## 🎯 **Goals**

* Integrate server data into rendering.
* Move from local temporary logic → fully server-authoritative mode.

---

## 🧩 **Tasks**

### 1. Create clientState.js to store server snapshots

* Player position
* Bombs
* Explosions
* Powerups
* NPC positions
* Timer
* Game running flag

### 2. Load WebSocket snapshot into renderer

* Apply interpolation for smooth movement.
* Handle new players joining.
* Handle NPCs appearing/disappearing.

### 3. Health & death animations (optional)

* Blink effect
* Fade away

---

## ✔️ **Acceptance / Testing Criteria**

* All game content fully renders from server snapshots.
* No jitter even when latency is 50–100ms.
* Player sees other players move smoothly.
* NPCs render correctly.
* Bombs/explosions match server timing.

---

## ⏱ **Est. Time: 3–4 days**

---

# 🟦 **SPRINT 6 — Final Polish & Optimizations (2–3 days)**

## 🎯 **Goals**

* Improve performance.
* Fix UI bugs.
* Add audio system.
* Add final polish for release.

---

## 🧩 **Tasks**

* Add sound effects (bomb drop, explosion, powerup pickup).
* Optimize memory usage (remove unused DOM nodes).
* Use CSS transitions instead of JS where possible.
* Add final visual polish:

  * Better colors
  * Drop shadows
  * Animations on menu transitions

---

## ✔️ **Acceptance / Testing Criteria**

* Zero frame drops on desktop.
* Minimum 40+ FPS on Android.
* Audio transitions clean.
* All UI states consistent.

---

## ⏱ **Est. Time: 2–3 days**

---

# ⭐ Total Estimated Time for Dev 1

### **19–24 days**

(~4–5 weeks)