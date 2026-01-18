# Architecture Documentation

## Overview

This document describes the architecture of the Bomberman-style multiplayer web game, including client-server communication, game state management, and system design.

## System Architecture

```
┌─────────────┐   WebSocket (Socket.io)   ┌─────────────┐
│   Client 1  │◄─────────────────────────►│             │
├─────────────┤                            │   Server    │
│   Client 2  │◄─────────────────────────►│   (Node.js) │
├─────────────┤                            │             │
│   Client 3  │◄─────────────────────────►│             │
├─────────────┤                            └─────────────┘
│   Client 4  │◄─────────────────────────►
└─────────────┘
         │
         │ HTTP (Static Files)
         ▼
    ┌─────────┐
    │  Static │
    │   HTML  │
    │   JS    │
    │   CSS   │
    └─────────┘
```

## Client Architecture

### Entry Point

**File**: `client/public/js/main.js`

- Initializes all UI components
- Sets up Socket.io connection
- Manages game state synchronization
- Runs main game loop (60 FPS)

### Core Modules

#### Game Logic
- **`game/bombController.js`**: Bomb placement and explosion handling
- **`game/blockController.js`**: Block destruction logic
- **`game/powerupController.js`**: Power-up spawning and collection

#### Rendering
- **`grid.js`**: DOM-based grid system (13×15 tiles)
- **`player.js`**: Player model and state
- **`renderPlayer.js`**: Player rendering and animations
- **`render/bombRender.js`**: Bomb visual rendering
- **`render/explosionRender.js`**: Explosion effects

#### UI Components
- **`ui/menu.js`**: Main menu and game mode selection
- **`ui/lobby.js`**: Lobby screen for multiplayer
- **`ui/pause.js`**: Pause/resume/quit menu
- **`ui/scoreboard.js`**: Player stats display
- **`ui/timer.js`**: Game timer
- **`ui/chat.js`**: In-game chat system
- **`ui/endgame.js`**: Winner screen

#### Audio
- **`audio/soundManager.js`**: Sound effects system

### Client-Side Game Loop

```javascript
function gameLoop() {
    if (!isPaused) {
        updatePlayerMovement(player)
        checkPowerupPickup(player)
        updatePlayerRender(player)
        // Update remote players
    }
    requestAnimationFrame(gameLoop)
}
```

Runs at 60 FPS using `requestAnimationFrame`.

## Server Architecture

### Entry Point

**File**: `server/server.js`

- Sets up Express server for static files
- Initializes Socket.io WebSocket server
- Registers all socket event handlers
- Starts game loop

### Core Modules

#### Game Loop
**File**: `server/game-loop.js`

- Runs at 60 FPS
- Processes all active rooms
- Updates NPCs (single-player mode)
- Handles bomb explosions and chain reactions
- Manages block destruction and power-up spawning
- Detects game end conditions

#### Socket Handlers
**Directory**: `server/socket-handlers/`

- **`room.js`**: Room creation and joining
- **`player.js`**: Player movement and damage
- **`bomb.js`**: Bomb placement
- **`powerup.js`**: Power-up collection
- **`game.js`**: Game control (start, pause, resume, quit)
- **`chat.js`**: Chat messages
- **`lobby.js`**: Lobby browser
- **`npc-handlers.js`**: NPC configuration (single-player)

#### Utilities
**Directory**: `server/utils/` (modular utilities)

- **`room-utils.js`**: Room code generation, colors, positions, lobby functions
- **`board-utils.js`**: Board generation, explosion calculations
- **`game-state-utils.js`**: State synchronization, game end checking
- **`npc-utils.js`**: NPC action processing

**Backward compatibility**: `server/utils.js` re-exports all utilities for existing imports

#### NPC System
**Directory**: `server/npc/` (modular AI system)

- **`NPC.js`**: Main NPC class (orchestrator)
- **`BehaviorStrategies.js`**: AI behavior strategies
- **`core/NPCState.js`**: State management
- **`core/DecisionLoop.js`**: Sense-Think-Act decision loop
- **`behaviors/`**: Behavior handlers (Escape, Movement, Bombing, Targeting, Powerup, Planning)
- **`config/DifficultyProfiles.js`**: Easy/Medium/Hard configurations
- **`utils/`**: Utilities (Pathfinder, DangerDetector, ItemEvaluator, PositionHelpers, StuckDetector)

See [NPC README](server/npc/README.md) for detailed documentation.

### Server-Side Game Loop

```javascript
setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (!room.gameState.isRunning || room.gameState.isPaused) return
        
        syncRoomGameState(room)
        
        // Update NPCs (single-player mode only)
        if (room.gameState.gameMode === 'single-player') {
            room.npcs.forEach((npc, npcId) => {
                npc.updateWorldState(room.gameState)
                const action = npc.getNextCommand(Date.now())
                if (action) {
                    handleNPCAction(io, room, roomId, npcId, action)
                }
            })
        }
        
        // Process bombs and explosions
        // ...
    })
}, 1000 / 60) // 60 FPS
```

## Data Flow

### Player Movement

1. **Client**: Player presses arrow key
2. **Client**: Updates local player position immediately (client-side prediction)
3. **Client**: Sends `player:move` event to server
4. **Server**: Validates movement
5. **Server**: Updates room state
6. **Server**: Broadcasts `player:moved` to all clients in room
7. **Client**: Updates remote player positions

### Bomb Placement

1. **Client**: Player presses space bar
2. **Client**: Validates bomb placement locally
3. **Client**: Renders bomb immediately
4. **Client**: Sends `bomb:place` event to server
5. **Server**: Validates and adds bomb to game state
6. **Server**: Broadcasts `bomb:placed` to all clients
7. **Server**: After 3 seconds, calculates explosion
8. **Server**: Broadcasts `bomb:exploded` and `blocks:destroyed`
9. **Client**: Renders explosion and block destruction

### Power-up Collection

1. **Client**: Detects player stepping on power-up
2. **Client**: Sends `powerup:pickup` event to server
3. **Server**: Removes power-up from game state
4. **Server**: Updates player stats (bombRange, maxBombs, or immortal based on type)
5. **Server**: Broadcasts `powerup:picked` to all clients
6. **Client**: Removes power-up visual and updates player stats

### NPC Actions

1. **Server**: NPC makes decision in game loop
2. **Server**: `handleNPCAction()` processes action
3. **Server**: Updates NPC position or places bomb
4. **Server**: Checks for power-up collection (server-side)
5. **Server**: Broadcasts actions to all clients
6. **Client**: Updates NPC visuals

## Game State Structure

### Room State

```javascript
{
    host: 'socket-id',
    players: Map<playerId, playerData>,
    npcs: Map<npcId, NPC>,
    gameState: {
        players: Array<playerData>,
        bombs: Array<bombData>,
        powerups: Array<powerupData>,
        board: Array<Array<number>>, // 0=walkable, 1=block, 2=wall
        gameMode: 'multiplayer' | 'single-player',
        isRunning: boolean,
        isPaused: boolean
    },
    chats: Array<chatMessage>
}
```

### Player Data

```javascript
{
    id: 'socket-id',
    name: 'Player Name',
    x: 1,              // Grid row (0-12)
    y: 1,              // Grid col (0-14)
    color: 'blue',
    lives: 3,
    alive: true,
    score: 0,
    bombRange: 2,      // Default 2, increases with bomb_range power-ups
    maxBombs: 1,       // Default 1, increases with bomb_count power-ups
    immortal: false,   // Temporary immortality from immortal power-up
    immortalEnd: 0,    // Timestamp when immortality expires
    isNPC: false
}
```

### Bomb Data

```javascript
{
    id: 'bomb-id',
    playerId: 'socket-id',
    x: 3,
    y: 3,
    range: 2,          // Explosion range
    timer: 3000,       // Time until explosion (ms)
    placedAt: timestamp
}
```

### Power-up Data

```javascript
{
    id: 'powerup-id',
    type: 'bomb_range' | 'bomb_count' | 'immortal',
    x: 5,
    y: 5
}
```

## Communication Protocol

### Client → Server Events

- `room:host` - Create new room
- `room:join` - Join existing room
- `player:move` - Player movement
- `bomb:place` - Place bomb
- `powerup:pickup` - Collect power-up
- `player:damage` - Player took damage
- `game:start` - Start game (host only)
- `game:pause` - Pause game
- `game:quit` - Quit game
- `chat:message` - Send chat message
- `set-game-mode` - Set single-player/multiplayer mode
- `configure-npcs` - Configure NPCs for single-player

### Server → Client Events

- `room:created` - Room created successfully
- `room:updated` - Room state updated
- `game:state` - Full game state sync
- `game:started` - Game started
- `game:end` - Game ended (winner detected)
- `game:pause` - Game paused/resumed
- `player:joined` - New player joined
- `player:left` - Player left
- `player:moved` - Player position updated
- `player:damaged` - Player took damage
- `bomb:placed` - Bomb placed
- `bomb:exploded` - Bomb exploded
- `block:destroyed` - Block destroyed
- `blocks:destroyed` - Multiple blocks destroyed
- `powerup:spawned` - Power-up spawned
- `powerup:picked` - Power-up collected
- `error` - Error message
- `lobby:updated` - Lobby list updated

## Rendering Strategy

### DOM-Based Rendering

- **No Canvas**: All rendering uses DOM elements
- **Grid System**: 13×15 grid of div elements
- **Animations**: CSS transitions and transforms
- **Performance**: GPU-accelerated transforms for smooth 60 FPS

### Element Structure

```html
<div id="grid">
    <div id="tile-0-0" class="tile empty"></div>
    <div id="tile-0-1" class="tile block breakable"></div>
    <!-- ... more tiles ... -->
    <div class="player" data-id="player-1"></div>
    <div class="bomb" data-id="bomb-1"></div>
    <div class="powerup" data-id="powerup-1">💣</div>
</div>
```

### Animation Performance

- Uses `transform` and `opacity` (GPU-accelerated)
- Minimizes layout recalculations
- Batches DOM updates
- Uses `will-change` CSS property for animated elements

## Performance Considerations

### Client

- **60 FPS Target**: Maintained via `requestAnimationFrame`
- **DOM Optimization**: Minimal reflows, use transforms
- **Network**: Only send position changes, not every frame
- **Audio Pooling**: Reuse audio objects to avoid lag

### Server

- **60 FPS Game Loop**: Processes all rooms efficiently
- **State Sync**: Only syncs when changes occur
- **NPC Efficiency**: NPCs make decisions every 100-300ms (not every frame)
- **Memory**: Rooms cleaned up when empty

## Security

### Input Validation

- Server validates all player actions
- Position bounds checking
- Bomb placement validation
- Movement collision detection

### Server Authority

- Game state is server-authoritative
- Client predictions can be corrected by server
- NPCs run entirely on server (cannot be cheated)

## Scalability

### Current Limitations

- Single server instance
- In-memory room storage
- No horizontal scaling

### Future Improvements

- Redis for room state (multi-server support)
- Database for persistent game history
- Load balancing for multiple game servers

## Testing

### Unit Tests

- NPC AI logic (`server/npc/test-npc.js`)
- Pathfinding algorithm
- Danger detection

### Integration Tests

- Manual testing with multiple clients
- Network latency simulation
- Stress testing with multiple rooms

## Development Workflow

1. **Local Development**: `npm start` runs server with nodemon
2. **Client Changes**: Refresh browser (no build step)
3. **Server Changes**: Auto-reloads with nodemon
4. **Testing**: Manual testing in multiple browser tabs

## Dependencies

### Server

- `express`: Static file serving
- `socket.io`: WebSocket communication
- `nodemon`: Development auto-reload

### Client

- `socket.io-client`: WebSocket client (CDN)
- No build tools or frameworks
