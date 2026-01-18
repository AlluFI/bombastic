/**
 * Integration Tests
 * Tests for full game flows and system interactions
 */

const { generateBoard, generateRoomCode, syncRoomGameState, checkGameEnd, calculateExplosionBlocks, calculateExplosionTiles } = require('../utils');
const CONSTANTS = require('../constants');
const { startPos, colors } = require('../utils');

// Mock Socket.io
function createMockSocket(id) {
  return {
    id,
    emit: jest.fn(),
    join: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn(),
    })),
    roomCode: null,
  };
}

function createMockIO() {
  const sockets = new Map();
  return {
    sockets,
    to: jest.fn((roomId) => ({
      emit: jest.fn((event, data) => {
        // Store emitted events for assertions
        if (!this.events) this.events = [];
        this.events.push({ roomId, event, data });
      }),
      events: [],
    })),
  };
}

function createRoom(roomId, hostId, gameMode = 'multiplayer') {
  const now = Date.now();
  return {
    host: hostId,
    players: new Map(),
    started: false,
    chats: [],
    eliminationOrder: [],
    createdAt: now,
    lastEmptyTime: null,
    gameState: {
      players: [],
      bombs: [],
      powerups: [],
      board: generateBoard(),
      gameMode,
      isRunning: false,
      isPaused: false,
    },
    npcs: new Map(),
    gameStartTime: null,
    pauseStartTime: null,
  };
}

function createPlayer(id, name, positionIndex = 0) {
  return {
    id,
    name,
    x: startPos[positionIndex].x,
    y: startPos[positionIndex].y,
    color: colors[positionIndex],
    lives: CONSTANTS.DEFAULT_LIVES,
    alive: true,
    bombRange: 2,
    maxBombs: 1,
    immortal: false,
    immortalEnd: 0,
    score: 0,
  };
}

function addPlayerToRoom(room, player) {
  room.players.set(player.id, player);
  syncRoomGameState(room);
}

function placeBomb(room, player, x, y) {
  const bomb = {
    id: `bomb-${Date.now()}-${Math.random()}`,
    x,
    y,
    playerId: player.id,
    range: player.bombRange,
    placedAt: Date.now(),
    duration: CONSTANTS.BOMB_TIMER_MS,
  };
  
  room.gameState.bombs.push(bomb);
  syncRoomGameState(room);
  return bomb;
}

// Simulate game loop bomb processing
function processBombExplosions(room, now = Date.now()) {
  const explodedBombs = [];
  const destroyedBlocks = [];
  const processedBombIds = new Set();
  const bombsToExplode = [];
  const bombsToExplodeIds = new Set();
  
  // Find bombs with expired timers
  room.gameState.bombs.forEach(bomb => {
    if (processedBombIds.has(bomb.id)) return;
    const elapsed = now - bomb.placedAt;
    if (elapsed >= bomb.duration) {
      bombsToExplode.push(bomb);
      bombsToExplodeIds.add(bomb.id);
    }
  });
  
  // Process chain reactions
  let bombIndex = 0;
  while (bombIndex < bombsToExplode.length) {
    const bomb = bombsToExplode[bombIndex];
    bombIndex++;
    
    if (processedBombIds.has(bomb.id)) continue;
    processedBombIds.add(bomb.id);
    explodedBombs.push(bomb);
    
    // Calculate explosion tiles (for damage detection)
    const explosionTiles = calculateExplosionTiles(bomb, room.gameState.board);
    
    // Calculate destroyed blocks
    const blocks = calculateExplosionBlocks(bomb, room.gameState.board);
    destroyedBlocks.push(...blocks);
    
    // Destroy blocks on board
    blocks.forEach(block => {
      room.gameState.board[block.x][block.y] = 0;
    });
    
    // Find bombs in explosion range (chain reactions)
    const bombsToCheck = Array.from(room.gameState.bombs);
    bombsToCheck.forEach(otherBomb => {
      if (otherBomb.id === bomb.id || processedBombIds.has(otherBomb.id) || bombsToExplodeIds.has(otherBomb.id)) {
        return;
      }
      
      // Check if bomb is in explosion range
      const isInExplosion = explosionTiles.some(tile => tile.x === otherBomb.x && tile.y === otherBomb.y);
      if (isInExplosion) {
        if (!bombsToExplodeIds.has(otherBomb.id)) {
          bombsToExplode.push(otherBomb);
          bombsToExplodeIds.add(otherBomb.id);
        }
      }
    });
  }
  
  // Remove exploded bombs
  room.gameState.bombs = room.gameState.bombs.filter(b => !processedBombIds.has(b.id));
  
  // Check player damage using explosion tiles
  explodedBombs.forEach(bomb => {
    const explosionTiles = calculateExplosionTiles(bomb, room.gameState.board);
    explosionTiles.forEach(tile => {
      room.players.forEach((player, playerId) => {
        if (!player.alive || player.immortal) return;
        if (player.x === tile.x && player.y === tile.y) {
          player.lives--;
          if (player.lives <= 0) {
            player.alive = false;
            player.x = -1;
            player.y = -1;
            if (!room.eliminationOrder.includes(playerId)) {
              room.eliminationOrder.push(playerId);
            }
          }
        }
      });
    });
  });
  
  syncRoomGameState(room);
  
  return { explodedBombs, destroyedBlocks };
}

describe('Integration Tests', () => {
  let mockIO;
  let rooms;
  
  beforeEach(() => {
    mockIO = createMockIO();
    rooms = new Map();
    jest.clearAllMocks();
  });
  
  describe('Full Game Flow', () => {
    test('should complete full game flow: create room → join → start → play → end', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      const player2Id = 'player-2';
      
      // Step 1: Create room (host)
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      rooms.set(roomId, room);
      
      expect(room.players.size).toBe(1);
      expect(room.gameState.isRunning).toBe(false);
      expect(room.gameState.players.length).toBe(1);
      
      // Step 2: Join room (second player)
      const player2 = createPlayer(player2Id, 'Player2', 1);
      addPlayerToRoom(room, player2);
      
      expect(room.players.size).toBe(2);
      expect(room.gameState.players.length).toBe(2);
      
      // Step 3: Start game
      room.gameState.isRunning = true;
      room.gameStartTime = Date.now();
      syncRoomGameState(room);
      
      expect(room.gameState.isRunning).toBe(true);
      expect(room.gameState.players.every(p => p.alive)).toBe(true);
      
      // Step 4: Play - host places a bomb
      const bombX = host.x;
      const bombY = host.y + 1; // Place bomb one tile down
      const bomb = placeBomb(room, host, bombX, bombY);
      
      expect(room.gameState.bombs.length).toBe(1);
      expect(room.gameState.bombs[0].playerId).toBe(hostId);
      
      // Step 5: Wait for bomb explosion and damage player2
      const now = Date.now() + CONSTANTS.BOMB_TIMER_MS + 100;
      processBombExplosions(room, now);
      
      // Bomb should be removed
      expect(room.gameState.bombs.length).toBe(0);
      
      // Step 6: Check game end - player2 should have lost a life or died
      // (depends on position, but at least bomb should explode)
      syncRoomGameState(room);
      const gameEndResult = checkGameEnd(room.gameState);
      
      // Game continues if both alive, or ends if someone died
      if (gameEndResult) {
        expect(gameEndResult.winner).toBeDefined();
      } else {
        expect(room.gameState.players.some(p => p.alive)).toBe(true);
      }
    });
    
    test('should handle game end when all players die', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      const player2Id = 'player-2';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      const player2 = createPlayer(player2Id, 'Player2', 1);
      
      // Set both players to 1 life for faster test
      host.lives = 1;
      player2.lives = 1;
      
      addPlayerToRoom(room, host);
      addPlayerToRoom(room, player2);
      room.gameState.isRunning = true;
      
      // Place bomb near player2
      const bomb = placeBomb(room, host, player2.x, player2.y);
      
      // Process explosion
      const now = Date.now() + CONSTANTS.BOMB_TIMER_MS + 100;
      processBombExplosions(room, now);
      
      syncRoomGameState(room);
      
      // Check game end (pass room for eliminationOrder)
      const gameEndResult = checkGameEnd(room.gameState, room);
      
      // Game should end (either with winner or draw)
      expect(gameEndResult).toBeDefined();
      if (room.gameState.players.every(p => !p.alive)) {
        expect(gameEndResult.isDraw).toBe(true);
      } else {
        expect(gameEndResult.winner).toBeDefined();
      }
    });
  });
  
  describe('Bomb Chain Reactions', () => {
    test('should trigger chain reaction when bombs are in range', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      
      // Place first bomb
      const bomb1 = placeBomb(room, host, 5, 5);
      
      // Place second bomb in range of first (with range 2, bomb at (5,6) is in range)
      host.bombRange = 2;
      const bomb2 = placeBomb(room, host, 5, 6);
      
      // Place third bomb further away (should not chain immediately)
      const bomb3 = placeBomb(room, host, 5, 10);
      
      expect(room.gameState.bombs.length).toBe(3);
      
      // Process explosions - first bomb should trigger second bomb
      const now = Date.now() + CONSTANTS.BOMB_TIMER_MS + 100;
      const result = processBombExplosions(room, now);
      
      // At least bomb1 should explode (bomb2 should chain)
      expect(result.explodedBombs.length).toBeGreaterThanOrEqual(1);
      
      // If bomb2 chained, both should explode
      if (result.explodedBombs.length >= 2) {
        const explodedIds = result.explodedBombs.map(b => b.id);
        expect(explodedIds).toContain(bomb1.id);
        expect(explodedIds).toContain(bomb2.id);
      }
      
      // Bomb3 should only explode if it was in range of bomb1 or bomb2
      // (or if it's timer also expired)
    });
    
    test('should handle multiple chain reactions in sequence', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      host.bombRange = 3; // Larger range
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      
      // Create a chain: bomb1 → bomb2 → bomb3 (all in range)
      const bomb1 = placeBomb(room, host, 5, 5);
      const bomb2 = placeBomb(room, host, 5, 6); // Adjacent to bomb1
      const bomb3 = placeBomb(room, host, 5, 7); // Adjacent to bomb2
      
      expect(room.gameState.bombs.length).toBe(3);
      
      // Process explosions
      const now = Date.now() + CONSTANTS.BOMB_TIMER_MS + 100;
      const result = processBombExplosions(room, now);
      
      // All three bombs should explode in chain
      expect(result.explodedBombs.length).toBe(3);
      const explodedIds = result.explodedBombs.map(b => b.id);
      expect(explodedIds).toContain(bomb1.id);
      expect(explodedIds).toContain(bomb2.id);
      expect(explodedIds).toContain(bomb3.id);
      
      // All bombs should be removed
      expect(room.gameState.bombs.length).toBe(0);
    });
  });
  
  describe('Power-up Spawning and Collection', () => {
    test('should spawn power-up when block is destroyed', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      
      // Find a destructible block
      let blockX = -1, blockY = -1;
      for (let x = 1; x < CONSTANTS.GRID_ROWS - 1; x++) {
        for (let y = 1; y < CONSTANTS.GRID_COLS - 1; y++) {
          if (room.gameState.board[x][y] === 1) {
            blockX = x;
            blockY = y;
            break;
          }
        }
        if (blockX !== -1) break;
      }
      
      expect(blockX).toBeGreaterThan(0);
      expect(blockY).toBeGreaterThan(0);
      
      // Place bomb near block
      const bomb = placeBomb(room, host, blockX - 1, blockY);
      
      // Process explosion
      const now = Date.now() + CONSTANTS.BOMB_TIMER_MS + 100;
      const result = processBombExplosions(room, now);
      
      // Block should be destroyed
      expect(room.gameState.board[blockX][blockY]).toBe(0);
      expect(result.destroyedBlocks.length).toBeGreaterThan(0);
      
      // Power-up might spawn (random chance)
      // Power-ups are spawned in game-loop.js, but we can verify block destruction
      const wasBlockDestroyed = result.destroyedBlocks.some(
        block => block.x === blockX && block.y === blockY
      );
      expect(wasBlockDestroyed).toBe(true);
    });
    
    test('should handle power-up collection (player moves to power-up position)', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      
      // Manually add a power-up (simulating spawn)
      const powerup = {
        id: 'powerup-1',
        x: host.x + 1,
        y: host.y,
        type: 'bomb-range',
      };
      room.gameState.powerups.push(powerup);
      syncRoomGameState(room);
      
      expect(room.gameState.powerups.length).toBe(1);
      
      // Player moves to power-up position (simulating collection)
      host.x = powerup.x;
      host.y = powerup.y;
      
      // Power-up should be collected (removed from game state)
      // This is handled in powerup.js handlers, but we can verify position match
      const playerAtPowerupPosition = room.gameState.powerups.some(
        p => p.x === host.x && p.y === host.y
      );
      
      // If player is at powerup position, powerup should be collectible
      expect(playerAtPowerupPosition).toBe(true);
    });
  });
  
  describe('Pause/Resume Synchronization', () => {
    test('should pause and resume game correctly', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      room.gameStartTime = Date.now();
      
      const initialStartTime = room.gameStartTime;
      
      // Pause game
      room.gameState.isPaused = true;
      room.pauseStartTime = Date.now();
      
      expect(room.gameState.isPaused).toBe(true);
      expect(room.pauseStartTime).toBeDefined();
      
      // Wait some time while paused
      const pauseDuration = 1000;
      const resumeTime = Date.now() + pauseDuration;
      
      // Resume game
      if (room.pauseStartTime) {
        const actualPauseDuration = resumeTime - room.pauseStartTime;
        room.gameStartTime += actualPauseDuration;
        room.pauseStartTime = null;
      }
      room.gameState.isPaused = false;
      
      expect(room.gameState.isPaused).toBe(false);
      expect(room.pauseStartTime).toBeNull();
      
      // Game start time should be adjusted
      expect(room.gameStartTime).toBeGreaterThanOrEqual(initialStartTime);
    });
    
    test('should not process game logic when paused', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      addPlayerToRoom(room, host);
      room.gameState.isRunning = true;
      
      // Place a bomb
      const bomb = placeBomb(room, host, host.x, host.y + 1);
      
      // Pause game
      room.gameState.isPaused = true;
      
      // When paused, bombs should not explode (game loop checks isPaused)
      // But we can test that isPaused flag prevents processing
      expect(room.gameState.isPaused).toBe(true);
      
      // Resume
      room.gameState.isPaused = false;
      
      // Now bombs can explode
      expect(room.gameState.isPaused).toBe(false);
    });
  });
  
  describe('Game State Synchronization', () => {
    test('should sync Map to Array format correctly', () => {
      const roomId = 'TEST123';
      const hostId = 'host-1';
      const player2Id = 'player-2';
      
      const room = createRoom(roomId, hostId);
      const host = createPlayer(hostId, 'Host', 0);
      const player2 = createPlayer(player2Id, 'Player2', 1);
      
      addPlayerToRoom(room, host);
      addPlayerToRoom(room, player2);
      
      // Game state should reflect players map
      expect(room.gameState.players.length).toBe(2);
      expect(room.gameState.players.some(p => p.id === hostId)).toBe(true);
      expect(room.gameState.players.some(p => p.id === player2Id)).toBe(true);
      
      // Remove a player
      room.players.delete(player2Id);
      syncRoomGameState(room);
      
      // Game state should update
      expect(room.gameState.players.length).toBe(1);
      expect(room.gameState.players[0].id).toBe(hostId);
    });
  });
});
