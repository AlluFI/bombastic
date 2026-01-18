# NPC Module

This module contains the complete NPC (Non-Player Character) framework for single-player mode. NPCs are AI-controlled opponents that can play Bomberman with varying difficulty levels and behavior strategies.

## ⚠️ Feature Flag

**This entire module is feature-flagged and should be disabled for the first review.**

To disable NPCs:
- Set `ENABLE_NPC=false` in environment variables
- Or comment out NPC imports in `server/server.js`

---

## 📁 Folder Structure

```
server/npc/
├── NPC.js                        # Main NPC class (orchestrator)
├── BehaviorStrategies.js         # AI behavior strategies (Aggressive, Defensive, etc.)
├── index.js                      # Module entry point (exports all classes)
├── test-npc.js                   # Standalone test suite for NPC framework
├── README.md                     # This file (module overview)
│
├── core/                         # Core NPC modules
│   ├── NPCState.js              # State management (updateWorldState, reset)
│   └── DecisionLoop.js          # Sense-Think-Act decision loop
│
├── behaviors/                    # Behavior handler modules
│   ├── EscapeHandler.js         # Escape logic and danger detection
│   ├── MovementHandler.js       # Movement decisions and pathfinding
│   ├── BombingHandler.js        # Bomb placement decisions
│   ├── TargetingHandler.js      # Target selection (players, powerups, blocks)
│   ├── PowerupHandler.js        # Powerup collection logic
│   └── PlanningHandler.js       # Multi-step planning system
│
├── config/                       # Configuration modules
│   └── DifficultyProfiles.js    # Easy/Medium/Hard difficulty configurations
│
├── utils/                        # Utility modules
│   ├── Pathfinder.js            # Grid-based pathfinding (BFS algorithm)
│   ├── DangerDetector.js        # Bomb danger zone calculation and detection
│   ├── ItemEvaluator.js         # Powerup evaluation and prioritization
│   ├── PositionHelpers.js       # Position calculations and validation
│   └── StuckDetector.js         # Loop detection and recovery
│
└── Documentation/                # Working documents (development notes)
    ├── NPC_EXPLANATION.md       # Detailed NPC system explanation
    └── DIFFICULTY_AND_STRATEGY_EXPLANATION.md  # Difficulty and strategy guide
```

---

## 📄 File Descriptions

### Core Files

#### `NPC.js`
**Main NPC class** - Orchestrates behavior modules.

- **Purpose**: Provides the NPC class interface and delegates to behavior modules
- **Key Features**:
  - Lightweight orchestrator (~107 lines)
  - Initializes state in constructor
  - Delegates to behavior modules for all logic
  - Maintains the same public API as before refactoring

- **Main Methods**:
  - `updateWorldState(gameState)` - Delegates to `NPCState.updateWorldState()`
  - `getNextCommand(currentTime)` - Delegates to `DecisionLoop.getNextCommand()`
  - `reset()` - Delegates to `NPCState.reset()`

#### `BehaviorStrategies.js`
**AI behavior strategies** - Defines different playstyles.

- **Purpose**: Provides distinct AI personalities and strategies
- **Available Strategies**:
  - **Aggressive**: High priority on attacking players, frequent bombs
  - **Defensive**: High priority on survival, avoids danger
  - **Balanced**: Mix of offensive and defensive play
  - **Power-up Hunter**: Prioritizes collecting powerups
  - **Trapper**: Strategic bomb placement to trap opponents

- **Strategy Selection**:
  - Auto-selected based on difficulty (Easy→Defensive, Medium→Balanced, Hard→Aggressive)
  - Can be customized per NPC via UI (Custom mode) or preset configurations (Preset mode)
  - Available strategies: `balanced`, `aggressive`, `defensive`, `powerup-hunter`, `trapper`

#### `index.js`
**Module entry point** - Exports all NPC classes and utilities.

- **Purpose**: Provides a single import point for the entire NPC module
- **Exports**:
  - `NPC` - Main NPC class
  - `DifficultyProfiles` - Configuration module
  - `BehaviorStrategies` - Strategy definitions
  - `Pathfinder`, `DangerDetector`, `ItemEvaluator` - Utility modules

### Core Modules (`core/`)

#### `NPCState.js`
**State management** - Handles NPC world state updates and reset.

- **Purpose**: Manages NPC's internal representation of the game world
- **Key Methods**:
  - `updateWorldState(npc, gameState)` - Updates NPC state from game state
  - `updateNavigationGrid(npc, gameState)` - Updates pathfinding grid
  - `updatePositionHistory(npc)` - Tracks position for loop detection
  - `reset(npc)` - Resets NPC to initial state

#### `DecisionLoop.js`
**Decision-making loop** - Implements Sense-Think-Act architecture.

- **Purpose**: Coordinates behavior handlers to make decisions
- **Key Methods**:
  - `getNextCommand(npc, currentTime)` - Main entry point, orchestrates the loop
  - `sense(npc)` - Collects information about the world
  - `think(npc, currentTime, perception)` - Makes decisions based on perception
  - `act(npc, decision)` - Executes and validates decisions

### Behavior Modules (`behaviors/`)

#### `EscapeHandler.js`
**Escape behavior** - Handles danger detection and escape logic.

- **Purpose**: Ensures NPCs escape from bomb explosions
- **Key Methods**:
  - `isInDanger(npc)` - Checks if NPC is in a danger zone
  - `decideEscape(npc, preferredDirection, allowLessSafe)` - Determines escape action
  - `getRandomSafeDirection(npc, preferredDirection, allowLessSafe)` - Fallback escape
  - `hasEscapeRoute(npc)` - Checks if escape is possible

#### `MovementHandler.js`
**Movement behavior** - Handles movement decisions and pathfinding.

- **Purpose**: Manages NPC movement toward targets and exploration
- **Key Methods**:
  - `decideMovement(npc)` - Main movement decision logic
  - `decideSafeExploration(npc)` - Safe exploration when no target
  - `decideWander(npc)` - Random wandering behavior

#### `BombingHandler.js`
**Bombing behavior** - Handles bomb placement decisions.

- **Purpose**: Manages bomb placement strategy and safety checks
- **Key Methods**:
  - `decidePlaceBomb(npc, hasBlockTarget, hasPlayerTarget)` - Bomb placement decision
  - `evaluateBombTargets(npc)` - Evaluates potential bomb targets

#### `TargetingHandler.js`
**Targeting behavior** - Handles target selection and validation.

- **Purpose**: Selects and validates targets (players, powerups, blocks)
- **Key Methods**:
  - `selectTarget(npc)` - Main target selection logic
  - `isTargetValid(npc, target)` - Validates if target is still valid
  - `hasRouteToTarget(npc, target)` - Checks pathfinding availability
  - `findBlockingBlock(npc, target)` - Finds blocks blocking path to target
  - `findIntermediateBlockTowardPlayer(npc, player)` - Finds waypoint blocks

#### `PowerupHandler.js`
**Powerup behavior** - Handles powerup collection.

- **Purpose**: Manages powerup detection and collection
- **Key Methods**:
  - `decideCollectPowerup(npc)` - Powerup collection decision
  - `hasNearbyPowerups(npc)` - Checks for nearby powerups

#### `PlanningHandler.js`
**Planning behavior** - Handles multi-step planning.

- **Purpose**: Manages human-like commitment to movement plans
- **Key Methods**:
  - `isPlanValid(npc, plan)` - Validates current plan
  - `executePlanStep(npc, plan)` - Executes one step of plan
  - `calculatePlanSteps(npc, decision, perception)` - Calculates plan length

### Configuration Modules (`config/`)

#### `DifficultyProfiles.js`
**Difficulty configurations** - Defines Easy, Medium, and Hard profiles.

- **Purpose**: Provides base attributes for each difficulty level
- **Key Methods**:
  - `loadDifficultyProfile(difficulty, config)` - Loads profile with overrides
  - `getDifficultyProfile(difficulty)` - Gets profile by name
  - `isValidDifficulty(difficulty)` - Validates difficulty string

### Utility Modules (`utils/`)

#### `Pathfinder.js`
**Pathfinding utilities** - Grid-based navigation.

- **Purpose**: Finds paths between positions on the game board
- **Algorithm**: BFS (Breadth-First Search) - sufficient for Bomberman's small maps
- **Key Methods**:
  - `findPath(start, target, grid, maxRows, maxCols)` - Returns path array
  - `getNextDirection(start, target, grid, maxRows, maxCols)` - Returns direction string
  - `findNearestWalkable(start, target, grid, maxRows, maxCols)` - Finds nearest accessible position
  - `manhattanDistance(pos1, pos2)` - Calculates Manhattan distance

#### `DangerDetector.js`
**Danger detection utilities** - Calculates and identifies dangerous areas.

- **Purpose**: Helps NPCs avoid bomb explosions
- **Key Methods**:
  - `calculateDangerZones(bombs, grid, maxRows, maxCols)` - Returns Set of danger zone keys
  - `isInDanger(pos, dangerZones)` - Checks if position is dangerous
  - `findNearestSafePosition(start, dangerZones, grid, maxRows, maxCols)` - Finds safe escape route
  - `getTimeUntilExplosion(pos, bombs)` - Calculates time until explosion

#### `ItemEvaluator.js`
**Item evaluation utilities** - Evaluates and prioritizes powerups.

- **Purpose**: Helps NPCs decide which powerups to collect
- **Key Methods**:
  - `evaluatePowerup(powerup, npcState, priority)` - Returns value score
  - `findBestPowerup(powerups, npcState, priority)` - Returns best powerup to collect
  - `isPowerupWorthCollecting(powerup, npcState, dangerZones, priority)` - Risk assessment

#### `PositionHelpers.js`
**Position utilities** - Position calculations and validation.

- **Purpose**: Provides position manipulation and validation helpers
- **Key Methods**:
  - `getNextPosition(pos, direction)` - Calculates next position after move
  - `isValidPosition(pos, maxRows, maxCols)` - Validates position bounds
  - `isWalkable(npc, pos)` - Checks if position is walkable

#### `StuckDetector.js`
**Loop detection** - Detects and recovers from stuck states.

- **Purpose**: Prevents NPCs from getting stuck in loops
- **Key Methods**:
  - `isStuck(npc)` - Detects if NPC is stuck
  - `getUnstuck(npc)` - Provides escape action from stuck state

### Testing

#### `test-npc.js`
**Standalone test suite** - Tests NPC framework independently.

- **Purpose**: Allows testing NPC logic without full game engine or server
- **Usage**: `npm run test:npc` or `node server/npc/test-npc.js`
- **Tests**:
  - NPC creation and difficulty profiles
  - Decision-making over time
  - Danger detection and escape
  - Pathfinding algorithm
  - Safety checks (no suicide)
  - Behavior strategies
  - Loop prevention
  - Target selection
  - Bomb placement strategy

### Documentation Files

#### `NPC_EXPLANATION.md`
**Detailed explanation** - Comprehensive guide to NPC system architecture.

- Decision-making process
- State management
- Behavior strategies
- Difficulty system

#### `DIFFICULTY_AND_STRATEGY_EXPLANATION.md`
**Difficulty and strategy guide** - Explains how difficulty and strategies work.

- Difficulty attributes
- Strategy behaviors
- Interaction between difficulty and strategy

---

## 🚀 Usage

### Basic Usage

```javascript
const { NPC } = require('./npc');

// Create an NPC with default strategy (based on difficulty)
const npc = new NPC('npc-1', 'Bot Alice', 'medium');

// Or create an NPC with custom strategy
const npcWithStrategy = new NPC('npc-2', 'Bot Bob', 'hard', { 
  strategy: 'trapper' 
});

// Update NPC with game state
npc.updateWorldState(gameState);

// Get next action
const action = npc.getNextCommand(Date.now());
if (action) {
  // action = { type: 'MOVE', direction: 'UP' } 
  //       or { type: 'BOMB' }
  // Process action in game server
}
```

### Game State Format

NPCs expect `gameState` with:
```javascript
{
  players: [
    { id: 'player-1', name: 'Player', x: 1, y: 1, alive: true, score: 0 }
  ],
  bombs: [
    { id: 'bomb-1', x: 3, y: 3, range: 2, timer: 2000 }
  ],
  powerups: [
    { id: 'powerup-1', x: 4, y: 4, type: 'bomb-range' }
  ],
  board: [[0, 0, 0], [0, 1, 0], [0, 0, 0]], // 2D grid (0=walkable, 1=block, 2=wall)
  explosions: [] // Optional
}
```

### NPC Actions

NPCs return actions:
- `{ type: 'MOVE', direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' }` - Movement
- `{ type: 'BOMB' }` - Bomb placement
- `null` - No action needed

---

## 🎮 Difficulty Levels

### Easy
- **Default Strategy**: Defensive
- **Decision Interval**: 500ms
- **Bomb Placement Rate**: 20%
- **Mistake Rate**: 30%
- **Attack Range**: 2 tiles

### Medium
- **Default Strategy**: Balanced
- **Decision Interval**: 400ms
- **Bomb Placement Rate**: 50%
- **Mistake Rate**: 15%
- **Attack Range**: 3 tiles

### Hard
- **Default Strategy**: Aggressive
- **Decision Interval**: 300ms
- **Bomb Placement Rate**: 80%
- **Mistake Rate**: 5%
- **Attack Range**: 4 tiles

---

## 🎯 Behavior Strategies

Players can customize each NPC's strategy independently of difficulty level, creating unique gameplay experiences.

### Available Strategies

#### **Balanced** (Default for Medium)
- Mix of offensive and defensive play
- Moderate priority on players (0.6), powerups (0.6), and blocks (0.5)
- Bomb placement chance: 0.8
- Chase distance: 4 tiles

#### **Aggressive** (Default for Hard)
- High priority on attacking players (0.9)
- Frequent bomb placement (chance: 0.7)
- Actively chases players from far away (6 tiles)
- Takes calculated risks

#### **Defensive** (Default for Easy)
- High priority on survival
- Low priority on players (0.2)
- Rarely places bombs (chance: 0.2)
- Keeps distance from players (2 tiles)
- Often wanders to avoid conflict

#### **Power-up Hunter**
- Very high priority on collecting powerups (0.95)
- Moderate priority on players (0.4)
- Strategic bomb placement to clear paths to powerups (chance: 0.6)
- Willing to take risks for powerups
- Chase distance: 5 tiles

#### **Trapper**
- Focuses on strategic bomb placement (chance: 0.8)
- High priority on blocks (0.8) for strategic placement
- Tries to trap players in corners
- Uses bombs to control areas
- Close-range trapping (3 tiles)
- Special logic for far-away players (finds intermediate block waypoints)

### Strategy Customization

In single-player mode, players can customize NPCs in two ways:

#### **Custom Mode**
- **Name**: Custom name for each NPC (max 15 characters)
- **Difficulty**: Easy, Medium, or Hard (affects execution quality)
- **Strategy**: Balanced, Aggressive, Defensive, Power-up Hunter, or Trapper (affects behavioral focus)

#### **Preset Mode**
- Pre-configured NPC combinations:
  - **The Aggressor**: Hard + Aggressive
  - **The Defender**: Easy + Defensive
  - **The Collector**: Medium + Power-up Hunter
  - **The Trapper**: Hard + Trapper
  - **The Balanced**: Medium + Balanced

### How Difficulty and Strategy Interact

**Difficulty** controls execution quality (HOW WELL):
- Movement speed, decision-making speed, mistake rates, bomb placement frequency

**Strategy** controls behavioral focus (WHAT TO DO):
- Target priorities, bomb placement tendency, chase distance, wander behavior

**Key Interaction**: Final bomb placement chance = `strategy.bombPlacementChance × difficulty.bombPlacementRate`

**Example Combinations**:
- **Easy + Aggressive**: Wants to attack but makes mistakes (30%) and is slow (500ms decisions)
- **Hard + Defensive**: Wants to survive but executes perfectly (5% mistakes, 300ms decisions)
- **Medium + Trapper**: Wants to trap with moderate execution (15% mistakes, 400ms decisions)

Each of the 15 possible combinations (3 difficulties × 5 strategies) produces distinct, meaningful gameplay differences.

---

## 🧠 AI Decision-Making

NPCs follow a **Sense-Think-Act** loop:

1. **Sense**: Perceives the world
   - Current position and state
   - Nearby players, bombs, powerups
   - Danger zones
   - Available paths

2. **Think**: Makes decisions
   - Priority 1: Escape danger (if in danger zone)
   - Priority 2: Collect powerups (if strategy prioritizes)
   - Priority 3: Place bomb (if opportunity and strategy allows)
   - Priority 4: Move toward target (player/powerup/block)
   - Priority 5: Wander (if strategy allows)

3. **Act**: Executes decision
   - Returns action (MOVE or BOMB)
   - Updates internal state

The decision-making is implemented in `core/DecisionLoop.js` which coordinates all behavior handlers.

---

## 🧪 Testing

### Run Tests
```bash
npm run test:npc
```

### Test Coverage
- ✅ NPC creation with different difficulties
- ✅ Difficulty profile configurations
- ✅ Decision-making over time
- ✅ Danger zone detection
- ✅ Pathfinding algorithm
- ✅ Safety checks (no suicide)
- ✅ Behavior strategies
- ✅ Infinite loop prevention
- ✅ Target selection
- ✅ Bomb placement strategy

### Manual Testing
See `test-npc.js` for examples of creating and testing NPCs with mock game state.

---

## 📝 Notes

- **Server-side only**: All NPC logic runs on the server for security and consistency
- **Feature-flagged**: Can be disabled via `ENABLE_NPC` environment variable (note: this flag no longer exists, NPCs are always enabled when single-player mode is enabled)
- **Room-scoped**: NPCs are created per-room (not global)
- **Identical to players**: NPCs follow the same game rules as human players
- **No pause/quit**: NPCs cannot pause or quit games
- **Decision intervals**: NPCs make decisions every 300-500ms (based on difficulty)
- **State management**: NPCs maintain their own internal world state representation
- **Modular architecture**: NPC logic is split into focused modules for better maintainability

---

## 🔗 Integration

To integrate NPCs into the game server:

1. Import NPC module: `const { NPC } = require('./npc')`
2. Create NPCs when single-player mode is enabled
3. Update NPCs in game loop: `npc.updateWorldState(gameState)`
4. Get actions: `const action = npc.getNextCommand(Date.now())`
5. Process actions same as player actions
