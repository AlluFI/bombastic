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
├── NPC.js                        # Main NPC class (core AI logic)
├── DifficultyProfiles.js         # Easy/Medium/Hard difficulty configurations
├── BehaviorStrategies.js         # AI behavior strategies (Aggressive, Defensive, etc.)
├── index.js                      # Module entry point (exports all classes)
├── test-npc.js                   # Standalone test suite for NPC framework
├── README.md                     # This file (module overview)
│
├── utils/                        # Utility modules
│   ├── Pathfinder.js            # Grid-based pathfinding (BFS algorithm)
│   ├── DangerDetector.js        # Bomb danger zone calculation and detection
│   └── ItemEvaluator.js        # Powerup evaluation and prioritization
│
└── Documentation/                # Working documents (development notes)
    ├── PHASE3_SUMMARY.md        # Phase 3 Part 2 summary (Pathfinding & Danger Detection)
    └── PHASE3_BEHAVIOR_SUMMARY.md  # Phase 3 Part 3 summary (Behavior System)
```

---

## 📄 File Descriptions

### Core Files

#### `NPC.js`
**Main NPC class** - The heart of the AI system.

- **Purpose**: Implements the complete NPC decision-making system
- **Key Features**:
  - Sense-Think-Act loop (`_sense()`, `_think()`, `_act()`)
  - Difficulty-based behavior profiles
  - Behavior strategy system (Aggressive, Defensive, Balanced, etc.)
  - Pathfinding integration
  - Danger detection and escape logic
  - Powerup collection decisions
  - Bomb placement strategy
  - Infinite loop prevention
  - Target selection (players, powerups, blocks)

- **Main Methods**:
  - `updateWorldState(gameState)` - Updates NPC's internal world representation
  - `getNextCommand(currentTime)` - Returns next action (MOVE or BOMB)

#### `DifficultyProfiles.js`
**Difficulty configurations** - Defines Easy, Medium, and Hard profiles.

- **Purpose**: Provides base attributes for each difficulty level
- **Attributes per difficulty**:
  - Movement speed and delays
  - Decision-making intervals
  - Aggression levels
  - Bomb placement rates
  - Success rates (avoidance, bomb placement)
  - Powerup priorities
  - Strategy preferences

- **Exports**:
  - `DifficultyProfiles` - Object with easy/medium/hard profiles
  - `getDifficultyProfile(difficulty)` - Get profile by name
  - `isValidDifficulty(difficulty)` - Validate difficulty string

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
  - `DifficultyProfiles`, `getDifficultyProfile`, `isValidDifficulty`
  - `BehaviorStrategies`
  - `Pathfinder`, `DangerDetector`, `ItemEvaluator`

### Utility Modules (`utils/`)

#### `Pathfinder.js`
**Pathfinding utilities** - Grid-based navigation.

- **Purpose**: Finds paths between positions on the game board
- **Algorithm**: BFS (Breadth-First Search) - sufficient for Bomberman's small maps
- **Key Methods**:
  - `findPath(start, target, grid, maxRows, maxCols)` - Returns path array
  - `getNextDirection(start, target, grid, maxRows, maxCols)` - Returns direction string
  - `findNearestWalkable(start, target, grid, maxRows, maxCols)` - Finds nearest accessible position

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

#### `PHASE3_SUMMARY.md`
**Development notes** - Summary of Phase 3 Part 2 implementation.

- Pathfinding implementation
- Danger detection system
- Escape logic
- Safety checks

#### `PHASE3_BEHAVIOR_SUMMARY.md`
**Development notes** - Summary of Phase 3 Part 3 implementation.

- Behavior strategies system
- Difficulty-specific behaviors
- Target selection logic
- Infinite loop prevention
- Randomization and diversity

---

## 🚀 Usage

### Basic Usage

```javascript
const { NPC } = require('./npc');
const { ENABLE_NPC } = require('../config');

if (ENABLE_NPC) {
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
- **Speed**: 70% of normal
- **Decision Interval**: 500ms
- **Aggression**: 30%
- **Bomb Placement Rate**: 20%
- **Mistake Rate**: 30%
- **Avoidance Success**: 85%

### Medium
- **Default Strategy**: Balanced
- **Speed**: 100% of normal
- **Decision Interval**: 400ms
- **Aggression**: 60%
- **Bomb Placement Rate**: 50%
- **Mistake Rate**: 15%
- **Avoidance Success**: 95%

### Hard
- **Default Strategy**: Aggressive
- **Speed**: 130% of normal
- **Decision Interval**: 300ms
- **Aggression**: 90%
- **Bomb Placement Rate**: 80%
- **Mistake Rate**: 5%
- **Avoidance Success**: 98%

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

1. **Sense** (`_sense()`): Perceives the world
   - Current position and state
   - Nearby players, bombs, powerups
   - Danger zones
   - Available paths

2. **Think** (`_think()`): Makes decisions
   - Priority 1: Escape danger (if in danger zone)
   - Priority 2: Collect powerups (if strategy prioritizes)
   - Priority 3: Place bomb (if opportunity and strategy allows)
   - Priority 4: Move toward target (player/powerup/block)
   - Priority 5: Wander (if strategy allows)

3. **Act** (`_act()`): Executes decision
   - Returns action (MOVE or BOMB)
   - Updates internal state

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
- **Feature-flagged**: Can be disabled via `ENABLE_NPC` environment variable
- **Room-scoped**: NPCs are created per-room (not global)
- **Identical to players**: NPCs follow the same game rules as human players
- **No pause/quit**: NPCs cannot pause or quit games
- **Decision intervals**: NPCs make decisions every 100-300ms (based on difficulty)
- **State management**: NPCs maintain their own internal world state representation

---

## 🔗 Integration

To integrate NPCs into the game server:

1. Import NPC module: `const { NPC } = require('./npc')`
2. Create NPCs when single-player mode is enabled
3. Update NPCs in game loop: `npc.updateWorldState(gameState)`
4. Get actions: `const action = npc.getNextCommand(Date.now())`
5. Process actions same as player actions

See `MERGE_PLAN.md` in project root for detailed integration steps.

---

## 📚 Additional Resources

- **Quick Start**: See `QUICK_START.md` (if exists) for quick testing guide
- **Testing Guide**: See `TESTING.md` (if exists) for detailed testing instructions
- **Development Notes**: See `PHASE3_SUMMARY.md` and `PHASE3_BEHAVIOR_SUMMARY.md` for implementation details
