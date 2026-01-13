/**
 * Standalone NPC Test Script
 * 
 * Tests NPC framework with mock game state.
 * Run with: node server/npc/test-npc.js
 * 
 * This allows testing NPC logic without the full game engine or server.
 */

const NPC = require('./NPC');
const { getDifficultyProfile } = require('./DifficultyProfiles');
const DangerDetector = require('./utils/DangerDetector');
const Pathfinder = require('./utils/Pathfinder');

// Mock game state (simulates what the server would provide)
function createMockGameState() {
  return {
    players: [
      { id: 'npc-1', name: 'Bot Alice', x: 1, y: 1, alive: true, score: 0, lives: 1 },
      { id: 'player-1', name: 'Human Player', x: 5, y: 5, alive: true, score: 0, lives: 1 },
    ],
    bombs: [
      // { id: 'bomb-1', x: 3, y: 3, range: 2, timer: 2000 }, // Example bomb
    ],
    powerups: [
      // { id: 'powerup-1', x: 4, y: 4, type: 'bomb-range' }, // Example powerup
    ],
    board: createMockBoard(),
  };
}

// Create a simple mock board (13x11 grid)
// 0 = walkable, 1 = destructible block, 2 = indestructible wall
function createMockBoard() {
  const rows = 11;
  const cols = 13;
  const board = [];

  for (let y = 0; y < rows; y++) {
    board[y] = [];
    for (let x = 0; x < cols; x++) {
      // Border walls
      if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
        board[y][x] = 2; // Indestructible wall
      }
      // Checkerboard pattern of destructible blocks (skip player spawn areas)
      else if ((x + y) % 2 === 0 && !isSpawnArea(x, y)) {
        board[y][x] = 1; // Destructible block
      } else {
        board[y][x] = 0; // Walkable
      }
    }
  }

  return board;
}

// Check if position is a spawn area (should be walkable)
function isSpawnArea(x, y) {
  const spawnAreas = [
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 1 },
    { x: 11, y: 9 },
    { x: 11, y: 10 },
    { x: 10, y: 9 },
    { x: 1, y: 9 },
    { x: 1, y: 10 },
    { x: 2, y: 9 },
    { x: 11, y: 1 },
    { x: 11, y: 2 },
    { x: 10, y: 1 },
  ];
  return spawnAreas.some(area => area.x === x && area.y === y);
}

// Test NPC creation and basic functionality
function testNPCCreation() {
  console.log('\n=== Test 1: NPC Creation ===');
  
  const npc = new NPC('npc-1', 'Bot Alice', 'medium');
  console.log('✓ NPC created:', npc.name);
  console.log('  Difficulty:', npc.difficulty);
  console.log('  Profile:', {
    speed: npc.profile.speed,
    decisionInterval: npc.profile.decisionInterval,
    aggression: npc.profile.aggression,
  });
  
  return npc;
}

// Test difficulty profiles
function testDifficultyProfiles() {
  console.log('\n=== Test 2: Difficulty Profiles ===');
  
  const difficulties = ['easy', 'medium', 'hard'];
  difficulties.forEach(diff => {
    const profile = getDifficultyProfile(diff);
    console.log(`\n${diff.toUpperCase()}:`);
    console.log(`  Speed: ${profile.speed}x`);
    console.log(`  Decision Interval: ${profile.decisionInterval}ms`);
    console.log(`  Aggression: ${profile.aggression}`);
    console.log(`  Mistake Rate: ${profile.mistakeRate * 100}%`);
    console.log(`  Avoidance Success: ${profile.avoidanceSuccess * 100}%`);
  });
}

// Test NPC decision-making
function testNPCDecisions(npc) {
  console.log('\n=== Test 3: NPC Decision-Making ===');
  
  const gameState = createMockGameState();
  npc.updateWorldState(gameState);
  
  console.log('NPC Position:', npc.position);
  console.log('NPC Alive:', npc.alive);
  
  // Simulate multiple decision ticks
  const actions = [];
  const startTime = Date.now();
  
  for (let i = 0; i < 10; i++) {
    const currentTime = startTime + (i * 300); // 300ms intervals
    const action = npc.getNextCommand(currentTime);
    if (action) {
      actions.push(action);
      console.log(`  Tick ${i + 1}:`, action);
    }
  }
  
  console.log(`\nTotal actions generated: ${actions.length}/10`);
  return actions;
}

// Test danger detection
function testDangerDetection() {
  console.log('\n=== Test 4: Danger Detection ===');
  
  const bombs = [
    { id: 'bomb-1', x: 5, y: 5, range: 2, timer: 2000 },
    { id: 'bomb-2', x: 8, y: 3, range: 3, timer: 1500 },
  ];
  
  const board = createMockBoard();
  const dangerZones = DangerDetector.calculateDangerZones(bombs, board, 11, 13);
  
  console.log('Bombs:', bombs.map(b => `(${b.x},${b.y})`));
  console.log('Danger zones:', Array.from(dangerZones).slice(0, 10), '...');
  console.log(`Total danger zones: ${dangerZones.size}`);
  
  // Test if position is in danger
  const testPos = { x: 5, y: 5 };
  const inDanger = DangerDetector.isInDanger(testPos, dangerZones);
  console.log(`Position (5,5) in danger: ${inDanger}`);
  
  return dangerZones;
}

// Test pathfinding
function testPathfinding() {
  console.log('\n=== Test 5: Pathfinding ===');
  
  const board = createMockBoard();
  const start = { x: 1, y: 1 };
  const target = { x: 5, y: 5 };
  
  const path = Pathfinder.findPath(start, target, board, 11, 13);
  console.log('Start:', start);
  console.log('Target:', target);
  console.log('Path found:', path.length > 0 ? 'Yes' : 'No');
  if (path.length > 0) {
    console.log('Path length:', path.length);
    console.log('First 5 steps:', path.slice(0, 5));
  }
  
  // Test next direction
  const direction = Pathfinder.getNextDirection(start, target, board, 11, 13);
  console.log('Next direction:', direction);
  
  return path;
}

// Test NPC with danger scenario
function testNPCWithDanger(npc) {
  console.log('\n=== Test 6: NPC with Danger Scenario ===');
  
  const gameState = createMockGameState();
  
  // Place NPC near a bomb
  npc.position = { x: 5, y: 5 };
  gameState.players.find(p => p.id === 'npc-1').x = 5;
  gameState.players.find(p => p.id === 'npc-1').y = 5;
  
  // Add a bomb nearby (within explosion range)
  gameState.bombs.push({ id: 'bomb-1', x: 6, y: 5, range: 2, timer: 2000 });
  
  npc.updateWorldState(gameState);
  
  console.log('NPC Position:', npc.position);
  console.log('Bomb Position:', gameState.bombs[0]);
  console.log('NPC in danger:', npc._isInDanger());
  console.log('Danger zones count:', npc.dangerZones.size);
  
  // Get escape action
  const action = npc.getNextCommand(Date.now());
  console.log('NPC Escape Action:', action);
  
  // Verify action is a move (not staying in danger)
  if (action && action.type === 'MOVE') {
    const nextPos = npc._getNextPosition(npc.position, action.direction);
    const stillInDanger = npc._isInDanger() || 
      DangerDetector.isInDanger(nextPos, npc.dangerZones);
    console.log('Next position will be safe:', !stillInDanger);
  }
  
  return action;
}

// Test NPC pathfinding to target
function testNPCPathfinding() {
  console.log('\n=== Test 7: NPC Pathfinding to Target ===');
  
  const npc = new NPC('npc-1', 'Pathfinder Bot', 'medium');
  const gameState = createMockGameState();
  
  // Set NPC position
  npc.position = { x: 1, y: 1 };
  gameState.players.find(p => p.id === 'npc-1').x = 1;
  gameState.players.find(p => p.id === 'npc-1').y = 1;
  
  // Set a target
  npc.currentTarget = { x: 5, y: 5 };
  
  npc.updateWorldState(gameState);
  
  console.log('NPC Position:', npc.position);
  console.log('Target Position:', npc.currentTarget);
  
  // Get multiple actions to see pathfinding in action
  const actions = [];
  for (let i = 0; i < 5; i++) {
    const action = npc.getNextCommand(Date.now() + (i * 300));
    if (action && action.type === 'MOVE') {
      actions.push(action);
      // Simulate movement
      const nextPos = npc._getNextPosition(npc.position, action.direction);
      npc.position = nextPos;
      gameState.players.find(p => p.id === 'npc-1').x = nextPos.x;
      gameState.players.find(p => p.id === 'npc-1').y = nextPos.y;
      npc.updateWorldState(gameState);
    }
  }
  
  console.log('Pathfinding actions:', actions.map(a => a.direction));
  console.log('Final position:', npc.position);
  console.log('Distance to target:', Pathfinder.manhattanDistance(npc.position, npc.currentTarget));
  
  return actions;
}

// Test NPC safety checks (no suicide)
function testNPCSafetyChecks() {
  console.log('\n=== Test 8: NPC Safety Checks ===');
  
  const npc = new NPC('npc-1', 'Safety Bot', 'medium');
  const gameState = createMockGameState();
  
  // Place NPC in a position where it might trap itself
  npc.position = { x: 2, y: 2 };
  gameState.players.find(p => p.id === 'npc-1').x = 2;
  gameState.players.find(p => p.id === 'npc-1').y = 2;
  
  npc.updateWorldState(gameState);
  
  console.log('NPC Position:', npc.position);
  console.log('Has escape route:', npc._hasEscapeRoute());
  
  // Try to place bomb (should check for escape route)
  const bombAction = npc._decidePlaceBomb();
  console.log('Bomb placement decision:', bombAction);
  console.log('NPC avoids suicide:', bombAction === null || npc._hasEscapeRoute());
  
  // Test danger avoidance
  const inDanger = npc._isInDanger();
  console.log('NPC in danger:', inDanger);
  
  if (!inDanger) {
    // Add a bomb to create danger
    gameState.bombs.push({ id: 'bomb-1', x: 3, y: 2, range: 2, timer: 2000 });
    npc.updateWorldState(gameState);
    console.log('After adding bomb - NPC in danger:', npc._isInDanger());
    
    const escapeAction = npc._decideEscape();
    console.log('Escape action:', escapeAction);
  }
  
  return { hasEscapeRoute: npc._hasEscapeRoute(), avoidsDanger: !npc._isInDanger() };
}

// Test bomb placement strategy (targets vs no targets)
function testBombPlacementStrategy() {
  console.log('\n=== Test 12: Bomb Placement Strategy ===');
  
  const npc = new NPC('npc-1', 'Bomb Bot', 'medium');
  const gameState = createMockGameState();

  // Scenario 1: No nearby targets -> should usually avoid bombing
  npc.position = { x: 1, y: 1 };
  gameState.players.find(p => p.id === 'npc-1').x = 1;
  gameState.players.find(p => p.id === 'npc-1').y = 1;
  gameState.bombs = [];
  npc.updateWorldState(gameState);

  let bombDecisionsNoTarget = 0;
  for (let i = 0; i < 5; i++) {
    const action = npc._decidePlaceBomb();
    if (action && action.type === 'BOMB') {
      bombDecisionsNoTarget++;
    }
  }
  console.log('Bombs placed with no clear target (should be low):', bombDecisionsNoTarget);

  // Scenario 2: Player target in range -> should be more willing to bomb
  const enemy = { id: 'player-2', name: 'Enemy', x: npc.position.x + 1, y: npc.position.y, alive: true };
  gameState.players.push(enemy);
  npc.updateWorldState(gameState);

  let bombDecisionsWithTarget = 0;
  for (let i = 0; i < 5; i++) {
    const action = npc._decidePlaceBomb();
    if (action && action.type === 'BOMB') {
      bombDecisionsWithTarget++;
    }
  }
  console.log('Bombs placed with nearby player target (should be >= without target):', bombDecisionsWithTarget);

  return { bombDecisionsNoTarget, bombDecisionsWithTarget };
}
// Test behavior strategies
function testBehaviorStrategies() {
  console.log('\n=== Test 9: Behavior Strategies ===');
  
  const BehaviorStrategies = require('./BehaviorStrategies');
  const npc = new NPC('npc-1', 'Strategy Bot', 'medium');
  const gameState = createMockGameState();
  
  // Test default strategy (based on difficulty)
  const defaultStrategy = BehaviorStrategies.getStrategy(npc, gameState);
  console.log('Default strategy (medium):', defaultStrategy.name);
  console.log('  Target priorities:', defaultStrategy.targetPriority);
  console.log('  Bomb placement chance:', defaultStrategy.bombPlacementChance);
  
  // Test custom strategy
  npc.config = { strategy: 'aggressive' };
  const aggressiveStrategy = BehaviorStrategies.getStrategy(npc, gameState);
  console.log('\nCustom strategy (aggressive):', aggressiveStrategy.name);
  console.log('  Target priorities:', aggressiveStrategy.targetPriority);
  console.log('  Bomb placement chance:', aggressiveStrategy.bombPlacementChance);
  
  // Test different difficulties
  const easyNPC = new NPC('npc-2', 'Easy Bot', 'easy');
  const easyStrategy = BehaviorStrategies.getStrategy(easyNPC, gameState);
  console.log('\nEasy difficulty strategy:', easyStrategy.name);
  
  const hardNPC = new NPC('npc-3', 'Hard Bot', 'hard');
  const hardStrategy = BehaviorStrategies.getStrategy(hardNPC, gameState);
  console.log('Hard difficulty strategy:', hardStrategy.name);
  
  return { defaultStrategy, aggressiveStrategy, easyStrategy, hardStrategy };
}

// Test infinite loop prevention
function testLoopPrevention() {
  console.log('\n=== Test 10: Infinite Loop Prevention ===');
  
  const npc = new NPC('npc-1', 'Loop Test Bot', 'medium');
  const gameState = createMockGameState();
  
  npc.position = { x: 2, y: 2 };
  gameState.players.find(p => p.id === 'npc-1').x = 2;
  gameState.players.find(p => p.id === 'npc-1').y = 2;
  
  npc.updateWorldState(gameState);
  
  // Simulate being stuck (same position multiple times)
  for (let i = 0; i < 6; i++) {
    npc._updatePositionHistory();
  }
  
  console.log('Position history:', npc.lastPositions);
  console.log('Is stuck:', npc._isStuck());
  
  if (npc._isStuck()) {
    const unstuckAction = npc._getUnstuck();
    console.log('Unstuck action:', unstuckAction);
    console.log('Position history cleared:', npc.lastPositions.length === 0);
  }
  
  return npc._isStuck();
}

// Test target selection
function testTargetSelection() {
  console.log('\n=== Test 11: Target Selection ===');
  
  const npc = new NPC('npc-1', 'Target Bot', 'hard', { strategy: 'aggressive' });
  const gameState = createMockGameState();
  
  // Add a player target
  gameState.players.push({ id: 'player-2', name: 'Target Player', x: 5, y: 5, alive: true });
  
  npc.position = { x: 1, y: 1 };
  gameState.players.find(p => p.id === 'npc-1').x = 1;
  gameState.players.find(p => p.id === 'npc-1').y = 1;
  
  npc.updateWorldState(gameState);
  
  const target = npc._selectTarget();
  console.log('Selected target:', target);
  
  if (target) {
    console.log('  Type:', target.type);
    console.log('  Position:', { x: target.x, y: target.y });
    console.log('  Priority:', target.priority);
    console.log('  Distance:', target.distance);
  }
  
  return target;
}

// Run all tests
function runAllTests() {
  console.log('========================================');
  console.log('NPC Framework Test Suite');
  console.log('========================================');
  
  try {
    const npc = testNPCCreation();
    testDifficultyProfiles();
    testNPCDecisions(npc);
    testDangerDetection();
    testPathfinding();
    testNPCWithDanger(npc);
    testNPCPathfinding();
    testNPCSafetyChecks();
    testBehaviorStrategies();
    testLoopPrevention();
    testTargetSelection();
    testBombPlacementStrategy();
    
    console.log('\n========================================');
    console.log('✓ All tests completed successfully!');
    console.log('========================================');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
    console.error(error.stack);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  createMockGameState,
  createMockBoard,
};

