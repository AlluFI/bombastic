# ✅ **FULL PROJECT PLAN (Updated for Go Backend)**

### *Super Bomberman — Multiplayer + Single-Player with NPCs (DOM-only Frontend)*

### *3 Developers working in parallel*

---

# **1. High-Level Architecture**

### **Frontend (Client)**

* Vanilla JavaScript
* DOM-only rendering (no canvas)
* 60 FPS animation using `requestAnimationFrame`
* WebSocket client for communication with Go server
* UI menus, player name input, pause menu, score display, timer
* Power-up visuals
* Keyboard input system

### **Backend (Go Server)**

* WebSocket server managing:

  * Player connections
  * NPC logic
  * Game state (players, bombs, map, collisions, explosions, powerups)
  * Matchmaking / lobby
  * Sync snapshots to clients
* NPC AI fully server-side (Go routines for each NPC)

### **Game Modes**

1. **Multiplayer Online Mode**

   * Up to 4 real players
   * Go server accepts remote WebSocket connections

2. **Single-Player with NPCs**

   * Only the lead player connects
   * NPCs spawn server-side
   * External player connections rejected

### **Shared Game Layout**

* One bombergame map
* Same tiles, blocks, destructible walls, powerups, etc.
* Same gameplay for both online and offline modes

---

# **2. Task Distribution Across 3 Developers**

---

# 👨‍💻 **HASITHA — Frontend Rendering + Game UX/UI**

**Main focus:** DOM renderer, animations, input, UI systems, audio

### Tasks

* Create DOM-based tile grid (no canvas)
* Render players, NPCs, bombs, explosions, walls, powerups
* Implement animation loops using `requestAnimationFrame`
* Build join menu, pause menu, name entry, difficulty selection (for SP)
* Scoreboard + timer UI + winner screen
* Smooth keyboard handling (no long-press glitches)
* Audio effects
* Power-up visual behaviors
* FPS optimization & DOM performance tuning
* Responsive layout for different screen sizes

---

# 👨‍💻 **Developer 2 — Networking + Frontend/Backend Sync**

**Main focus:** WebSocket communication, client/server protocol, sync system

### Tasks

**Frontend**

* WebSocket client implementation
* Input-to-server packet system
* Receiving game state snapshots
* Client-side interpolation (smooth movement)
* Reconnection & error handling

**Backend (Go)**

* WebSocket server setup
* Lobby system (join game, name uniqueness, lead player start)
* Broadcast loop (20–30 ticks per sec)
* Pause/resume/quit sync to clients
* Timer sync
* Player lifecycle (join, leave, disconnect)
* Block incoming players in single-player mode
* Powerup spawn/collect sync

---

# 👨‍💻 **Developer 3 — Game Logic + NPC AI + Powerup Logic (Go)**

**Main focus:** Server-side gameplay engine

### Tasks

* Build authoritative game loop (movement, collisions, bombs)
* Bomb explosion algorithm (cross-shape)
* Line-of-sight collision with blocks
* Power-up generation logic
* Player lives/scoring system
* NPC AI system:

  * Easy / Medium / Hard difficulty
  * Pathfinding (grid BFS)
  * Danger zone avoidance
  * Target selection (players, blocks, powerups)
  * Bomb placement strategy
  * Fail rates for Easy/Medium AI
* NPC concurrent goroutines with safe shared-state access
* Anti-infinite-loop NPC movement
* Ensuring human-like unpredictability
* Game end detection

---

# **3. Full Development Phases & Timeline**

### **Phase 1 — Setup & Core Foundations (3–4 days)**

* Go WebSocket server skeleton (Dev 2)
* DOM grid renderer (Dev 1)
* Base game state model in Go (Dev 3)
* Basic client-server communication test

---

### **Phase 2 — Movement & Rendering (4–5 days)**

* Player movement input → server → broadcast → render
* Smooth movement interpolation on client
* Collision with walls and blocks
* FPS testing

---

### **Phase 3 — Bombs, Explosions & Damage System (4–5 days)**

* Bomb placement & timers (Dev 3)
* DOM explosion rendering (Dev 1)
* Server explosion logic (Dev 3)
* Player death/lives update broadcast (Dev 2)

---

### **Phase 4 — Powerups (2–3 days)**

* Add 2 powerups:

  1. Speed Up
  2. Bomb Range Up
* DOM visual indicator (Dev 1)
* Powerup server-side logic (Dev 3)
* Sync events to clients (Dev 2)

---

### **Phase 5 — Multiplayer Completion (3 days)**

* Fully synchronized player state
* Scoreboard + timer syncing
* Pause/resume quit notifications
* Winner announcement

---

### **Phase 6 — NPC System (5–7 days)**

* NPC base class (Go)
* Easy / Medium / Hard AI
* Pathfinding, target selection, bomb logic
* NPC competes with players + NPCs
* Single-player mode toggle
* NPC customization options (optional extra)

---

### **Phase 7 — Final UI, Audio, Optimization (2–3 days)**

* Sound effects
* Performance optimization
* DOM repaint reduction
* WebSocket load testing
* Bug fixes & polish

---

# **4. Updated Folder Structure (Go + Vanilla JS)**

```
project-root/
│
├── server/
│   ├── main.go
│   ├── websocket/
│   │   ├── hub.go
│   │   ├── client.go
│   │   └── handlers.go
│   ├── game/
│   │   ├── game_loop.go
│   │   ├── state.go
│   │   ├── movement.go
│   │   ├── bombs.go
│   │   ├── collisions.go
│   │   ├── powerups.go
│   │   └── timer.go
│   ├── npc/
│   │   ├── base.go
│   │   ├── easy.go
│   │   ├── medium.go
│   │   ├── hard.go
│   │   ├── pathfinding.go
│   │   └── controller.go
│   └── utils/
│       ├── constants.go
│       └── random.go
│
├── client/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── network/
│   │   │   ├── socket.js
│   │   │   └── handlers.js
│   │   ├── render/
│   │   │   ├── grid.js
│   │   │   ├── playerRender.js
│   │   │   ├── bombRender.js
│   │   │   ├── explosionRender.js
│   │   │   └── powerupRender.js
│   │   ├── ui/
│   │   │   ├── menu.js
│   │   │   ├── pause.js
│   │   │   ├── scoreboard.js
│   │   │   └── timer.js
│   │   ├── game/
│   │   │   ├── input.js
│   │   │   ├── audio.js
│   │   │   └── clientState.js
│   │   └── utils/
│   │       ├── dom.js
│   │       └── constants.js
│   └── assets/
│       ├── sounds/
│       ├── images/
│       └── powerups/
│
├── shared/
│   ├── constants.json
│   ├── game_config.json
│   └── map_layout.json
│
└── README.md
```

---

# **5. Testing Criteria (Updated for Go Backend)**

### **Performance**

* 60 FPS DOM animation
* requestAnimationFrame used natively
* <1% frame drops
* Go server handles all logic at 20–30 Hz

### **Multiplayer**

* Join from external URLs (public IP or domain)
* Unique player names
* 2–4 players
* Real-time visibility of all players
* Smooth movement sync
* Pause/resume/quit notifications visible to all
* Timer sync correct

### **Single-Player (NPC)**

* Lead player can toggle SP mode
* External players blocked
* 1–3 NPCs
* Easy / Medium / Hard difficulty
* NPCs behave human-like
* No infinite loops
* NPCs compete with each other

### **Gameplay**

* Scoring system
* Winner screen
* Two powerups fully implemented
* Bomb logic accurate
* No crashes, no desync