# Room/Lobby System Implementation Plan

## Overview

Implement a host-based room system where one player creates a game lobby and others can join using a room code.

---

## User Flow

### Host Flow

1. User clicks **"Host Game"** button on menu
2. Server generates a random room code (e.g., "ABC123")
3. User is taken to **lobby screen** (waiting room)
4. Lobby screen displays:
   - Room code prominently (for sharing)
   - List of connected players (1/4)
   - "Start Game" button (enabled when ≥2 players)
5. Host waits for other players to join
6. When ready (≥2 players), host clicks **"Start Game"**
7. Game begins for all players in that room

### Join Flow

1. User clicks **"Join Game"** button on menu
2. User is shown a **room code input field**
3. User enters the room code and clicks "Join"
4. Client sends `player:join` with room code
5. Server validates:
   - Room exists
   - Game hasn't started yet
   - Room isn't full (max 4 players)
6. If valid → user enters the lobby screen (same as host)
7. User waits for host to start the game

---

## Technical Implementation

### Menu UI Changes

**Add two buttons:**

- "Host Game" → generates room, goes to lobby
- "Join Game" → shows room code input

### Lobby Screen (new screen)

**Elements needed:**

- Room code display (big, copyable)
- Player list (shows names/colors of connected players)
- "Start Game" button (host only, enabled when ≥2 players)
- "Leave" button (returns to menu)

### Server Changes

**Room data structure:**

```javascript
const rooms = new Map(); // roomId -> room object

room = {
  id: "ABC123",
  host: socket.id,
  players: Map(),
  gameStarted: false,
  usedSpawns: Set(),
  createdAt: timestamp,
};
```

**Socket Events:**

1. `host:create` (client → server)

   - Generate random 6-char room code
   - Create room with host as first player
   - Emit `room:created` with room code back to host

2. `player:join` (client → server, with roomId)

   - Validate room exists
   - Validate game not started
   - Validate not full
   - Add player to room
   - Broadcast `player:joined` to room

3. `host:start-game` (client → server)

   - Validate sender is host
   - Validate ≥2 players
   - Set `room.gameStarted = true`
   - Emit `game:started` to all players in room
   - Players transition from lobby to game

4. `player:leave-lobby` (client → server)
   - Remove player from room
   - If host leaves → assign new host or close room
   - Broadcast `player:left` to room

### Client Changes

**New screens:**

- Lobby screen (HTML + CSS)

**Socket handlers:**

- `room:created` → show room code, enter lobby
- `game:started` → transition from lobby to game screen
- `player:joined` → update player list in lobby
- `player:left` → update player list in lobby

**Room code generation:**

- Server-side: random 6-character alphanumeric string
- Display prominently for host to share

---

## Rules & Constraints

1. **Minimum players:** 2 (host can't start alone)
2. **Maximum players:** 4
3. **Join restriction:** Can't join once game has started
4. **Host powers:** Only host can start the game
5. **Host transfer:** If host leaves lobby, assign next player as host
6. **Room cleanup:** Delete room when all players leave or game ends

---

## Implementation Steps

### Phase 1: Server Room System

- [ ] Create room data structure
- [ ] Implement `host:create` event → generate room code
- [ ] Implement `player:join` with room validation
- [ ] Implement `host:start-game` event
- [ ] Test with socket.io room broadcasts

### Phase 2: Client Lobby UI

- [ ] Add "Host Game" and "Join Game" buttons to menu
- [ ] Create lobby screen HTML/CSS
- [ ] Show room code display
- [ ] Show player list (update on join/leave)
- [ ] Add "Start Game" button (host only, ≥2 players)

### Phase 3: Integration

- [ ] Connect menu buttons to socket events
- [ ] Handle `room:created` → show lobby
- [ ] Handle `game:started` → show game screen
- [ ] Handle join errors (room full, not found, already started)
- [ ] Test full flow: host create → players join → host start

### Phase 4: Edge Cases

- [ ] Handle host disconnect (reassign or close room)
- [ ] Handle player disconnect in lobby
- [ ] Prevent joining after game starts
- [ ] Room cleanup after game ends
- [ ] Add "Copy Room Code" button for easy sharing

---

## Notes

- Room codes should be short and easy to share (6 chars: ABC123)
- Consider adding a room browser later (list of open lobbies)
- Could add chat in lobby for coordination
- Consider adding ready/unready system instead of host-only start
