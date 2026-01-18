# NPC System Architecture and Functionality

This document explains the main components of the NPC system and how they work together to create intelligent virtual opponents.

**Note**: The NPC system has been refactored into a modular structure. Methods that were previously in `NPC.js` are now organized into focused modules (`core/`, `behaviors/`, `config/`, `utils/`), but the concepts and logic remain the same. This document describes the system from a conceptual perspective, showing how these components work together.

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Initialization](#initialization)
3. [World State Management](#world-state-management)
4. [Decision-Making Loop (Sense-Think-Act)](#decision-making-loop-sense-think-act)
5. [Escape Behavior](#escape-behavior)
6. [Target Selection](#target-selection)
7. [Movement Decisions](#movement-decisions)
8. [Bomb Placement](#bomb-placement)
9. [Human-Like Behaviors](#human-like-behaviors)
10. [Oscillation Prevention](#oscillation-prevention)
11. [Collision and Safety Checks](#collision-and-safety-checks)
12. [State Management](#state-management)

---

## Core Architecture

The NPC system follows a **Sense-Think-Act** loop, simulating human decision-making:

1. **SENSE**: Gather information about the current game state
2. **THINK**: Analyze the situation and decide what action to take
3. **ACT**: Execute the chosen action

This loop runs periodically based on the NPC's `decisionInterval` (varies by difficulty: Easy=500ms, Medium=400ms, Hard=300ms).

---

## Initialization

### Constructor (`constructor()`)

When an NPC is created, it initializes:

- **Identity**: `id`, `name`, `difficulty` (easy/medium/hard)
- **Game State**: `position`, `alive`, `score`, `lives`
- **Difficulty Profile**: Loads attributes (speed, aggression, decision interval, etc.)
- **Behavior Strategy**: Determined later based on game state
- **Internal State**: Various flags and tracking variables for decision-making

**Key Attributes:**
- `profile`: Contains difficulty-specific attributes (speed, aggression, mistake rate, etc.)
- `strategy`: Current behavior strategy (aggressive, defensive, balanced, power-up hunter, trapper)
- `currentTarget`: What the NPC is currently pursuing (player, powerup, or block)
- `state`: Current behavioral state (`idle`, `moving`, `escaping`, `attacking`, `collecting`)

### Difficulty Profiles

Difficulty profiles are loaded from `config/DifficultyProfiles.js` during NPC initialization. Each difficulty level modifies core attributes:

| Attribute | Easy | Medium | Hard |
|-----------|------|--------|------|
| Speed | 0.7x | 1.0x | 1.3x |
| Decision Interval | 500ms | 400ms | 300ms |
| Aggression | 0.3 | 0.6 | 0.9 |
| Bomb Placement Rate | 0.2 | 0.5 | 0.8 |
| Mistake Rate | 30% | 15% | 5% |
| Avoidance Success | 85% | 95% | 98% |

---

## World State Management

### `updateWorldState(gameState)`

This method is called by the server whenever the game state changes. It updates the NPC's internal representation of the world:

1. **Position Sync**: Updates NPC position from `gameState.players`
2. **Board Dimensions**: Updates grid size from `gameState.board`
3. **Navigation Grid**: Creates a pathfinding-friendly grid (`0` = walkable, `1` = blocked)
4. **Danger Zones**: Calculates which tiles are in explosion range using `DangerDetector`
5. **Strategy Update**: Re-evaluates behavior strategy based on current game state
6. **Position History**: Tracks recent positions for loop detection

**Critical Updates:**
- **Bombs**: Marked as blocked on navigation grid (NPCs can't walk through them)
- **Explosions**: Marked as blocked during active explosion
- **Danger Zones**: Calculated from all active bombs and their explosion ranges

---

## Decision-Making Loop (Sense-Think-Act)

### `getNextCommand(currentTime)`

This is the main entry point for NPC decision-making. It implements the Sense-Think-Act pattern with human-like behaviors:

#### Flow Control

1. **Timing Check**: Only makes decisions if `decisionInterval` has passed
2. **Plan Execution**: If an active plan exists and is valid, executes it (humans commit to plans)
3. **Observation Period**: Waits 200ms after last observation before making new decisions (human-like pause)
4. **Sense Phase**: Gathers current perception of the world
5. **Think Phase**: Analyzes situation and decides action
6. **Act Phase**: Returns action to execute

#### Human-Like Features

- **Planning**: NPCs create multi-step plans and execute them instead of re-evaluating every frame
- **Momentum**: NPCs continue moving in the same direction (humans don't constantly change direction)
- **Observation**: Brief pause to "observe" the situation before acting

### Sense Phase (Perception Gathering)

Implemented in `core/DecisionLoop.js`. Collects information about the current situation:

- `inDanger`: Is the NPC in an explosion zone?
- `hasNearbyPowerups`: Are there powerups nearby?
- `isStuck`: Is the NPC stuck in a loop?
- `strategy`: Current behavior strategy object

### Think Phase (Decision Logic)

Implemented in `core/DecisionLoop.js`. This is where the NPC decides what action to take. Priority order:

1. **Escape Danger** (HIGHEST PRIORITY)
   - If in danger, immediately escape
   - Overrides all other decisions
   - Uses pathfinding to find safe position

2. **Collect Powerups**
   - Only if strategy prioritizes powerups (`targetPriority.powerups > 0.5`)
   - Only if powerups are nearby

3. **Attack/Place Bomb**
   - Evaluate bomb targets (players within range, adjacent blocks)
   - Apply difficulty-based bomb placement chance
   - Check safety (escape route, not in danger)

4. **Move Toward Target**
   - Use pathfinding to move toward current target
   - Respect post-explosion cooldown (wait 2.5s after explosions)

5. **Opportunistic Bombing**
   - 10% chance to bomb even without clear targets (keeps game active)

6. **Wander**
   - Random exploration if strategy allows it

**Special Logic:**
- **Block Targets**: If adjacent to a block, always try to bomb it (clearing paths)
- **Stuck Check**: Detects loops and switches targets to get unstuck
- **Target Commitment**: NPCs commit to targets for 30 seconds to prevent oscillation

### Act Phase (Action Execution)

Implemented in `core/DecisionLoop.js`. Validates and returns the decision. This could be extended for logging, validation, or additional safety checks.

---

## Escape Behavior

Implemented in `behaviors/EscapeHandler.js`.

### `decideEscape(npc, preferredDirection, allowLessSafe)`

When the NPC is in danger, this function handles escape:

1. **Safety Check**: If already safe and no nearby active bombs, return null (no need to escape)
2. **Escape Target**: If no escape target exists, find the nearest safe position using `DangerDetector.findNearestSafePosition()`
3. **Direction Selection**: 
   - Prefer continuing in `preferredDirection` (prevents oscillation)
   - Otherwise use pathfinding toward escape target
4. **Commitment**: NPCs commit to escape route until safe

**Oscillation Prevention:**
- Tracks `lastEscapeDirection` to continue moving in the same direction
- Stores `escapeTarget` and commits to reaching it
- Only clears escape target when safe or very close

**Special Cases:**
- `allowLessSafe`: If true, allows moving into danger zones if necessary (e.g., after placing a bomb)
- Waits for bombs to fully explode before considering area safe
- Post-explosion cooldown (2.5s) prevents stepping into blast zones

---

## Target Selection

Implemented in `behaviors/TargetingHandler.js`.

### `selectTarget(npc)`

NPCs need goals to pursue. This function selects the best target based on strategy and game state.

#### Target Types

1. **Player Targets** (Highest Priority)
   - Human players prioritized 2x over NPC players
   - Always preferred if available
   - Distance and route availability considered

2. **Powerup Targets** (Secondary Priority)
   - Only considered if no players nearby or very close
   - Based on strategy's `targetPriority.powerups`

3. **Block Targets** (Lowest Priority)
   - Destructible blocks that block paths
   - Useful for clearing paths to players

#### Selection Algorithm

1. **Commitment**: NPCs commit to targets for 30 seconds (prevents constant switching)
2. **Scoring**: Candidates scored by:
   - `priority * (10 / (distance + 1))` - Closer targets score higher
   - Human players get 5x boost
   - NPC players get 2x boost
   - Reachable targets get 20% bonus
3. **Validation**: Only valid, alive targets are considered

#### Target Tracking

- **Player Targets**: Position updated only if player moves significantly (>3 tiles)
- **Intermediate Blocks**: For trappers pursuing far-away players, intermediate blocks serve as waypoints
- **Block Targets**: Re-evaluated if destroyed (switches to next block or player)

---

## Movement Decisions

Implemented in `behaviors/MovementHandler.js`.

### `decideMovement(npc)`

Handles movement toward targets using pathfinding:

1. **Committed Direction**: If committed to a direction, continue moving that way (prevents oscillation)
2. **Target Selection**: Select or validate current target
3. **Pathfinding**: Use `Pathfinder.getNextDirection()` to find path to target
4. **Block Targets**: Find nearest walkable adjacent position (can't pathfind directly to blocks)
5. **Safety Check**: Verify next position is walkable and safe

**Oscillation Prevention:**
- **Direction Commitment**: NPCs commit to directions for 4-8 seconds (longer for far targets)
- **Target Commitment**: Targets held for 30 seconds minimum
- **Trapper Special**: For trappers with far-away players, uses intermediate blocks as waypoints

**Pathfinding Failures:**
- If pathfinding fails, finds blocking blocks and targets them instead
- For trappers, finds intermediate blocks in the direction toward the player
- Falls back to safe exploration if no targets available

### `findBlockingBlock(npc, target)`

When a player target is unreachable, finds blocks that block the path. Implemented in `behaviors/TargetingHandler.js`:
- Checks blocks in direct path to target (within 2 tiles)
- Prioritizes blocks in target direction
- Used to clear paths to players

### `findIntermediateBlockTowardPlayer(npc, player)`

For trappers pursuing far-away players, finds intermediate blocks as waypoints. Implemented in `behaviors/TargetingHandler.js`:
- Searches 2-5 tiles away in player direction
- Prioritizes blocks closer to the player
- Prevents oscillation when player is very far away

### `decideSafeExploration(npc)`

When no specific target, explores safely. Implemented in `behaviors/MovementHandler.js`:
- Randomly tries safe directions
- Avoids danger zones and blocked paths
- Used when no targets available

---

## Bomb Placement

Implemented in `behaviors/BombingHandler.js`.

### `decidePlaceBomb(npc, hasBlockTarget, hasPlayerTarget)`

Decides when to place bombs with multiple safety checks:

#### Priority

1. **Block Targets** (Highest Priority)
   - If adjacent to a block, always try to bomb it
   - Minimal cooldown (< 1000ms remaining) when bombing blocks
   - Bypasses other safety checks (except immediate explosion danger)

2. **Player Targets**
   - Check if players within attack range
   - Apply difficulty-based bomb placement chance
   - Full safety checks required

#### Safety Checks

1. **Not in Danger**: Never place bomb if currently in explosion zone
2. **No Immediate Explosion**: Don't place if another bomb will explode at this position in <1 second
3. **Bomb Cooldown**: Wait 2.5 seconds between bomb placements
4. **Escape Route**: Verify at least one adjacent position is safe and walkable
5. **Mistake Simulation**: Based on difficulty, NPCs may "mistakenly" skip good bomb opportunities

#### Risk Assessment

- **Easy**: Very cautious, requires clear escape route
- **Medium**: Sometimes takes risks when bombing blocks
- **Hard**: Takes calculated risks to trap players

### `evaluateBombTargets(npc)`

Evaluates what the NPC should bomb. Implemented in `behaviors/BombingHandler.js`:

- **Player Targets**: Players within attack range (default 2 tiles)
- **Block Targets**: Destructible blocks adjacent to NPC (distance = 1)

Returns `{ hasPlayerTarget: boolean, hasBlockTarget: boolean }`.

### `hasEscapeRoute(npc)`

Checks if NPC can escape after placing bomb. Implemented in `behaviors/BombingHandler.js`:
- Verifies at least one adjacent position is safe and walkable
- Prevents suicide bomb placements

---

## Human-Like Behaviors

Several features make NPCs behave more like human players:

### Planning System

- **Multi-Step Plans**: NPCs create plans with multiple steps (`currentPlan`)
- **Plan Execution**: Execute plans instead of re-evaluating every frame
- **Plan Validity**: Plans checked for validity (target still exists, path still clear)
- **Plan Expiry**: Plans expire after 5 seconds (humans adapt)

### Momentum

- **Movement Momentum**: NPCs continue moving in the same direction (`movementMomentum`)
- **Direction Persistence**: Last movement direction tracked (`lastMovementDirection`)
- **Momentum Bonus**: Extra plan steps if already moving in that direction

### Observation Pauses

- **Observation Period**: 200ms pause after last observation before making new decisions
- **Human-Like Timing**: Mimics human reaction time

### Commitment

- **Direction Commitment**: Committed to directions for 4-8 seconds (`committedDirection`, `committedDirectionUntil`)
- **Target Commitment**: Committed to targets for 30 seconds (`lastTargetSwitch`)
- **Escape Commitment**: Committed to escape routes until safe

---

## Oscillation Prevention

NPCs can get stuck in loops (e.g., moving back and forth). Multiple mechanisms prevent this:

### Position Tracking

- **Position History**: Tracks last 10 positions (`lastPositions`)
- **Loop Detection**: Detects if same position visited 5+ times or only 3 unique positions in recent history
- **Stuck Counter**: Increments when stuck detected

### Direction Commitment

- **Committed Direction**: NPCs commit to a direction for 4-8 seconds
- **Preferred Direction**: Escape logic prefers continuing in last escape direction
- **Commitment Duration**: Longer for far-away targets (trappers: 8s for targets >5 tiles)

### Target Commitment

- **Minimum Switch Time**: 30 seconds between target switches
- **Position Tolerance**: Player target positions only updated if player moves >3 tiles
- **Intermediate Blocks**: For far targets, uses intermediate blocks to prevent constant recalculation

### Stuck Handling

- **Stuck Detection**: `_isStuck()` detects loops
- **Unstuck Logic**: `_getUnstuck()` clears position history, switches targets if needed
- **Safe Waiting**: Doesn't mark as stuck if intentionally waiting (post-explosion cooldown, nearby bombs)

---

## Collision and Safety Checks

### `isWalkable(npc, pos)`

Checks if a position is walkable. Implemented in `utils/PositionHelpers.js`:

1. **Bounds Check**: Position must be within grid bounds
2. **Bomb Check**: Can't walk through active bombs
3. **Player Check**: Can't walk through other alive players/NPCs (dead players don't block)
4. **Board Check**: Position must be walkable tile (0) on board
5. **Off-Board Positions**: Excludes positions with negative coordinates (-1, -1 for dead entities)

**Key Logic:**
- Only `alive === true` players block movement
- Dead players have positions set to (-1, -1) and don't block
- Navigation grid caches walkability for efficiency

### `isInDanger(npc)`

Checks if current position is in a danger zone. Implemented in `behaviors/EscapeHandler.js`:
- Uses `dangerZones` Set calculated by `DangerDetector`
- Danger zones updated whenever bombs are placed/exploded

### `isValidPosition(pos, maxRows, maxCols)`

Checks if position is within grid bounds (0 to maxRows-1, 0 to maxCols-1). Implemented in `utils/PositionHelpers.js`.

---

## State Management

### NPC State (`this.state`)

Current behavioral state:
- `idle`: No current action
- `moving`: Moving toward a target
- `escaping`: Escaping from danger
- `attacking`: Placing bombs or pursuing enemies
- `collecting`: Moving toward a powerup

### Target State (`this.currentTarget`)

Current goal:
- `{ x, y, type: 'player', playerId }`: Pursuing a player
- `{ x, y, type: 'powerup' }`: Collecting a powerup
- `{ x, y, type: 'block' }`: Destroying a block
- `{ x, y, type: 'block', intermediateForPlayer }`: Intermediate block toward player

### Tracking Variables

- `lastActionTime`: Timestamp of last action (for decision interval)
- `lastBombTime`: Timestamp of last bomb placement (for cooldown)
- `lastExplosionTime`: Timestamp of last explosion (for post-explosion cooldown)
- `lastTargetSwitch`: Timestamp of last target switch (for commitment)
- `lastObservationTime`: Timestamp of last observation (for observation pauses)

### Reset

`reset()` method (implemented in `core/NPCState.js`) clears all state for a new game:
- Resets position, alive status, score, lives
- Clears targets, paths, danger zones
- Resets all tracking variables

---

## Integration Points

### Dependencies

- **DangerDetector**: Calculates danger zones and finds safe positions
- **Pathfinder**: Finds paths between positions using BFS
- **ItemEvaluator**: Evaluates powerups for collection priority
- **BehaviorStrategies**: Provides behavior strategy based on configuration

### Server Integration

- **`updateWorldState()`**: Called by server on game state changes
- **`getNextCommand()`**: Called by game loop to get next action
- **Actions Returned**: `{ type: 'MOVE', direction: 'UP'/'DOWN'/'LEFT'/'RIGHT' }` or `{ type: 'BOMB' }`

---

## Summary

The NPC system creates intelligent opponents through:

1. **Sense-Think-Act Loop**: Structured decision-making with periodic updates
2. **Pathfinding**: Uses BFS to navigate around obstacles
3. **Danger Avoidance**: Calculates and avoids explosion zones
4. **Strategy-Based Behavior**: Different personalities (aggressive, defensive, trapper, etc.)
5. **Human-Like Features**: Planning, momentum, observation pauses, mistakes
6. **Oscillation Prevention**: Multiple mechanisms to prevent loops and indecision
7. **Difficulty Scaling**: Attributes adjust by difficulty level
8. **Safety Checks**: Prevents suicide bomb placements and dangerous moves

The result is NPCs that feel human-like while maintaining fair difficulty levels and avoiding game-breaking behaviors like infinite loops or getting stuck.
