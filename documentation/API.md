# API Documentation

This document describes all Socket.io events and HTTP endpoints used for client-server communication.

## HTTP Endpoints

### `GET /health`
Health check endpoint for monitoring server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890123,
  "uptime": 3600,
  "rooms": 5,
  "environment": "production"
}
```

---

### `GET /metrics`
Metrics endpoint for monitoring game health and performance.

**Response:**
```json
{
  "timestamp": 1234567890123,
  "uptime": 3600,
  "connections": {
    "total": 150,
    "active": 12,
    "totalDisconnections": 138,
    "connectionRate": 2
  },
  "rooms": {
    "totalCreated": 50,
    "totalDeleted": 45,
    "active": 5,
    "activePlayers": 12
  },
  "games": {
    "totalStarted": 45,
    "totalEnded": 40,
    "averageDuration": 180000,
    "averageDurationFormatted": "3m 0s",
    "totalDurationsTracked": 40
  },
  "errors": {
    "total": 10,
    "byType": {
      "INVALID_MOVEMENT": 3,
      "ROOM_NOT_FOUND": 2,
      "RATE_LIMIT_EXCEEDED": 5
    },
    "recent": [
      {
        "timestamp": 1234567890000,
        "code": "INVALID_MOVEMENT",
        "message": "Invalid movement data"
      }
    ],
    "errorRate": 0
  },
  "actions": {
    "moves": 5000,
    "bombs": 1200,
    "chat": 300,
    "powerups": 150,
    "total": 6650
  },
  "rateLimiting": {
    "MOVE": 25,
    "BOMB": 10,
    "CHAT": 5,
    "POWERUP_PICKUP": 2,
    "total": 42
  }
}
```

**Metrics Explained:**
- **connections**: Total and active connection counts, connection rate per minute
- **rooms**: Room creation/deletion counts, current active rooms and players
- **games**: Game start/end counts, average game duration
- **errors**: Total errors, breakdown by error code, recent error history
- **actions**: Count of player actions (moves, bombs, chat, powerups)
- **rateLimiting**: Count of rate limit hits by action type

---

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
    difficulties: string[],     // Array of difficulty levels ['easy'|'medium'|'hard']
    strategies: string[],       // Array of strategies ['balanced'|'aggressive'|'defensive'|'powerup-hunter'|'trapper']
    names: string[]             // Array of custom names (optional, defaults to 'Bot 1', 'Bot 2', etc.)
}
```

**Example (Custom Mode):**
```javascript
{
    count: 2,
    difficulties: ['easy', 'hard'],
    strategies: ['defensive', 'trapper'],
    names: ['Guardian', 'The Trap Master']
}
```

**Example (Preset Mode):**
```javascript
{
    count: 2,
    difficulties: ['hard', 'medium'],
    strategies: ['aggressive', 'powerup-hunter'],
    names: ['The Aggressor', 'The Collector']
}
```

**Response:** `npcs-configured` event

**Note:** 
- If `strategies` is not provided, NPCs use default strategies based on difficulty (Easy→Defensive, Medium→Balanced, Hard→Aggressive)
- If `names` is not provided, NPCs are named 'Bot 1', 'Bot 2', etc.
- Difficulty and strategy work together: difficulty affects execution quality (speed, mistakes), while strategy affects behavioral focus (target priorities, bomb frequency)

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

Rate limiting is implemented server-side using a sliding window algorithm. Different actions have different rate limits:

- **MOVE**: 20 actions per second (1000ms window)
- **BOMB**: 10 actions per second (1000ms window)
- **CHAT**: 5 messages per second (1000ms window)
- **POWERUP_PICKUP**: 10 actions per second (1000ms window)

Rate limits are enforced per socket connection. When a rate limit is exceeded, the server emits an `error` event to the client (except for BOMB actions, which are silently ignored to allow rapid chain reactions).

Rate limit data is automatically cleaned up when a socket disconnects.

---

## Security Considerations

- **Input Validation**: Server validates all positions and actions
- **Bounds Checking**: All coordinates checked against grid bounds
- **Collision Detection**: Server verifies valid moves
- **Authority**: Server is authoritative for game state
- **NPC Security**: NPCs run server-side only (cannot be manipulated)
