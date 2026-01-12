# API Documentation

## Socket.io Event Protocol

This document describes all Socket.io events used for client-server communication.

## Client → Server Events

### Room Management

#### `room:host`
Create a new game room.

**Payload:**
```javascript
{
    name: string  // Player name (min 2 characters)
}
```

**Response:** `room:created` event

---

#### `room:join`
Join an existing game room.

**Payload:**
```javascript
{
    roomId: string,  // Room code
    name: string     // Player name (min 2 characters)
}
```

**Response:** `room:updated` or `error` event

---

### Player Actions

#### `player:move`
Send player movement to server.

**Payload:**
```javascript
{
    x: number,  // Grid row (0-12)
    y: number   // Grid col (0-14)
}
```

**Response:** `player:moved` broadcast to all clients

---

#### `bomb:place`
Place a bomb at current position.

**Payload:**
```javascript
{
    bombId: string,    // Unique bomb ID
    playerId: string,  // Player ID
    x: number,         // Grid row
    y: number,         // Grid col
    duration: number,  // Bomb timer (ms, default 3000)
    range: number      // Explosion range (default 2)
}
```

**Response:** `bomb:placed` broadcast to all clients

---

#### `powerup:pickup`
Collect a power-up.

**Payload:**
```javascript
{
    powerupId: string,  // Power-up ID
    playerId: string,    // Player ID
    x: number,           // Grid row
    y: number            // Grid col
}
```

**Response:** `powerup:picked` broadcast to all clients

---

#### `player:damage`
Notify server that player took damage.

**Payload:**
```javascript
{
    playerId: string,  // Player ID
    lives: number,     // Remaining lives
    died: boolean      // Whether player died
}
```

**Response:** `player:damaged` broadcast to all clients

---

### Game Control

#### `game:start`
Start the game (host only).

**Payload:**
```javascript
{
    roomCode: string  // Room code
}
```

**Response:** `game:started` event

---

#### `game:pause`
Pause or resume the game.

**Payload:**
```javascript
{
    paused: boolean,  // true = pause, false = resume
    ts: number        // Timestamp
}
```

**Response:** `game:pause` broadcast to all clients

---

#### `game:quit`
Quit the current game.

**Payload:** None

**Response:** Player removed from room, `player:left` broadcast

---

### Chat

#### `chat:message`
Send a chat message.

**Payload:**
```javascript
{
    message: string,  // Message text (max 200 characters)
    playerId: string, // Player ID
    playerName: string // Player name
}
```

**Response:** `chat:message` broadcast to all clients in room

---

### Single-Player / NPC

#### `set-game-mode`
Set game mode (single-player or multiplayer).

**Payload:**
```javascript
{
    mode: 'single-player' | 'multiplayer'
}
```

**Response:** `game-mode-changed` event

---

#### `configure-npcs`
Configure NPCs for single-player mode.

**Payload:**
```javascript
{
    count: number,              // Number of NPCs (1-3)
    difficulties: string[]     // Array of difficulty levels
}
```

**Response:** `npcs-configured` event

---

## Server → Client Events

### Room Events

#### `room:created`
Room created successfully.

**Payload:**
```javascript
{
    roomCode: string,
    players: Array<playerData>,
    gameMode: string
}
```

---

#### `room:updated`
Room state updated (player joined/left, NPCs added).

**Payload:**
```javascript
{
    roomCode: string,
    players: Array<playerData>,
    hostId: string,
    isRunning: boolean,
    gameMode: string,
    chats: Array<chatMessage>
}
```

---

#### `game:state`
Full game state synchronization.

**Payload:**
```javascript
{
    players: Array<playerData>,
    bombs: Array<bombData>,
    powerups: Array<powerupData>,
    board: Array<Array<number>>,
    gameMode: string
}
```

---

### Game Flow

#### `game:started`
Game has started.

**Payload:**
```javascript
{
    roomCode: string,
    players: Array<playerData>,
    board: Array<Array<number>>,
    powerups: Array<powerupData>,
    gameMode: string,
    chats: Array<chatMessage>
}
```

---

#### `game:end`
Game ended (winner detected).

**Payload:**
```javascript
{
    winner: playerData | null,  // null if draw
    isDraw: boolean,
    players: Array<playerData>  // All players with final scores
}
```

---

#### `game:pause`
Game paused or resumed.

**Payload:**
```javascript
{
    paused: boolean,
    name: string  // Player name who paused/resumed
}
```

---

### Player Events

#### `player:joined`
New player joined the room.

**Payload:**
```javascript
{
    id: string,
    name: string,
    x: number,
    y: number,
    color: string,
    alive: boolean,
    score: number,
    lives: number
}
```

---

#### `player:left`
Player left the room.

**Payload:**
```javascript
{
    playerId: string
}
```

---

#### `player:moved`
Player position updated.

**Payload:**
```javascript
{
    id: string,  // Player ID
    x: number,   // New row position
    y: number    // New col position
}
```

---

#### `player:damaged`
Player took damage.

**Payload:**
```javascript
{
    playerId: string,
    lives: number,    // Remaining lives
    died: boolean     // Whether player died
}
```

---

### Bomb Events

#### `bomb:placed`
Bomb placed on the map.

**Payload:**
```javascript
{
    bombId: string,
    playerId: string,
    x: number,
    y: number,
    duration: number,  // Bomb timer (ms)
    range: number      // Explosion range
}
```

---

#### `bomb:exploded`
Bomb exploded (server-authoritative).

**Payload:**
```javascript
{
    bombId: string,
    playerId: string,
    x: number,
    y: number,
    range: number
}
```

---

### Block Events

#### `block:destroyed`
Single block destroyed.

**Payload:**
```javascript
{
    x: number,
    y: number,
    timestamp: number
}
```

---

#### `blocks:destroyed`
Multiple blocks destroyed.

**Payload:**
```javascript
{
    blocks: Array<{x: number, y: number}>,
    timestamp: number
}
```

---

### Power-up Events

#### `powerup:spawned`
Power-up spawned on the map.

**Payload:**
```javascript
{
    powerups: Array<{
        id: string,
        type: string,  // 'bomb_range' | 'bomb_count' | 'immortal'
        x: number,
        y: number
    }>
}
```

---

#### `powerup:picked`
Power-up collected by a player.

**Payload:**
```javascript
{
    powerupId: string,
    playerId: string,
    x: number,
    y: number,
    type: string  // Power-up type
}
```

---

### NPC Events

#### `npcs-configured`
NPCs configured for single-player mode.

**Payload:**
```javascript
{
    count: number,
    npcs: Array<{
        id: string,
        name: string,
        difficulty: string
    }>
}
```

---

#### `game-mode-changed`
Game mode changed.

**Payload:**
```javascript
{
    mode: 'single-player' | 'multiplayer'
}
```

---

### Error Events

#### `error`
Error occurred.

**Payload:**
```javascript
{
    message: string  // Error message
}
```

---

### Lobby Events

#### `lobby:updated`
Active lobbies list updated.

**Payload:**
```javascript
{
    lobbies: Array<{
        roomCode: string,
        playerCount: number,
        maxPlayers: number
    }>
}
```

---

## Data Types

### Player Data

```javascript
{
    id: string,           // Unique player ID
    name: string,          // Player name
    x: number,            // Grid row (0-12)
    y: number,            // Grid col (0-14)
    color: string,        // Player color
    alive: boolean,       // Whether player is alive
    score: number,        // Player score
    lives: number,        // Remaining lives (1-3)
    bombRange: number,    // Bomb explosion range (default 2, can be increased)
    maxBombs: number,     // Maximum bombs that can be placed simultaneously (default 1, can be increased)
    immortal: boolean,    // Whether player has immortality (temporary)
    immortalEnd: number,  // Timestamp when immortality expires
    isNPC: boolean        // Whether this is an NPC
}
```

### Bomb Data

```javascript
{
    id: string,           // Unique bomb ID
    bombId: string,       // Alias for id
    playerId: string,     // Player who placed it
    x: number,           // Grid row
    y: number,           // Grid col
    range: number,       // Explosion range
    timer: number,       // Time until explosion (ms)
    placedAt: number,    // Timestamp when placed
    duration: number     // Total duration (ms)
}
```

### Power-up Data

```javascript
{
    id: string,          // Unique power-up ID
    type: string,        // 'bomb_range' | 'bomb_count' | 'immortal'
    x: number,          // Grid row
    y: number           // Grid col
}
```

### Board Data

2D array where:
- `0` = walkable/empty tile
- `1` = destructible block
- `2` = indestructible wall

```javascript
[
    [2, 2, 2, 2, ...],  // Row 0
    [2, 0, 1, 0, ...],  // Row 1
    [2, 1, 0, 1, ...],  // Row 2
    ...
]
```

### Chat Message

```javascript
{
    playerId: string,
    playerName: string,
    message: string,
    timestamp: number
}
```

---

## Error Handling

### Common Errors

- **"Only host can start the game"**: Non-host tried to start game
- **"Lobby is full"**: Room already has 4 players
- **"Room not found"**: Invalid room code
- **"NPCs only available in single-player mode"**: Tried to configure NPCs in multiplayer
- **"Single-player mode is disabled"**: Feature flag disabled

All errors are sent via `error` event with a descriptive message.

---

## Connection Lifecycle

1. **Client connects**: Socket.io connection established
2. **Client joins room**: `room:host` or `room:join` event
3. **Game state sync**: Server sends `room:created` or `room:updated`
4. **Gameplay**: Client sends actions, server broadcasts updates
5. **Disconnect**: Server cleans up player, broadcasts `player:left`

---

## Rate Limiting

Currently no rate limiting implemented. Consider adding:
- Movement rate limiting (max updates per second)
- Bomb placement cooldown (handled client-side)
- Chat message throttling

---

## Security Considerations

- **Input Validation**: Server validates all positions and actions
- **Bounds Checking**: All coordinates checked against grid bounds
- **Collision Detection**: Server verifies valid moves
- **Authority**: Server is authoritative for game state
- **NPC Security**: NPCs run server-side only (cannot be manipulated)
