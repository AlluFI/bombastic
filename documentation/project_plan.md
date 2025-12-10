# ✅ **OPTIMIZED PROJECT PLAN (Vanilla Node.js Backend)**

### *Super Bomberman — Multiplayer + Single-Player with NPCs (DOM-only Frontend)*

### *3 Developers working in parallel*

---

## **1. High-Level Architecture**

### **Frontend (Client)**
* Vanilla JavaScript
* DOM-only rendering (no canvas)
* 60 FPS animation using `requestAnimationFrame`
* Socket.io client for communication with Node.js server
* UI menus, player name input, pause menu, score display, timer
* Power-up visuals
* Keyboard input system

### **Backend (Vanilla Node.js Server)**
* Socket.io server managing:
  * Player connections
  * NPC logic
  * Game state (players, bombs, map, collisions, explosions, powerups)
  * Matchmaking / lobby
  * Sync snapshots to clients
* NPC AI fully server-side (separate logic modules for each difficulty)
* Native Node.js HTTP server for serving static files

### **Game Modes**
1. **Multiplayer Online Mode**
   * Up to 4 real players
   * Node.js server accepts remote Socket.io connections

2. **Single-Player with NPCs**
   * Only the lead player connects
   * NPCs spawn server-side
   * External player connections rejected

### **Shared Game Layout**
* One bomberman map
* Same tiles, blocks, destructible walls, powerups, etc.
* Same gameplay for both online and offline modes

---

## **2. Task Distribution Across 3 Developers** *(Unchanged)*

---

### 👨‍💻 **HASITHA — Frontend Rendering + Game UX/UI**

**Main focus:** DOM renderer, animations, input, UI systems, audio

#### Tasks
* Create DOM-based tile grid (no canvas) ✓ *Started*
* Render players, NPCs, bombs, explosions, walls, powerups ✓ *Started*
* Implement animation loops using `requestAnimationFrame`
* Build join menu, pause menu, name entry, difficulty selection (for SP)
* Scoreboard + timer UI + winner screen
* Smooth keyboard handling (no long-press glitches) ✓ *Started*
* Audio effects
* Power-up visual behaviors
* FPS optimization & DOM performance tuning
* Responsive layout for different screen sizes

---

### 👨‍💻 **Developer 2 — Networking + Frontend/Backend Sync**

**Main focus:** Socket.io communication, client/server protocol, sync system

#### Tasks

**Frontend**
* Socket.io client implementation
* Input-to-server event system
* Receiving game state snapshots
* Client-side interpolation (smooth movement)
* Reconnection & error handling

**Backend (Vanilla Node.js)**
* Socket.io server setup with native HTTP server
* Static file serving using `fs` and `path` modules
* Lobby system (join game, name uniqueness, lead player start)
* Broadcast loop (20–30 ticks per sec using `setInterval`)
* Pause/resume/quit sync to clients
* Timer sync
* Player lifecycle (join, leave, disconnect)
* Block incoming players in single-player mode
* Powerup spawn/collect sync

---

### 👨‍💻 **Developer 3 — Game Logic + NPC AI + Powerup Logic (Node.js)**

**Main focus:** Server-side gameplay engine

#### Tasks
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
* NPC async logic with safe shared-state access
* Anti-infinite-loop NPC movement
* Ensuring human-like unpredictability
* Game end detection

---

## **3. Updated Folder Structure (Vanilla Node.js + Current Structure)**

```
multi-player/
│
├── client/
│   ├── index.html                    ✓ EXISTS
│   ├── css/
│   │   ├── grid.css                  ✓ EXISTS
│   │   ├── player.css                ✓ EXISTS
│   │   ├── styles.css                ✓ EXISTS
│   │   ├── bomb.css                  (NEW)
│   │   ├── explosion.css             (NEW)
│   │   ├── powerup.css               (NEW)
│   │   ├── menu.css                  (NEW)
│   │   └── scoreboard.css            (NEW)
│   │
│   ├── public/
│   │   └── js/
│   │       ├── main.js               ✓ EXISTS
│   │       ├── grid.js               ✓ EXISTS
│   │       ├── player.js             ✓ EXISTS
│   │       ├── control.js            ✓ EXISTS
│   │       ├── renderPlayer.js       ✓ EXISTS
│   │       │
│   │       ├── network/              (NEW)
│   │       │   ├── socket.js
│   │       │   └── handlers.js
│   │       │
│   │       ├── render/               (NEW - reorganize existing)
│   │       │   ├── bombRender.js
│   │       │   ├── explosionRender.js
│   │       │   └── powerupRender.js
│   │       │
│   │       ├── ui/                   (NEW)
│   │       │   ├── menu.js
│   │       │   ├── pause.js
│   │       │   ├── scoreboard.js
│   │       │   └── timer.js
│   │       │
│   │       ├── game/                 (NEW)
│   │       │   ├── audio.js
│   │       │   └── clientState.js
│   │       │
│   │       └── utils/                (NEW)
│   │           ├── dom.js
│   │           └── constants.js
│   │
│   └── assets/                       (NEW)
│       ├── sounds/
│       │   ├── bomb.mp3
│       │   ├── explosion.mp3
│       │   ├── powerup.mp3
│       │   ├── death.mp3
│       │   └── win.mp3
│       └── images/
│           └── powerups/
│
├── server/                           ✓ EXISTS (empty)
│   ├── server.js                     (NEW - main entry)
│   ├── package.json                  (NEW)
│   │
│   ├── socket/                       (NEW)
│   │   ├── socketHandler.js
│   │   └── events.js
│   │
│   ├── game/                         (NEW)
│   │   ├── gameLoop.js
│   │   ├── gameState.js
│   │   ├── movement.js
│   │   ├── bombs.js
│   │   ├── collisions.js
│   │   ├── explosions.js
│   │   ├── powerups.js
│   │   ├── scoring.js
│   │   └── timer.js
│   │
│   ├── npc/                          (NEW)
│   │   ├── NPCController.js
│   │   ├── easyAI.js
│   │   ├── mediumAI.js
│   │   ├── hardAI.js
│   │   ├── pathfinding.js
│   │   └── behaviors.js
│   │
│   ├── lobby/                        (NEW)
│   │   ├── lobbyManager.js
│   │   └── playerManager.js
│   │
│   └── utils/                        (NEW)
│       ├── constants.js
│       └── helpers.js
│
├── shared/                           (NEW)
│   ├── constants.json
│   ├── gameConfig.json
│   └── mapLayout.json
│
└── README.md
```

---

## **4. Full Development Phases & Timeline**

### **Phase 1 — Setup & Core Foundations (3–4 days)**
* Vanilla Node.js + Socket.io server skeleton (Dev 2)
* Integrate existing DOM grid renderer with Socket.io (Dev 1)
* Base game state model in Node.js (Dev 3)
* Basic client-server communication test
* **Deliverable:** Players can connect and see a synchronized grid

---

### **Phase 2 — Movement & Rendering (4–5 days)**
* Player movement input → server → broadcast → render
* Smooth movement interpolation on client
* Collision with walls and blocks
* FPS testing with Performance Monitor
* **Deliverable:** Multiple players can move around smoothly

---

### **Phase 3 — Bombs, Explosions & Damage System (4–5 days)**
* Bomb placement & timers (Dev 3)
* DOM explosion rendering with CSS animations (Dev 1)
* Server explosion logic (Dev 3)
* Player death/lives update broadcast (Dev 2)
* **Deliverable:** Bombs work, players can die

---

### **Phase 4 — Powerups (2–3 days)**
* Add 2 powerups:
  1. **Speed Up** - Increases player movement speed
  2. **Bomb Range Up** - Increases explosion radius
* DOM visual indicator (Dev 1)
* Powerup server-side logic (Dev 3)
* Sync events to clients (Dev 2)
* **Deliverable:** Powerups spawn, can be collected, affect gameplay

---

### **Phase 5 — Multiplayer Completion (3 days)**
* Fully synchronized player state
* Scoreboard + timer syncing
* Pause/resume/quit notifications
* Winner announcement screen
* Join menu with name selection
* Lead player start button
* **Deliverable:** Full multiplayer game working end-to-end

---

### **Phase 6 — NPC System (5–7 days)**
* NPC base class (Node.js)
* Easy / Medium / Hard AI implementations
* Pathfinding (BFS algorithm)
* Target selection logic
* Bomb placement strategy
* NPC competes with players + other NPCs
* Single-player mode toggle
* NPC customization options (optional extra)
* **Deliverable:** Single-player mode with convincing NPCs

---

### **Phase 7 — Final UI, Audio, Optimization (2–3 days)**
* Sound effects for all major events
* Performance optimization (minimize DOM repaints)
* Socket.io reconnection handling
* Bug fixes & edge cases
* Cross-browser testing
* FPS monitoring and optimization
* **Deliverable:** Polished, production-ready game

## **6. Testing Criteria (All Requirements)**

### **Performance**
- ✅ 60 FPS DOM animation
- ✅ `requestAnimationFrame` used correctly
- ✅ <1% frame drops
- ✅ Vanilla Node.js server handles all logic at 20–30 Hz

### **Multiplayer**
- ✅ Join from external URLs (public IP or domain)
- ✅ Unique player names enforced
- ✅ 2–4 players supported
- ✅ Real-time visibility of all players
- ✅ Smooth movement sync (<100ms latency)
- ✅ Pause/resume/quit notifications visible to all
- ✅ Timer synchronized across all clients

### **Single-Player (NPC)**
- ✅ Lead player can toggle SP mode
- ✅ External players blocked in SP mode
- ✅ 1–3 NPCs selectable
- ✅ Easy / Medium / Hard difficulty levels
- ✅ NPCs behave human-like (not robotic)
- ✅ No infinite loops in NPC movement
- ✅ NPCs compete with each other, not just player

### **Gameplay**
- ✅ Scoring/lives system implemented
- ✅ Winner screen displays at game end
- ✅ Two powerups fully functional
- ✅ Bomb logic accurate (cross-shape explosion)
- ✅ No crashes, no desync issues
- ✅ Keyboard controls smooth (no delays/glitches)
- ✅ Sound effects for major events
- ✅ Timer counts up or down
- ✅ DOM-only (no canvas)

---

## **7. Next Steps**

1. **Set up Vanilla Node.js backend** (Developer 2)
   - Initialize `package.json` in server folder
   - Install Socket.io only
   - Create HTTP server with static file serving
   - Set up Socket.io
   
2. **Integrate Socket.io client** (Developer 2 + Hasitha)
   - Connect existing frontend to Socket.io
   - Test basic message passing

3. **Define game state structure** (Developer 3)
   - Create shared constants
   - Design state synchronization protocol

4. **Continue frontend work** (Hasitha)
   - Polish existing grid/player rendering
   - Prepare for bomb/explosion rendering
