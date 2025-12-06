# Project Task Division (3 Developers)

Overview
- Divide responsibilities across three developers: Game Engine & Frontend, Backend & Multiplayer, NPC AI & Menu/Game Modes.
- Use checkboxes to indicate assigned/complete areas.

---

## Developer 1 — GAME ENGINE & FRONTEND (Core Gameplay Logic) ✓
Responsibilities:
- DOM-Based Game Rendering (No Canvas)
  - Build DOM grid system for the Bomberman map.
  - Implement dynamic player character rendering via DOM elements.
  - Implement breakable & unbreakable blocks as DOM nodes.
- Bombs & Explosions
  - Bomb placement and explosion propagation using DOM elements.
  - Implement explosion collision with players, blocks, and power-ups.
- Movement & Animation
  - Smooth 60 FPS movement animations via requestAnimationFrame.
  - Develop keyboard input system (no lag, no long-press glitches).
- Power-ups
  - Spawn power-ups and render their DOM visuals.
  - Implement power-up effects (speed, extra bomb, longer blast, etc.).
- UI & Audio
  - Scoring & lives UI.
  - Timer UI (sync with multiplayer or local for single-player).
  - In-game HUD (scoreboard, timer, players list).
  - Implement sound effects (explosions, power-ups, start/end).
- Game State (Frontend)
  - Maintain local authoritative game state for single-player.
  - Pause/resume/quit handling locally and broadcast multiplayer events.
  - Sync DOM updates based on server state in multiplayer.

---

## Developer 2 — BACKEND & MULTIPLAYER NETWORKING ✓
Responsibilities:
- Node.js Server
  - Implement WebSocket server for real-time multiplayer communication.
  - Handle player join/leave and unique name validation.
  - Lead player start control, real-time movement sync, bomb placement & explosion syncing.
  - Score updates, power-up collection, game timer, pause/resume/quit actions.
- Networking Protocol
  - Define client↔server message structure.
  - Implement client networking layer and message handlers.
  - Implement lag compensation / state reconciliation to maintain smooth 60 FPS client experience.
- Session Management
  - Generate joinable session URL/IP and implement lobby/waiting room.
  - Reject new players when game is running, full, or single-player mode enabled.
- Security & Stability
  - Validate and sanitize incoming packets; prevent crashes from malformed packets.
  - Handle disconnects & reconnections gracefully.
  - Ensure stable server tick/update loop and protect against server-side exceptions.

---

## Developer 3 — NPC AI + GAME MODES + MENU SYSTEM ✓
Responsibilities:
- Menu & Game Mode Switching
  - Main menu with options for Single-player and Multiplayer modes.
  - Disable incoming multiplayer connections in single-player.
  - Allow selection of 1–3 virtual opponents and difficulty (Easy/Medium/Hard).
  - Optional NPC customization UI (speed, aggression, frequency, strategy).
- NPC Virtual Opponents AI
  - Human-like movement logic (semi-random or pathfinding-based).
  - Decision-making: when to place bombs, escape blast radius, collect power-ups.
  - Ensure NPCs compete and are not solely player-focused.
  - Prevent predictable loops and stuck behavior.
- Difficulty Levels
  - Easy: weak strategy, low success.
  - Medium: balanced strategy and consistency.
  - Hard: advanced strategy, high success rate.
  - Difficulty scales NPC attributes (speed, decision frequency, aggressiveness).
- Integration & Rules
  - Integrate NPC logic into the main game engine; NPCs follow identical rules as players.
  - Ensure NPCs cannot pause/resume/quit.
- Endgame
  - Winner screen and scoring results for multiplayer & NPC matches.

---