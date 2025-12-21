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

// Grid dimensions (matching client)
const GRID_ROWS = 13
const GRID_COLS = 15

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
      score: p.score || 0,
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
        score: npc.score,
        isNPC: true,
      });
    } else {
      // Update existing NPC player
      npcPlayer.x = npc.position.x;
      npcPlayer.y = npc.position.y;
      npcPlayer.alive = npc.alive;
      npcPlayer.score = npc.score;
      npcPlayer.isNPC = true; // Ensure flag is set
    }
  });
}

/**
 * Checks if the game has ended and returns winner information
 * @param {Object} gameState - Current game state
 * @returns {Object|null} Winner info { winner: player object, isDraw: boolean } or null if game continues
 */
function checkGameEnd(gameState) {
  if (!gameState || !gameState.players) return null;
  
  const alivePlayers = gameState.players.filter(p => p.alive !== false);
  
  // Game ends when only one player is alive (or no players)
  if (alivePlayers.length <= 1) {
    if (alivePlayers.length === 1) {
      return {
        winner: alivePlayers[0],
        isDraw: false,
        allPlayers: gameState.players // Include all players for scoreboard
      };
    } else {
      // All players dead - draw
      return {
        winner: null,
        isDraw: true,
        allPlayers: gameState.players
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
      console.log(`NPC ${npcId} tried to move out of bounds: (${newX}, ${newY}). Valid range: x: 0-12, y: 0-14`);
      return;
    }
    
    npc.position.x = newX;
    npc.position.y = newY;
    
    // Update room.players Map
    const npcPlayer = room.players.get(npcId);
    if (npcPlayer) {
      npcPlayer.x = newX;
      npcPlayer.y = newY;
    }
    
    // Broadcast to room
    io.to(roomId).emit('player:moved', {
      id: npcId,
      x: newX,
      y: newY,
    });
    
  } else if (action.type === 'BOMB') {
    // Place bomb for NPC (same as player bomb placement)
    const BOMB_DURATION = 3000; // 3 seconds, matching client
    
    // Check if NPC already has an active bomb (max 1 bomb per player/NPC)
    const existingBombs = (room.gameState.bombs || []).filter(b => b.playerId === npcId);
    if (existingBombs.length > 0) {
      // NPC already has a bomb, skip placement
      return;
    }
    
    // Generate unique bomb ID for NPC
    const bombId = `${npcId}-bomb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create bomb object
    const bomb = {
      id: bombId,
      bombId: bombId,
      playerId: npcId,
      x: npc.position.x,
      y: npc.position.y,
      range: 2, // Default explosion range (can be upgraded via powerups later)
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
      duration: BOMB_DURATION
    });
    
    console.log(`NPC ${npcId} (${npc.name}) placed bomb at (${bomb.x}, ${bomb.y})`);
  }
 }

module.exports = {
  generateRoomCode,
  generateBoard,
  startPos,
  colors,
  syncRoomGameState,
  handleNPCAction,
  checkGameEnd
}
