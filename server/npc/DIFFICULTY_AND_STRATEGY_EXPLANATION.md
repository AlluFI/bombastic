# Difficulty Profiles and Behavior Strategies in NPC.js

This document explains how difficulty profiles (loaded via `_loadDifficultyProfile()`) and behavior strategies work together to control NPC behavior throughout the decision-making system.

## Overview

NPCs in this system use **two complementary systems** to determine their behavior:

1. **Difficulty Profiles** (`_loadDifficultyProfile()`): Control **execution quality** (HOW WELL the NPC performs)
   - Speed, decision-making frequency
   - Mistake rates and success rates
   - Base multipliers for actions

2. **Behavior Strategies** (`BehaviorStrategies.getStrategy()`): Control **behavioral focus** (WHAT the NPC prioritizes)
   - Target priorities (players vs powerups vs blocks)
   - Bomb placement tendencies
   - Chase distances and risk tolerance

**Key Principle**: The final behavior is a **combination** of both systems. For example, bomb placement chance = `strategy.bombPlacementChance × profile.bombPlacementRate`.

---

## 1. Difficulty Profiles (`_loadDifficultyProfile()`)

### Location
Defined directly in `NPC.js` at lines 83-114. The method returns a profile object that is stored in `this.profile` when the NPC is constructed.

### Profile Values

Each difficulty level (easy, medium, hard) defines these values:

| Value | Description | Usage |
|-------|-------------|-------|
| `decisionInterval` | Milliseconds between decision cycles | **Used at line 71** - Controls how often NPC makes decisions |
| `bombPlacementRate` | Base bomb placement rate multiplier (0.2-0.8) | **Used at line 495** - Multiplied with strategy bomb chance |
| `mistakeRate` | Chance of making mistakes (0.3-0.05) | **Used at line 1052** - Converts to `bombPlacementSuccess` |
| `attackRange` | Maximum distance to consider players as bomb targets (2-4 tiles) | **Used at line 1105** - Determines combat range |

### Profile Loading Process

```83:114:server/npc/NPC.js
  _loadDifficultyProfile() {
    const baseProfiles = {
      easy: {
        decisionInterval: 500,   // Used at line 71 - Controls decision-making frequency
        bombPlacementRate: 0.2,  // Used at line 495 - Multiplied with strategy bomb placement chance
        mistakeRate: 0.3,        // Used at line 1052 - Converts to bombPlacementSuccess (1 - mistakeRate)
        attackRange: 2,          // Used at line 1105 - Maximum distance to consider players as bomb targets
       },
      medium: {
        decisionInterval: 400,   // Used at line 71 - Controls decision-making frequency
        bombPlacementRate: 0.5,  // Used at line 495 - Multiplied with strategy bomb placement chance
        mistakeRate: 0.15,       // Used at line 1052 - Converts to bombPlacementSuccess (1 - mistakeRate)
        attackRange: 3,          // Used at line 1105 - Maximum distance to consider players as bomb targets
      },
      hard: {
        decisionInterval: 300,   // Used at line 71 - Controls decision-making frequency
        bombPlacementRate: 0.8,  // Used at line 495 - Multiplied with strategy bomb placement chance
        mistakeRate: 0.05,       // Used at line 1052 - Converts to bombPlacementSuccess (1 - mistakeRate)
        attackRange: 4,          // Used at line 1105 - Maximum distance to consider players as bomb targets
      },
    };

    const base = baseProfiles[this.difficulty] || baseProfiles.medium;
    
    // Calculate bombPlacementSuccess from mistakeRate (1 - mistakeRate)
    // This represents how often NPCs successfully execute bomb placement decisions
    const bombPlacementSuccess = 1 - base.mistakeRate;
    
    // Apply custom config overrides if provided
    return {
      ...base,
      bombPlacementSuccess,  // Add bombPlacementSuccess to profile
      ...this.config,
    };
  }
```

**Important Notes:**
- The profile is loaded once during NPC construction and stored in `this.profile`
- Custom config values can override base profile values (line 112: `...this.config`)
- `bombPlacementSuccess` is calculated from `mistakeRate` (line 106)
- Only the three values listed above are currently defined and used in the profile

---

## 2. How Profile Values Are Used in NPC.js

### 2.1 Decision Interval (Line 71)

**Usage**: Controls how frequently the NPC makes decisions.

```71:71:server/npc/NPC.js
    this.decisionInterval = this.profile.decisionInterval;
```

**Applied at**: Lines 224-226 in `getNextCommand()`

```223:227:server/npc/NPC.js
  getNextCommand(currentTime) {
    // Check if enough time has passed since last decision
    if (currentTime - this.lastActionTime < this.decisionInterval) {
      return null;
    }
```

**Effect**:
- **Easy**: Makes decisions every 500ms (slower, more human-like)
- **Medium**: Makes decisions every 400ms (normal speed)
- **Hard**: Makes decisions every 300ms (faster, but still human-like)

**Impact**: This directly affects how quickly NPCs react to changing game states. Easy NPCs appear more sluggish, while hard NPCs react more quickly.

---

### 2.2 Bomb Placement Rate (Line 495)

**Usage**: Combined with strategy bomb placement chance to determine final bomb placement probability.

```494:503:server/npc/NPC.js
    // Otherwise, check normal bomb placement chance for attacking players
    let bombChance = strategy.bombPlacementChance * this.profile.bombPlacementRate;
    if (hasPlayerTarget) {
      bombChance = Math.min(1.0, bombChance * 1.5); // Boost chance when players nearby
    }
    
    if (Math.random() < bombChance) {
      const bombAction = this._decidePlaceBomb(hasBlockTarget, hasPlayerTarget);
      if (bombAction) return bombAction;
    }
```

**Formula**: 
```
Final Bomb Chance = strategy.bombPlacementChance × profile.bombPlacementRate
```

**Example Calculations**:

| Strategy | Strategy Chance | Easy (0.2) | Medium (0.5) | Hard (0.8) |
|----------|----------------|------------|--------------|------------|
| Aggressive | 0.7 | 0.14 (14%) | 0.35 (35%) | 0.56 (56%) |
| Balanced | 0.8 | 0.16 (16%) | 0.40 (40%) | 0.64 (64%) |
| Defensive | 0.2 | 0.04 (4%) | 0.10 (10%) | 0.16 (16%) |
| Power-up Hunter | 0.6 | 0.12 (12%) | 0.30 (30%) | 0.48 (48%) |
| Trapper | 0.8 | 0.16 (16%) | 0.40 (40%) | 0.64 (64%) |

**Impact**: 
- Easy NPCs rarely place bombs, even with aggressive strategies
- Hard NPCs place bombs frequently, even with defensive strategies
- The difficulty profile acts as a **multiplier** on the strategy's base tendency

---

### 2.3 Bomb Placement Success (Line 1052)

**Usage**: Determines if NPC actually executes a bomb placement decision (simulates mistakes).

```1052:1060:server/npc/NPC.js
    let successThreshold = this.profile.bombPlacementSuccess || (1 - (this.profile.mistakeRate || 0.15));
    if (!hasPlayerTarget && hasBlockTarget) {
      // Increase success rate when bombing blocks (reduce mistakes)
      successThreshold = Math.min(1.0, successThreshold + 0.2);
    }
    const successRoll = Math.random();
    if (successRoll > successThreshold) {
      return null;
    }
```

**Calculation**: `bombPlacementSuccess = 1 - mistakeRate`

**Threshold Values**:
- **Easy**: 70% success (30% mistakes)
- **Medium**: 85% success (15% mistakes)  
- **Hard**: 95% success (5% mistakes)

**Special Case**: When bombing blocks (not players), success threshold is increased by 0.2 (20%), making NPCs less likely to "miss" when clearing paths.

**Impact**: 
- Easy NPCs sometimes decide to place a bomb but then "change their mind" (simulating human hesitation)
- Hard NPCs almost always execute their bomb placement decisions
- This creates a more human-like, imperfect AI behavior

---

### 2.4 Attack Range (Line 1105)

**Usage**: Determines how close NPCs need to be to consider players as valid bomb targets.

```1096:1140:server/npc/NPC.js
  _evaluateBombTargets() {
    let hasPlayerTarget = false;
    let hasBlockTarget = false;

    if (!this.gameState || !this.gameState.board) {
      return { hasPlayerTarget: false, hasBlockTarget: false };
    }

    const board = this.gameState.board;
    const attackRange = this.profile.attackRange || 2;

    // Check for player targets within attack range (Manhattan distance)
    // OR if we're currently targeting a player (even if beyond immediate attack range)
    if (this.currentTarget?.type === 'player') {
      // We have a player target - check if they're still valid and within reasonable range
      const targetPlayer = this.gameState.players?.find(p => p.id === this.currentTarget.playerId);
      if (targetPlayer && targetPlayer.alive) {
        const dist = Pathfinder.manhattanDistance(this.position, { x: targetPlayer.x, y: targetPlayer.y });
        // If player is within attack range, we can bomb them
        // If player is further away, we're still targeting them (moving towards them)
        if (dist <= attackRange) {
          hasPlayerTarget = true;
        } else {
          // Player is beyond attack range but we're targeting them - still consider it a player target
          // This helps NPCs know they're pursuing a player even if not in immediate bombing range
          hasPlayerTarget = true;
        }
      }
    }
    
    // Also check for any other players within attack range (for opportunistic bombing)
    if (!hasPlayerTarget && this.gameState.players && this.gameState.players.length > 1) {
      for (const p of this.gameState.players) {
        if (p.id !== this.id || p.alive === false) continue;
        const dist = Pathfinder.manhattanDistance(this.position, { x: p.x, y: p.y });
        if (dist > 0 && dist <= attackRange) {
          hasPlayerTarget = true;
          break;
        }
      }
    }
```

**Range Values**:
- **Easy**: 2 tiles (close combat only)
- **Medium**: 3 tiles (moderate range)
- **Hard**: 4 tiles (longer range)

**Impact**: Controls the effective combat range of NPCs. Easy NPCs need to be very close to attack, while hard NPCs can attack from further away. This affects how aggressively NPCs engage with players and how close they need to get before placing bombs.

---

## 3. Behavior Strategies Interaction

### 3.1 Strategy Selection

Strategies are loaded via `BehaviorStrategies.getStrategy()` which is called:
- During `updateWorldState()` (line 171)
- During `_sense()` if no strategy exists (line 360)

```170:171:server/npc/NPC.js
    // Update behavior strategy based on current game state
    this.strategy = BehaviorStrategies.getStrategy(this, gameState);
```

### 3.2 Strategy Values Used

Strategies provide these values that are used throughout NPC.js:

| Strategy Value | Used At | Description |
|----------------|---------|-------------|
| `targetPriority.players` | Lines 1860, 1879, 1897 | Priority for targeting players |
| `targetPriority.powerups` | Lines 468, 912, 924, 1915, 1930 | Priority for collecting powerups |
| `targetPriority.blocks` | Lines 1941, 1953 | Priority for targeting destructible blocks |
| `bombPlacementChance` | Line 495 | Base bomb placement tendency |
| `wanderChance` | Line 525 | Chance to wander randomly |
| `chaseDistance` | Lines 1313, 1800 | Distance to chase players |
| `name` | Lines 1290, 1321, 1791 | Strategy name (for special logic like trapper) |

---

## 4. Combined Behavior Examples

### Example 1: Easy + Aggressive Strategy

**Profile Values**:
- `decisionInterval`: 500ms
- `bombPlacementRate`: 0.2
- `bombPlacementSuccess`: 0.7 (30% mistakes)

**Strategy Values**:
- `targetPriority.players`: 0.9
- `bombPlacementChance`: 0.7
- `chaseDistance`: 6

**Resulting Behavior**:
- Wants to attack players (0.9 priority) ✅
- Wants to chase from 6 tiles away ✅
- **BUT**: Only places bombs 14% of the time (0.7 × 0.2 = 0.14) ❌
- **AND**: Fails to execute 30% of bomb decisions ❌
- **AND**: Reacts slowly (decisions every 500ms) ⏱️

**Outcome**: An NPC that **wants** to be aggressive but **executes poorly**. This creates interesting gameplay where the NPC has the right intentions but makes mistakes.

---

### Example 2: Hard + Defensive Strategy

**Profile Values**:
- `decisionInterval`: 300ms
- `bombPlacementRate`: 0.8
- `bombPlacementSuccess`: 0.95 (5% mistakes)

**Strategy Values**:
- `targetPriority.players`: 0.2
- `bombPlacementChance`: 0.2
- `chaseDistance`: 2
- `wanderChance`: 0.3

**Resulting Behavior**:
- Low priority on players (0.2) ✅
- Rarely chases (only 2 tiles) ✅
- **BUT**: Still places bombs 16% of the time (0.2 × 0.8 = 0.16) - higher than pure strategy suggests ⚠️
- **AND**: Executes bomb decisions 95% of the time ✅
- **AND**: Reacts very quickly (300ms) ⚡

**Outcome**: An NPC that **prefers** defensive play but **executes perfectly** when it does act. The high difficulty profile partially overrides the defensive strategy's low bomb tendency.

---

### Example 3: Medium + Trapper Strategy

**Profile Values**:
- `decisionInterval`: 400ms
- `bombPlacementRate`: 0.5
- `bombPlacementSuccess`: 0.85 (15% mistakes)

**Strategy Values**:
- `targetPriority.blocks`: 0.8
- `bombPlacementChance`: 0.8
- `chaseDistance`: 3

**Resulting Behavior**:
- High priority on blocks (0.8) ✅
- Places bombs 40% of the time (0.8 × 0.5 = 0.40) ✅
- Has special logic for far-away players (finds intermediate block waypoints) ✅
- Executes 85% of bomb decisions ✅

**Outcome**: A balanced trapper that executes well but not perfectly, with moderate reaction speed.

---

## 5. Key Interaction Points

### 5.1 Bomb Placement Decision Flow

```
1. Strategy provides: bombPlacementChance (e.g., 0.7)
2. Profile provides: bombPlacementRate (e.g., 0.2)
3. Calculate: finalChance = 0.7 × 0.2 = 0.14
4. Random roll: Math.random() < 0.14?
5. If yes: Decision made to place bomb
6. Profile provides: bombPlacementSuccess (e.g., 0.7)
7. Random roll: Math.random() < 0.7?
8. If yes: Bomb actually placed ✅
9. If no: Decision "cancelled" (simulated mistake) ❌
```

### 5.2 Target Selection Priority

Target selection uses **strategy priorities only**:

```1858:1920:server/npc/NPC.js
    // PRIORITY 1: Find player targets - ALWAYS prioritize players if they exist
    // NPCs should always have a target if players are visible (anywhere on the board)
    // IMPORTANT: Prioritize human players over NPCs
    if (this.strategy.targetPriority.players > 0.3 && this.gameState.players) {
      // ... player target logic ...
    }

    // PRIORITY 2: Find powerup targets (secondary to players)
    // Only consider powerups if no players are available, or if very close
    if (this.strategy.targetPriority.powerups > 0.3 && this.gameState.powerups) {
      // ... powerup target logic ...
    }
```

**Note**: Strategy priorities control target selection. The difficulty profile does not define priority values for target selection.

---

## 6. Summary: What Controls What?

### Difficulty Profile Controls:
✅ **Execution Quality**
- How fast NPCs make decisions (`decisionInterval`)
- How often they execute decisions (`bombPlacementSuccess`)
- Base multipliers for actions (`bombPlacementRate`)

### Behavior Strategy Controls:
✅ **Behavioral Focus**
- What NPCs prioritize (`targetPriority.*`)
- Tendency to place bombs (`bombPlacementChance`)
- How far they chase (`chaseDistance`)
- How much they wander (`wanderChance`)

### Combined Effect:
```
Final Behavior = Strategy Intent × Profile Execution Quality
```

**Example**: 
- Strategy says "I want to place bombs 70% of the time"
- Profile says "You can only execute 20% of bomb opportunities"
- **Result**: NPC places bombs ~14% of the time (0.7 × 0.2), but still **wants** to be aggressive

---

## 7. Design Philosophy

This dual-system approach allows for:

1. **Intent vs. Execution**: NPCs can have aggressive **intentions** but poor **execution** (Easy + Aggressive)
2. **Execution vs. Intent**: NPCs can have defensive **intentions** but perfect **execution** (Hard + Defensive)
3. **15 Unique Combinations**: 3 difficulties × 5 strategies = 15 distinct NPC personalities
4. **Human-like Imperfection**: Mistake rates create more natural, less predictable AI

---

## 8. Math Functions Used Throughout NPC.js

This section explains all mathematical functions and calculations used in NPC decision-making to help understand how probabilities, constraints, and distance calculations work.

### 8.1 Probability Functions (`Math.random()`)

**Purpose**: Adds randomness and unpredictability to NPC behavior, making them feel more human-like.

#### Bomb Placement Probability (Line 503)

```498:503:server/npc/NPC.js
    let bombChance = strategy.bombPlacementChance * this.profile.bombPlacementRate;
    if (hasPlayerTarget) {
      bombChance = Math.min(1.0, bombChance * 1.5); // Boost chance when players nearby
    }
    
    if (Math.random() < bombChance) {
```

**Formula**: `Math.random() < bombChance`
- `Math.random()` returns a value between 0.0 and 1.0
- If the random value is less than `bombChance`, the bomb placement decision is made
- **Example**: If `bombChance = 0.4`, there's a 40% chance of placing a bomb

**Why**: Prevents deterministic behavior - NPCs don't always place bombs when they have the chance, creating more natural gameplay.

---

#### Bomb Placement Success (Line 1060)

```1055:1063:server/npc/NPC.js
    let successThreshold = this.profile.bombPlacementSuccess || (1 - (this.profile.mistakeRate || 0.15));
    if (!hasPlayerTarget && hasBlockTarget) {
      // Increase success rate when bombing blocks (reduce mistakes)
      successThreshold = Math.min(1.0, successThreshold + 0.2);
    }
    const successRoll = Math.random();
    if (successRoll > successThreshold) {
      return null;
    }
```

**Formula**: `successRoll > successThreshold` → cancel bomb placement
- Even after deciding to place a bomb, NPCs may "change their mind" (simulating mistakes)
- If the random roll exceeds the threshold, the bomb placement is cancelled
- **Easy NPCs** (threshold 0.7): 30% chance of cancelling → simulates hesitation
- **Hard NPCs** (threshold 0.95): 5% chance of cancelling → almost always executes

**Why**: Simulates human imperfection - sometimes NPCs hesitate or second-guess themselves, especially at easier difficulties.

---

#### Opportunistic Bombing (Line 522)

```520:525:server/npc/NPC.js
    // Priority 5: Opportunistic bombing (10% chance to bomb even without clear targets)
    // This helps NPCs be more active, especially in early game when paths are blocked
    if (Math.random() < 0.1) {
      const bombAction = this._decidePlaceBomb(hasBlockTarget, hasPlayerTarget);
      if (bombAction) return bombAction;
    }
```

**Formula**: `Math.random() < 0.1`
- 10% base chance to bomb even when there's no clear strategic reason
- Helps NPCs be more active and prevent getting stuck

**Why**: Prevents NPCs from being too passive - occasional random bombing creates dynamic gameplay.

---

#### Wander Chance (Line 528)

```527:530:server/npc/NPC.js
    // Priority 6: Wander (if strategy allows)
    if (Math.random() < strategy.wanderChance) {
      return this._decideWander();
    }
```

**Formula**: `Math.random() < strategy.wanderChance`
- Strategy-specific wander probability:
  - **Defensive**: 0.3 (30% chance) - often wanders to avoid conflict
  - **Aggressive**: 0.05 (5% chance) - rarely wanders, stays focused
  - **Balanced**: 0.15 (15% chance) - occasional wandering

**Why**: Allows strategies to control how much NPCs explore vs. pursue targets.

---

#### Risk-Taking for Escape Routes (Lines 1071, 1073, 1080)

```1068:1084:server/npc/NPC.js
    if (!this._hasEscapeRoute()) {
      // When bombing blocks (not players), be more willing to take risks
      if (!hasPlayerTarget && hasBlockTarget) {
        if (this.difficulty === 'hard' && Math.random() < 0.5) {
          // Hard NPCs take risks to clear blocks
        } else if (this.difficulty === 'medium' && Math.random() < 0.3) {
          // Medium NPCs sometimes take risks
        } else {
          return null;
        }
      } else {
        // For player targets, be more cautious
        if (this.difficulty !== 'hard' || Math.random() > 0.3) {
          return null;
        }
      }
    }
```

**Formulas**:
- Hard + Block: `Math.random() < 0.5` → 50% chance to take risk
- Medium + Block: `Math.random() < 0.3` → 30% chance to take risk
- Hard + Player: `Math.random() > 0.3` → 70% chance to take risk (inverted logic)

**Why**: Difficulty-based risk tolerance - hard NPCs are more willing to trap themselves to clear paths or attack players.

---

#### Random Direction Shuffling (Lines 745, 1581, 1737, 2227)

Used in multiple functions to randomize direction checks:

```745:745:server/npc/NPC.js
      shuffled = directions.sort(() => Math.random() - 0.5);
```

**Formula**: `Math.random() - 0.5`
- Returns values between -0.5 and +0.5
- Used in `sort()` to randomly shuffle array order
- **Why**: Prevents predictable direction priority - NPCs don't always try directions in the same order

**Used in**:
- `_getRandomSafeDirection()` (line 745) - Escape route selection
- `_decideSafeExploration()` (line 1581) - Random exploration
- `_getUnstuck()` (line 1737) - Breaking out of loops
- `_decideWander()` (line 2227) - Wandering behavior

---

### 8.2 Constraint Functions (`Math.min()`, `Math.max()`)

**Purpose**: Clamp values within safe ranges and ensure bounds are respected.

#### Capping Bomb Chance (Line 500)

```499:501:server/npc/NPC.js
    if (hasPlayerTarget) {
      bombChance = Math.min(1.0, bombChance * 1.5); // Boost chance when players nearby
    }
```

**Formula**: `Math.min(1.0, bombChance * 1.5)`
- Multiplies bomb chance by 1.5 when players are nearby (50% boost)
- Caps result at 1.0 (100% maximum probability)
- **Example**: If `bombChance = 0.8`, after boost: `0.8 * 1.5 = 1.2` → clamped to `1.0`

**Why**: Prevents probabilities from exceeding 100%, while giving bonus for good opportunities.

---

#### Capping Success Threshold (Line 1058)

```1056:1059:server/npc/NPC.js
    if (!hasPlayerTarget && hasBlockTarget) {
      // Increase success rate when bombing blocks (reduce mistakes)
      successThreshold = Math.min(1.0, successThreshold + 0.2);
    }
```

**Formula**: `Math.min(1.0, successThreshold + 0.2)`
- Adds 20% to success threshold when bombing blocks (reduces mistakes)
- Caps at 1.0 (100% success)
- **Example**: Easy NPC (0.7 threshold) → `0.7 + 0.2 = 0.9` (90% success when bombing blocks)

**Why**: NPCs are better at executing "simple" tasks like clearing blocks vs. complex player attacks.

---

#### Capping Plan Steps (Lines 2210, 2215, 2218)

```2208:2218:server/npc/NPC.js
    // Momentum bonus - if already moving in this direction, continue longer
    if (this.movementMomentum > 0 && decision.direction === this.lastMovementDirection) {
      steps += Math.min(2, this.movementMomentum); // Up to 2 extra steps for momentum
    }
    
    // Reduce steps if in danger (humans are more cautious)
    if (perception.inDanger) {
      steps = Math.min(steps, 1); // Only 1 step when in danger
    }
    
    return Math.min(steps, 5); // Cap at 5 steps (humans don't plan too far ahead)
```

**Formulas**:
- `Math.min(2, this.movementMomentum)` - Caps momentum bonus at 2 extra steps
- `Math.min(steps, 1)` - Reduces planning when in danger (max 1 step)
- `Math.min(steps, 5)` - Caps total plan at 5 steps maximum

**Why**: Prevents NPCs from planning too far ahead (unrealistic) and adapts planning to danger level.

---

#### Bounding Search Areas (Lines 1446, 1463-1464, 1536-1537, 1946-1947)

Multiple uses of `Math.min()` and `Math.max()` to ensure search areas stay within grid bounds:

```1445:1448:server/npc/NPC.js
    // Check blocks in the direction toward target (within 2 tiles)
    const checkDistance = Math.min(2, Math.max(Math.abs(dx), Math.abs(dy)));
    const stepX = dx !== 0 ? dx / Math.abs(dx) : 0;
    const stepY = dy !== 0 ? dy / Math.abs(dy) : 0;
```

**Formula**: `Math.min(2, Math.max(Math.abs(dx), Math.abs(dy)))`
- `Math.abs(dx)`, `Math.abs(dy)` - Get absolute distance components
- `Math.max(...)` - Take the larger component (Manhattan distance approximation)
- `Math.min(2, ...)` - Cap at 2 tiles maximum search distance

**Boundary Checking** (Lines 1463-1464):
```1463:1464:server/npc/NPC.js
      for (let x = Math.max(0, this.position.x - 2); x <= Math.min(this.maxRows - 1, this.position.x + 2); x++) {
        for (let y = Math.max(0, this.position.y - 2); y <= Math.min(this.maxCols - 1, this.position.y + 2); y++) {
```

**Formulas**:
- `Math.max(0, this.position.x - 2)` - Ensure x doesn't go below 0 (grid boundary)
- `Math.min(this.maxRows - 1, this.position.x + 2)` - Ensure x doesn't exceed grid size

**Why**: Prevents array index out-of-bounds errors when searching nearby blocks or targets.

---

### 8.3 Distance Functions (`Math.abs()`)

**Purpose**: Calculate absolute differences for position comparisons and direction calculations.

#### Position Matching (Lines 1322, 1799, 1838, 2042-2043)

```1320:1323:server/npc/NPC.js
              const player = this.gameState.players.find(p => 
                p.id === target.playerId || 
                (Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1)
              );
```

**Formula**: `Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1`
- Checks if player position is within 1 tile of stored target position
- Uses absolute value to ignore direction (distance is always positive)
- **Why**: Allows matching players by approximate position when exact position changes (players move)

---

#### Direction Priority Selection (Line 1391)

```1386:1394:server/npc/NPC.js
      // Coordinate system: x = row (vertical), y = col (horizontal)
      const dx = moveTarget.x - this.position.x;
      const dy = moveTarget.y - this.position.y;
      
      // Choose direction based on largest distance component
      let direction = null;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Row difference is larger - move vertically
        direction = dx > 0 ? 'DOWN' : 'UP';  // Increase row = DOWN, decrease row = UP
```

**Formula**: `Math.abs(dx) > Math.abs(dy)`
- Compares absolute distances to determine which direction to prioritize
- If horizontal distance is larger, move horizontally first
- If vertical distance is larger, move vertically first
- **Why**: Moves NPCs toward target using the largest distance component first (more efficient pathfinding)

---

#### Direction Step Calculation (Lines 1447-1448, 1489-1490)

```1445:1448:server/npc/NPC.js
    // Check blocks in the direction toward target (within 2 tiles)
    const checkDistance = Math.min(2, Math.max(Math.abs(dx), Math.abs(dy)));
    const stepX = dx !== 0 ? dx / Math.abs(dx) : 0;
    const stepY = dy !== 0 ? dy / Math.abs(dy) : 0;
```

**Formulas**:
- `dx / Math.abs(dx)` - Returns -1, 0, or +1 (direction sign)
  - If `dx = 5` → `5 / 5 = 1` (step right)
  - If `dx = -3` → `-3 / 3 = -1` (step left)
  - If `dx = 0` → returns 0 (no movement in this axis)
- Used to iterate toward target one step at a time

**Why**: Converts distance into directional step units for iterating through grid positions.

---

### 8.4 Score Calculations (Multiplication and Division)

#### Target Scoring Formula (Line 1976)

```1975:1976:server/npc/NPC.js
    candidates.forEach(candidate => {
      let score = candidate.priority * (10 / (candidate.distance + 1));
```

**Formula**: `priority * (10 / (distance + 1))`
- Base score = strategy priority × distance factor
- Distance factor: `10 / (distance + 1)`
  - Distance 0: `10 / 1 = 10.0` (very close - highest bonus)
  - Distance 1: `10 / 2 = 5.0`
  - Distance 2: `10 / 3 = 3.33`
  - Distance 5: `10 / 6 = 1.67`
  - Distance 10: `10 / 11 = 0.91`

**Why**: Prefers closer targets exponentially - NPCs prioritize nearby targets but still consider far targets if they're high priority.

---

#### Priority Multipliers (Lines 1983, 1985, 1990, 1997, 1999)

```1978:2000:server/npc/NPC.js
      // STRATEGIC PRIORITY BOOSTS:
      // Players are ALWAYS highest priority - NPCs should hunt players
      if (candidate.type === 'player') {
        // Human players get even higher priority than NPCs
        if (candidate.isHuman === true) {
          score *= 5.0; // Very strongly prioritize human players
        } else {
          score *= 2.0; // Lower priority for NPC players (only if no humans available)
        }
      }
      // Powerups are secondary priority
      else if (candidate.type === 'powerup') {
        score *= 1.5; // Moderate boost for powerups
      }
      // Blocks only if they're blocking path to players or no players available
      // Don't boost blocks - they're just obstacles to clear
      
      // Route availability bonus: prefer targets we can actually reach
      if (candidate.hasRoute) {
        score *= 1.2; // 20% bonus for reachable targets
      } else {
        score *= 0.5; // Penalty for unreachable targets (but don't exclude them completely)
      }
```

**Multipliers**:
- Human players: `× 5.0` (500% boost) - **highest priority**
- NPC players: `× 2.0` (200% boost) - **high priority**
- Powerups: `× 1.5` (50% boost) - **moderate priority**
- Blocks: `× 1.0` (no boost) - **base priority**
- Reachable targets: `× 1.2` (20% bonus)
- Unreachable targets: `× 0.5` (50% penalty) - still considered but lower priority

**Why**: Creates clear target priority hierarchy - NPCs strongly prefer human players, but still consider other targets if players aren't available.

---

#### Block Candidate Scoring (Line 1526)

```1520:1527:server/npc/NPC.js
              candidates.push({
                x: finalX,
                y: finalY,
                type: 'block',
                distance: distance,
                distanceToPlayer: distanceToPlayer,
                score: distanceToPlayer - distance * 0.5 // Prefer blocks that are closer to player
              });
```

**Formula**: `distanceToPlayer - distance * 0.5`
- Subtracts half of distance-to-NPC from distance-to-player
- Higher score = better block (closer to player, clearing path)
- **Example**: 
  - Block 3 tiles from NPC, 5 tiles from player: `5 - 3*0.5 = 3.5`
  - Block 2 tiles from NPC, 2 tiles from player: `2 - 2*0.5 = 1.0`
  - First block has higher score (better for clearing path to player)

**Why**: Prefers blocks that clear the path toward the player (trapper strategy optimization).

---

### 8.5 Summary: Math Functions by Purpose

| Function | Purpose | Key Uses |
|----------|---------|----------|
| `Math.random()` | Probability/Randomness | Bomb placement chance, mistake simulation, risk-taking, direction shuffling |
| `Math.min()` | Cap values | Limit probabilities to 1.0, cap plan steps, bound search areas |
| `Math.max()` | Ensure minimum bounds | Boundary checking, ensure search areas start at 0 |
| `Math.abs()` | Distance calculations | Position matching, direction priority, step calculation |
| Multiplication (`*`) | Score boosting | Priority multipliers (5.0, 2.0, 1.5), distance factors |
| Division (`/`) | Distance factors | Inverse distance scoring, step unit calculation |

**Design Philosophy**: Math functions are used to:
1. **Add randomness** - Make behavior unpredictable and human-like
2. **Enforce constraints** - Prevent invalid values and array bounds errors
3. **Calculate priorities** - Score and rank targets based on distance and importance
4. **Simulate imperfection** - Mistake rates and thresholds create realistic AI behavior

---

## Conclusion

The difficulty profile and behavior strategy systems work together to create NPCs with distinct personalities and execution capabilities. The profile controls **how well** NPCs perform, while the strategy controls **what** they prioritize. This creates a rich combination space where NPCs can have mismatched intent and execution, leading to more interesting and human-like gameplay.
