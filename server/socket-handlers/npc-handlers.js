const { ENABLE_NPC, ENABLE_SINGLE_PLAYER_MODE } = require('../config.js');
const {
  syncRoomGameState,
  colors,
  startPos,
} = require('../utils.js');
const { logRoomEvent } = require('../logger');

const { NPC } = require('../npc');



module.exports = function npcHandlers(io, socket, rooms) {
    //===================================
    // Set game mode (single-player vs multiplayer)
    //===================================
  socket.on('set-game-mode', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can set game mode' });
      return;
    }
    
    if (!ENABLE_SINGLE_PLAYER_MODE) {
      socket.emit('error', { message: 'Single-player mode is disabled' });
      return;
    }
    
    room.gameState.gameMode = data.mode; // 'multiplayer' | 'single-player'
    
    // If switching to single-player, reject new joins
    if (data.mode === 'single-player') {
      // Reject any pending joins (handled in room:join)
    }
    
    // Notify room
    io.to(socket.roomCode).emit('game-mode-changed', { mode: data.mode });
  });


     //===================================
     // Configure NPCs for single-player mode
     //===================================
  socket.on('configure-npcs', (data) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) {
      socket.emit('error', { message: 'Only host can configure NPCs' });
      return;
    }
    
    if (!ENABLE_NPC || !ENABLE_SINGLE_PLAYER_MODE) {
      socket.emit('error', { message: 'NPC mode is disabled' });
      return;
    }
    
    if (room.gameState.gameMode !== 'single-player') {
      socket.emit('error', { message: 'NPCs only available in single-player mode' });
      return;
    }
    
    // Clear existing NPCs
    room.npcs.clear();
    
    // Support two formats:
    // 1. Simple format: { count: number, difficulties: string[] }
    // 2. Advanced format: { npcs: [{ id, name, difficulty, ... }] }
    
    let npcsToCreate = [];
    
    if (data.npcs && Array.isArray(data.npcs)) {
      // Advanced format: individual NPC configs
      npcsToCreate = data.npcs.slice(0, 3); // Max 3 NPCs
    } else {
      // Simple format: count + difficulties array
      const count = Math.min(data.count || 1, 3); // Max 3 NPCs
      const difficulties = data.difficulties || Array(count).fill('medium');
      
      for (let i = 0; i < count; i++) {
        npcsToCreate.push({
          id: `npc-${i + 1}`,
          name: `Bot ${i + 1}`,
          difficulty: difficulties[i] || 'medium',
        });
      }
    }
    
    // Create NPCs
    npcsToCreate.forEach((npcConfig, index) => {
      const npcId = npcConfig.id || `npc-${index + 1}`;
      const npcName = npcConfig.name || `Bot ${index + 1}`;
      const difficulty = npcConfig.difficulty || 'medium';
      
      const npc = new NPC(npcId, npcName, difficulty);
      
      // Set NPC initial position (before adding to room)
      const startIndex = room.players.size;
      npc.position.x = startPos[startIndex].x;
      npc.position.y = startPos[startIndex].y;
      
      room.npcs.set(npcId, npc);
      
      // Add NPC to room.players Map (for consistency)
      room.players.set(npcId, {
        id: npcId,
        name: npc.name,
        x: npc.position.x,
        y: npc.position.y,
        color: colors[startIndex],
        alive: true,
        lives: 3, // Default lives
        bombRange: 2, // Default bomb range (can be upgraded via powerups)
        isNPC: true,
      });
      
      // Initialize elimination order if it doesn't exist
      if (!room.eliminationOrder) {
        room.eliminationOrder = [];
      }
    });
    
    // Sync game state
    syncRoomGameState(room);
    
    // For single-player mode, automatically start the game after NPCs are configured
    if (room.gameState.gameMode === 'single-player' && !room.gameState.isRunning) {
      room.gameState.isRunning = true;
      room.gameStartTime = Date.now(); // Track when game started for timer synchronization
      logRoomEvent(socket.roomCode, 'Single-player game started', {
        npcCount: room.npcs.size,
        gameMode: 'single-player'
      });
    }
    
    // Notify room (include updated players list with NPCs)
    io.to(socket.roomCode).emit('npcs-configured', {
      count: room.npcs.size,
      npcs: Array.from(room.npcs.values()).map(npc => ({
        id: npc.id,
        name: npc.name,
        difficulty: npc.difficulty,
      })),
    });
    
      // Also emit room:updated to sync NPCs to clients
    io.to(socket.roomCode).emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: socket.roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    });
  });
	
}