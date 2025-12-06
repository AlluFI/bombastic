Developer 2 – Detailed Plan (Backend, Networking, Session Management)

Primary Responsibility:
Build the multiplayer infrastructure, server logic, real-time sync, room/session system, and ensure single-player mode blocks network joins.

🧩 PART 1 — Environment Setup & Architecture Planning
1.1 Set up Backend Project Structure

Tasks

Initialize Node.js project

Install dependencies:

ws (WebSockets)

express (simple HTTP hosting)

nanoid (unique player/game IDs)

Create project folders:

/server
  /rooms
  /players
  /network
/shared


Testing Criteria

Server starts without errors

WebSocket connections can be established from browser

Rooms directory structure loads without import errors

Time Estimate: 0.5 day
Learning Resources

https://nodejs.org/en/docs

https://github.com/websockets/ws

🧩 PART 2 — WebSocket Realtime Communication Layer
2.1 Implement WebSocket Server

Tasks

Handle new connections

Assign unique IDs

Map socket.id → player

Basic message routing structure:

{
  type: "MOVE" | "BOMB" | "JOIN" | "PAUSE" | "SYNC_STATE" | …
  data: { … }
}


Testing Criteria

Multiple browser clients can connect simultaneously

Messages broadcast successfully

No delays > 50ms on localhost

Server does not crash when a client disconnects

Time Estimate: 1 day
Learning Resources

WebSockets basics (MDN): https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API

🧩 PART 3 — Lobby / Room System (2–4 players)
3.1 Implement Game Room Creation

Tasks

Create room when lead player joins

Store room state (max 4 players)

Ensure unique room codes

Enforce player name uniqueness

3.2 Join Logic

Tasks

Reject if room full

Reject if single-player mode is active

Notify all players when someone joins or leaves

Testing Criteria

2–4 players can join a room

No ghost players remain after disconnects

Single-player mode correctly blocks join attempts

Player name uniqueness enforced

Time Estimate: 1.5 days
Learning Resources

Real-time rooms explanation (Socket-like system):
https://socket.io/docs/v4/rooms

(Even though using ws, the conceptual model helps.)

🧩 PART 4 — Game State Sync (Position, Bombs, Powerups)
4.1 Implement Authoritative Server Model

Tasks

Server stores the TRUE game state:

Player positions

Bombs + explosion timing

Powerup spawns

Scores/lives

Timer

Server sends updates at 60fps OR event-driven updates with RAFT timestamp sync

4.2 Handle Player Input Sync

Tasks

Client sends input events → server updates state → server broadcasts authoritative positions

Implement latency smoothing on the client side (Developer 1 will finish this)

Testing Criteria

Sync delay < 100ms

No duplicated bomb explosions

All clients display identical timer

Movement is visibly identical on all screens

State remains consistent after 5+ minutes continuous play

Time Estimate: 2.5 days
Learning Resources

Real-time multiplayer networking:
https://www.gabrielgambetta.com/client-server-game-architecture.html

🧩 PART 5 — Pause/Resume/Quit Handling
5.1 Pause System

Tasks

Server tracks pause state

When one player pauses, server:

Freezes timer

Broadcasts “Player X has paused”

Resume messages reverse freeze

5.2 Quit System

Tasks

On quit (manual or disconnect):

Remove player cleanly

Broadcast quit event

If only 1 player remains → declare winner

Testing Criteria

Pausing does NOT freeze requestAnimationFrame on clients

No frame drops

All players see who paused/resumed/quit

Game doesn’t desync after pause cycles

Time Estimate: 1–1.5 days
Learning Resources

Game loop control logic: https://developer.mozilla.org/en-US/docs/Games/Anatomy

🧩 PART 6 — Score/Lives Sync
Tasks

Server maintains master score/lives

Clients only display

Update on:

Bomb hit

Round win/loss

Powerup affecting lives

Validate client cannot cheat (client CANNOT send "update score")

Testing Criteria

Score updates appear instantly to all players

Scores remain identical after heavy gameplay

No desyncs during fast chain explosions

Time Estimate: 1 day

🧩 PART 7 — Timer Synchronisation
Tasks

Server maintains timer (count-up or countdown)

Every tick broadcast timestamp

Client adjusts via drift correction

Testing Criteria

All players show same time ±20ms

Timer pauses when pause message sent

Resumes perfectly

Time Estimate: 0.5 day

🧩 PART 8 — Single-Player Mode Blocking
Tasks

Toggle in server:

serverConfig.singlePlayerActive = true/false;


When active:

Reject new WebSocket connections

Show reason to rejected players: “Single Player Mode Active”

Testing Criteria

Reject connections reliably

Returning to multiplayer mode re-allows joins

No lingering WS errors

Time Estimate: 0.5 day

🧩 PART 9 — Integration With Developer 3 (NPC logic)

Tasks

Define shared data model for NPC movement

Allow server to “pretend” NPCs are players

Ensure NPCs receive:

Bomb events

Position updates

Game timer

Scores

NPCs CANNOT send pause or quit

Testing Criteria

NPCs appear identical to human players from networking POV

NPCs never interact with menus

No infinite loop due to NPC commands

NPC collision + bomb logic works the same way

Time Estimate: 1 day

⏱ TOTAL ESTIMATED TIME

Developer 2 estimated workload: 10–12 days

This fits comfortably in typical project timelines and aligns with the complexity of a real-time multiplayer Bomberman without canvas.