 function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

 const startPos = [
   { x: 1, y: 1, },
   { x: 1, y: 13 },
   { x: 11, y: 1 },
   { x: 11, y: 13 },
]
 const colors =[
   'blue',
   'red',
   'green',
   'yellow',
   'purple',
   'orange']

/**
 * Find the next available color index that's not already taken
 * @param {Map} players - Map of existing players
 * @returns {number} - Index of the next available color
 */
function getNextAvailableColorIndex(players) {
  const usedColors = new Set(Array.from(players.values()).map(p => p.color))
  for (let i = 0; i < colors.length; i++) {
    if (!usedColors.has(colors[i])) {
      return i
    }
  }
  // Fallback: if all colors are used, return the count (will wrap around)
  return players.size % colors.length
}

/**
 * Find the next available starting position index that's not already taken
 * @param {Map} players - Map of existing players
 * @returns {number} - Index of the next available position
 */
function getNextAvailablePositionIndex(players) {
  const usedPositions = new Set(
    Array.from(players.values()).map(p => `${p.x},${p.y}`)
  )
  for (let i = 0; i < startPos.length; i++) {
    const posKey = `${startPos[i].x},${startPos[i].y}`
    if (!usedPositions.has(posKey)) {
      return i
    }
  }
  // Fallback: if all positions are used, return the count
  return players.size % startPos.length
}

const CONSTANTS = require('./constants.js')

// Grid dimensions (matching client)
const GRID_ROWS = CONSTANTS.GRID_ROWS
const GRID_COLS = CONSTANTS.GRID_COLS

/**
 * Generates the game board
 * Returns 2D array where: 0 = walkable, 1 = destructible block, 2 = indestructible wall
 * This matches the client's board generation logic exactly
 */
function generateBoard() {
  const board = []
  
  // Initialize board
  for (let r = 0; r < GRID_ROWS; r++) {
    board[r] = []
    for (let c = 0; c < GRID_COLS; c++) {
      // Border walls -> 2 (indestructible wall)
      if (r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) {
        board[r][c] = 2
        continue
      }
      
      // Internal unbreakable blocks (checkerboard pattern) -> 2 (indestructible wall)
      if (r % 2 === 0 && c % 2 === 0) {
        board[r][c] = 2
        continue
      }
      
      // Default to destructible block -> 1
      board[r][c] = 1
    }
  }
  
  // Empty spawn zones - Players need free space in corners to start the game
  const spawns = [
    [1, 1],
    [1, GRID_COLS - 2],
    [GRID_ROWS - 2, 1],
    [GRID_ROWS - 2, GRID_COLS - 2]
  ]
  
  // Make immediate tiles after corners empty (walkable)
  for (const [r, c] of spawns) {
    board[r][c] = 0 // Make spawn position walkable
    // Make adjacent tiles walkable for initial movement
    if (board[r][c + 1] !== undefined) {
      if (c + 1 === GRID_COLS - 1) {
        board[r][c - 1] = 0
      } else {
        board[r][c + 1] = 0
      }
    }
    if (board[r + 1] && board[r + 1][c] !== undefined) {
      if (r + 1 === GRID_ROWS - 1) {
        board[r - 1][c] = 0
      } else {
        board[r + 1][c] = 0
      }
    }
  }
  
  return board
}

/**
 * Syncs room.players Map to room.gameState.players Array
 * This makes the room state compatible with NPCs
 */
 function syncRoomGameState(room) {
  // Initialize elimination order if it doesn't exist
  if (!room.eliminationOrder) {
    room.eliminationOrder = [];
  }
  
  // Sync human players (exclude NPCs from room.players Map)
  room.gameState.players = Array.from(room.players.values())
    .filter(p => !p.isNPC) // Exclude NPCs that might be in the Map
    .map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      color: p.color,
      alive: p.alive !== false,  // Default: true
      lives: p.lives || 1,
      isNPC: false,  // Human players
    }));
  
  // Add/update NPCs in the players array
  room.npcs.forEach((npc, npcId) => {
    const npcPlayer = room.gameState.players.find(p => p.id === npcId);
    if (!npcPlayer) {
      room.gameState.players.push({
        id: npcId,
        name: npc.name,
        x: npc.position.x,
        y: npc.position.y,
        color: room.players.get(npcId)?.color || '#888888', // Get color from Map if available
        alive: npc.alive,
        lives: npc.lives || 1,
        isNPC: true,
      });
    } else {
      // Update existing NPC player
      npcPlayer.x = npc.position.x;
      npcPlayer.y = npc.position.y;
      npcPlayer.alive = npc.alive;
      npcPlayer.lives = npc.lives || 1;
      npcPlayer.isNPC = true; // Ensure flag is set
    }
  });
}

/**
 * Checks if the game has ended and returns winner information
 * @param {Object} gameState - Current game state
 * @returns {Object|null} Winner info { winner: player object, isDraw: boolean } or null if game continues
 */
function checkGameEnd(gameState, room) {
  if (!gameState || !gameState.players) return null;
  
  const alivePlayers = gameState.players.filter(p => p.alive !== false);
  
  // Game ends when only one player is alive (or no players)
  if (alivePlayers.length <= 1) {
    // Initialize elimination order if it doesn't exist
    if (!room.eliminationOrder) {
      room.eliminationOrder = [];
    }
    
    // Add winner to elimination order (they're last, so highest rank)
    // IMPORTANT: Remove winner from eliminationOrder first if they're already in it,
    // then add them at the end to ensure they have the highest index
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      // Remove winner from eliminationOrder if they're already in it (shouldn't happen, but safety check)
      const winnerIndex = room.eliminationOrder.indexOf(winner.id);
      if (winnerIndex !== -1) {
        room.eliminationOrder.splice(winnerIndex, 1);
      }
      // Add winner at the end (highest index = best rank)
      room.eliminationOrder.push(winner.id);
      
      // Sort players by elimination order (last eliminated = winner = rank 1)
      // Players eliminated first have higher rank numbers (worse placement)
      const sortedPlayers = [...gameState.players].sort((a, b) => {
        const aIndex = room.eliminationOrder.indexOf(a.id);
        const bIndex = room.eliminationOrder.indexOf(b.id);
        
        // If not in elimination order, they're still alive (winner) - rank 1
        if (aIndex === -1) return -1; // Winner comes first
        if (bIndex === -1) return 1;   // Winner comes first
        
        // Higher index = eliminated later = better rank (lower number)
        // Sort descending: highest index (winner) first
        return bIndex - aIndex;
      });
      
      // Debug: Verify sorting is correct
      console.log('Game end - Elimination order:', room.eliminationOrder);
      console.log('Game end - Sorted players:', sortedPlayers.map(p => `${p.name} (index: ${room.eliminationOrder.indexOf(p.id)})`));
      
      return {
        winner: winner,
        isDraw: false,
        allPlayers: sortedPlayers // Sorted by elimination order (winner first)
      };
    } else {
      // All players dead - draw
      // Sort by elimination order (last eliminated = better rank)
      const sortedPlayers = [...gameState.players].sort((a, b) => {
        const aIndex = room.eliminationOrder.indexOf(a.id);
        const bIndex = room.eliminationOrder.indexOf(b.id);
        
        // If not in elimination order, something went wrong - put them last
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        
        // Higher index = eliminated later = better rank (lower number)
        return bIndex - aIndex;
      });
      
      return {
        winner: null,
        isDraw: true,
        allPlayers: sortedPlayers
      };
    }
  }
  
  return null; // Game continues
}

/**
 * Processes an NPC action and updates room state
 * @param {Object} io - Socket.io server instance
 * @param {Object} room - Room object
 * @param {string} roomId - Room ID
 * @param {string} npcId - NPC ID
 * @param {Object} action - Action object { type, direction? }
 */
 function handleNPCAction(io, room, roomId, npcId, action) {
  const npc = room.npcs.get(npcId);
  if (!npc) return;
  
  if (action.type === 'MOVE') {
    // Update NPC position
    // Coordinate system: x = row (vertical), y = col (horizontal)
    // UP = decrease x (move up in rows), DOWN = increase x (move down in rows)
    // LEFT = decrease y (move left in cols), RIGHT = increase y (move right in cols)
    const direction = action.direction;
    let newX = npc.position.x;
    let newY = npc.position.y;
    
    if (direction === 'UP') newX--;      // Move up = decrease row
    else if (direction === 'DOWN') newX++; // Move down = increase row
    else if (direction === 'LEFT') newY--; // Move left = decrease col
    else if (direction === 'RIGHT') newY++; // Move right = increase col
    
    // Validate move (check board bounds)
    // Grid is 13 rows (0-12) × 15 cols (0-14)
    // x = row (0-12), y = col (0-14)
    if (newX < 0 || newX >= 13 || newY < 0 || newY >= 15) {
      // Invalid move - don't update position
      return;
    }
    
    // Sync game state before validation to ensure we have current player positions and bombs
    syncRoomGameState(room);
    
    // Validate that target position is walkable (server-side validation)
    // Check if tile is walkable (0 = walkable, 1 = block, 2 = wall)
    if (!room.gameState.board || room.gameState.board[newX][newY] !== 0) {
      // Blocked by wall or block
      return;
    }
    
    // CRITICAL: Check if there's a bomb at the target position
    // This must check room.gameState.bombs directly (not NPC's cached gameState)
    // because bombs can be placed by other NPCs/players in the same cycle
    if (room.gameState.bombs && room.gameState.bombs.length > 0) {
      const blockingBomb = room.gameState.bombs.find(bomb => bomb.x === newX && bomb.y === newY);
      if (blockingBomb) {
        // Blocked by bomb - don't move
        return;
      }
    }
    
    // Check if there's another player or NPC at the target position
    // Check both gameState.players and room.npcs to ensure we catch all entities
    if (room.gameState.players && room.gameState.players.length > 0) {
      const hasPlayer = room.gameState.players.some(p => 
        p.alive && p.id !== npcId && p.x === newX && p.y === newY
      );
      if (hasPlayer) {
        // Blocked by another player/NPC in gameState
        return;
      }
    }
    
    // Also check NPCs directly to catch any that might not be in gameState yet
    if (room.npcs) {
      for (const [otherNpcId, otherNpc] of room.npcs.entries()) {
        if (otherNpcId !== npcId && otherNpc.alive && otherNpc.position.x === newX && otherNpc.position.y === newY) {
          // Blocked by another NPC
          return;
        }
      }
    }
    
    // Also check human players directly (exclude NPCs from this check)
    if (room.players) {
      for (const [playerId, player] of room.players.entries()) {
        // Skip NPCs (they're checked above) and the current NPC
        if (playerId !== npcId && !player.isNPC && player.alive && player.x === newX && player.y === newY) {
          // Blocked by a human player
          return;
        }
      }
    }
    
    npc.position.x = newX;
    npc.position.y = newY;
    
    // Update room.players Map
    const npcPlayer = room.players.get(npcId);
    if (npcPlayer) {
      npcPlayer.x = newX;
      npcPlayer.y = newY;
    }
    
    // Check if NPC stepped on a powerup
    if (room.gameState.powerups && room.gameState.powerups.length > 0) {
      const powerupIndex = room.gameState.powerups.findIndex(p => p.x === newX && p.y === newY);
      if (powerupIndex !== -1) {
        const powerup = room.gameState.powerups[powerupIndex];
        
        // Remove powerup from game state
        room.gameState.powerups.splice(powerupIndex, 1);
        
        // Update NPC stats (bombRange for now, can be extended for other powerup types)
        if (!npcPlayer.bombRange) {
          npcPlayer.bombRange = CONSTANTS.DEFAULT_BOMB_RANGE
        }
        
        if (powerup.type === 'bomb_range') {
          npcPlayer.bombRange += 1;
          console.log(`NPC ${npc.name} picked up bomb range power-up! New range: ${npcPlayer.bombRange}`);
        }
        
        // Broadcast power-up pickup to all clients
        io.to(roomId).emit('powerup:picked', {
          powerupId: powerup.id,
          playerId: npcId,
          x: newX,
          y: newY,
          type: powerup.type
        });
      }
    }
    
    // Sync game state immediately after NPC moves to ensure positions are current for collision detection
    syncRoomGameState(room);
    
    // Broadcast to room
    io.to(roomId).emit('player:moved', {
      id: npcId,
      x: newX,
      y: newY,
    });
    
  } else if (action.type === 'BOMB') {
    // Place bomb for NPC (same as player bomb placement)
    const BOMB_DURATION = CONSTANTS.BOMB_TIMER_MS; // 3 seconds, matching client
    
    // Check if NPC already has an active bomb (max 1 bomb per player/NPC)
    const existingBombs = (room.gameState.bombs || []).filter(b => b.playerId === npcId);
    if (existingBombs.length > 0) {
      // NPC already has a bomb, skip placement
      return;
    }
    
    // Get NPC's bomb range (from powerups)
    const npcPlayer = room.players.get(npcId);
    const bombRange = npcPlayer?.bombRange || CONSTANTS.DEFAULT_BOMB_RANGE
    
    // Generate unique bomb ID for NPC
    const bombId = `${npcId}-bomb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create bomb object
    const bomb = {
      id: bombId,
      bombId: bombId,
      playerId: npcId,
      x: npc.position.x,
      y: npc.position.y,
      range: bombRange, // Use NPC's bomb range (upgraded via powerups)
      timer: BOMB_DURATION,
      placedAt: Date.now(),
      duration: BOMB_DURATION
    };
    
    // Add bomb to game state
    if (!room.gameState.bombs) {
      room.gameState.bombs = [];
    }
    room.gameState.bombs.push(bomb);
    
    // Broadcast bomb placement to all clients in the room
    io.to(roomId).emit('bomb:placed', {
      bombId: bombId,
      playerId: npcId,
      x: bomb.x,
      y: bomb.y,
      duration: BOMB_DURATION,
      range: bombRange // Include range in broadcast
    });
    
    console.log(`NPC ${npc.name} placed bomb at (${bomb.x}, ${bomb.y})`);
  }
 }

/**
 * Calculates which blocks are destroyed by a bomb explosion
 * @param {Object} bomb - Bomb object { x, y, range }
 * @param {Array<Array<number>>} board - Game board (0=walkable, 1=destructible, 2=indestructible)
 * @returns {Array<Object>} Array of destroyed block positions { x, y }
 */
function calculateExplosionBlocks(bomb, board) {
  const destroyedBlocks = [];
  const range = bomb.range || 2;
  
  // Calculate explosion in 4 directions (matching DangerDetector logic)
  const directions = [
    { x: -1, y: 0 },  // UP (decrease row)
    { x: 1, y: 0 },   // DOWN (increase row)
    { x: 0, y: -1 },  // LEFT (decrease col)
    { x: 0, y: 1 },   // RIGHT (increase col)
  ];
  
  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const checkX = bomb.x + dir.x * i;
      const checkY = bomb.y + dir.y * i;
      
      // Stop if out of bounds
      if (checkX < 0 || checkX >= 13 || checkY < 0 || checkY >= 15) {
        break;
      }
      
      // Check if position has a destructible block
      if (board[checkX] && board[checkX][checkY] === 1) { // 1 = destructible block
        destroyedBlocks.push({ x: checkX, y: checkY });
        break; // Explosion stops at destructible blocks
      }
      
      // Stop if hit an indestructible wall (explosion doesn't pass through)
      if (board[checkX] && board[checkX][checkY] === 2) { // 2 = indestructible wall
        break;
      }
    }
  });
  
  return destroyedBlocks;
}

/**
 * Calculates all tiles affected by a bomb explosion (for damage detection)
 * @param {Object} bomb - Bomb object { x, y, range }
 * @param {Array<Array<number>>} board - Game board (0=walkable, 1=destructible, 2=indestructible)
 * @returns {Array<Object>} Array of explosion tile positions { x, y }
 */
function calculateExplosionTiles(bomb, board) {
  const explosionTiles = [];
  const range = bomb.range || 2;
  
  // Add bomb center position
  explosionTiles.push({ x: bomb.x, y: bomb.y });
  
  // Calculate explosion in 4 directions (matching DangerDetector logic)
  const directions = [
    { x: -1, y: 0 },  // UP (decrease row)
    { x: 1, y: 0 },   // DOWN (increase row)
    { x: 0, y: -1 },  // LEFT (decrease col)
    { x: 0, y: 1 },   // RIGHT (increase col)
  ];
  
  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const checkX = bomb.x + dir.x * i;
      const checkY = bomb.y + dir.y * i;
      
      // Stop if out of bounds
      if (checkX < 0 || checkX >= 13 || checkY < 0 || checkY >= 15) {
        break;
      }
      
      // Add this tile to explosion (even if it has a block - explosion reaches it)
      explosionTiles.push({ x: checkX, y: checkY });
      
      // Stop if hit an indestructible wall (explosion doesn't pass through)
      if (board[checkX] && board[checkX][checkY] === 2) { // 2 = indestructible wall
        break;
      }
      
      // Stop if hit a destructible block (explosion stops at block, but block is included)
      if (board[checkX] && board[checkX][checkY] === 1) { // 1 = destructible block
        break; // Explosion stops at destructible blocks
      }
    }
  });
  
  return explosionTiles;
}

function broadcastLobbyUpdate(io, rooms) {
  const activeLobbies = getActiveLobbies(rooms)
  io.emit('lobby:updated', { lobbies: activeLobbies })
}

function getActiveLobbies(rooms) {
  const activeLobbies = []
  
  rooms.forEach((room, roomCode) => {
    // Only include multiplayer lobbies that haven't started
    if (room.gameState.gameMode === 'multiplayer' && !room.gameState.isRunning) {
      const playerCount = room.players.size
      const maxPlayers = 4 // Max players per room
      
      // Only show if not full
      if (playerCount < maxPlayers) {
        activeLobbies.push({
          roomCode: roomCode,
          playerCount: playerCount,
          maxPlayers: maxPlayers
        })
      }
    }
  })
  
  return activeLobbies
}

module.exports = {
  generateRoomCode,
  generateBoard,
  startPos,
  colors,
  getNextAvailableColorIndex,
  getNextAvailablePositionIndex,
  syncRoomGameState,
  broadcastLobbyUpdate,
  handleNPCAction,
  checkGameEnd,
  calculateExplosionBlocks,
  calculateExplosionTiles,
  getActiveLobbies
}
