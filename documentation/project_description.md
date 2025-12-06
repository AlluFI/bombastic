# Super Bomberman Multiplayer Web Game — Project Documentation

## Overview
A browser-based Bomberman-style game supporting 2–4 players in real-time competitive gameplay. Includes multiplayer (WebSocket) and single-player modes with AI opponents. Built with vanilla JavaScript and Node.js; rendering uses DOM elements only (no canvas).

## Game Concept
Players navigate a tile grid, place bombs to destroy obstacles, collect power-ups, and eliminate opponents. Matches end when one player remains or when the timer expires — the highest score wins.

## Core Gameplay Mechanics
- Grid-based movement (tile arena)
- Bomb placement with timed detonation
- Cross-shaped explosion propagation that destroys breakable walls and damages players
- Power-ups that spawn from destroyed obstacles
- Real-time simultaneous actions (no turn-based play)

## Technical Architecture

### Technology Stack
- Frontend: Vanilla JavaScript, HTML5, CSS3
- Backend: Node.js with WebSocket for real-time networking
- Rendering: DOM elements (no canvas)
- Animation: requestAnimationFrame targeting 60 FPS
- Networking: WebSocket-based client↔server communication

### Performance Requirements
- Maintain 60 FPS with smooth, jank-free animations
- Optimized DOM updates and minimal layer usage
- Responsive keyboard input with no long-press or lag issues

## Project Goals & Success Criteria

### Goal 1 — Multiplayer Functionality
- 2–4 players can join from separate machines via URL/IP
- Unique username selection
- Lead player starts game when ready
- Real-time synchronized gameplay and stable connections

### Goal 2 — Real-Time Gameplay Experience
- Simultaneous control for all players
- Immediate keyboard responsiveness
- Consistent 60 FPS across supported browsers

### Goal 3 — Game Mechanics & Systems
- Destructible and indestructible walls
- Working bomb/explosion mechanics
- At least two meaningful power-ups
- Scoring and lives UI, synchronized timer, clear winner declaration

### Goal 4 — User Interface & Controls
- Pause/resume/quit with notifications to all players
- Join screen with name selection
- Menu interactions without frame drops

### Goal 5 — Single-Player Mode with AI
- Toggle single-player / multiplayer
- Single-player blocks incoming network connections
- 1–3 AI opponents with 3 difficulty tiers
- AI cannot access game menus

### Goal 6 — AI Opponent Customization
- UI for configuring AI strategy, speed, aggression, accuracy
- Difficulty affects AI effectiveness (Easy / Medium / Hard)

### Goal 7 — Audio & Visual Polish
- Sound effects for key events (bombs, explosions, power-ups, game start/end)
- Appealing DOM-based visuals and smooth animations

### Goal 8 — Performance & Stability
- No crashes or memory leaks during extended play
- Minimal network lag and efficient resource cleanup

## Game Rules & Win Conditions

### Player Elimination
- Players hit by explosions lose lives; zero lives → eliminated and spectating

### Victory Conditions
- Last Player Standing
- Highest Score when timer expires
- Time-Based Victory (highest score at countdown)

### Scoring
Points awarded for:
- Destroying breakable walls
- Eliminating opponents
- Collecting power-ups
- Survival time bonuses

## Power-Ups (Examples)
Possible effects (to be finalized):
- Increased blast radius
- Additional simultaneous bombs
- Movement speed boost
- Bomb kick
- Remote detonation
- Temporary invincibility
- Piercing explosions

## Team Structure
Three developers with responsibilities across:
- Frontend game logic & rendering
- Backend networking & server infrastructure
- AI opponents & menu/UX
Roles to be assigned and coordinated for protocol/tick decisions.

## Technical Constraints
Mandatory:
- No HTML canvas (DOM-only rendering)
- Maintain 60 FPS via requestAnimationFrame
- Desktop browsers only
- Keyboard controls only

Prohibited:
- Chat/messaging
- Canvas usage
- Turn-based mechanics
- Persistent accounts, leaderboards, matchmaking, DB state persistence

## Development Approach
- Develop multiplayer and single-player concurrently for unified architecture
- Integrate AI from the start
- Regular performance profiling, latency testing, and cross-browser checks

## Success Metrics
- 60 FPS stability, no crashes
- Functional internet multiplayer
- Convincing AI opponents and complete game mechanics
- Polished UX with sound & visuals

## Out of Scope
- Chat/messaging
- Mobile device support
- Persistent accounts or leaderboards
- Matchmaking systems
- Canvas rendering
- Database-backed game state persistence