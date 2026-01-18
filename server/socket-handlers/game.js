const {syncRoomGameState, broadcastLobbyUpdate, generateBoard, startPos} = require('../utils.js')
const { validateRoom, validatePlayer, emitError } = require('../errorHandler.js')



module.exports = function gameHandlers(io, socket, rooms) {
    //=============================
    // Handle game pause/resume
    //=============================
  socket.on('game:pause', (payload) => {
    // Validate room and player
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = validatePlayer(socket, room)
    if (!player) return

    // Update pause state in game state
    room.gameState.isPaused = !!payload.paused
    
    // Adjust game start time when pausing/resuming to account for paused duration
    if (payload.paused) {
      // Game is being paused - store current pause start time
      room.pauseStartTime = Date.now();
    } else {
      // Game is being resumed - adjust game start time by the pause duration
      if (room.pauseStartTime) {
        const pauseDuration = Date.now() - room.pauseStartTime;
        if (room.gameStartTime) {
          room.gameStartTime += pauseDuration; // Add pause duration to start time
        }
        room.pauseStartTime = null;
      }
    }

    // Broadcast to ALL clients (including sender) for sync
    io.to(socket.roomCode).emit('game:pause', {
      paused: !!payload.paused,
      by: socket.id,
      ts: Date.now(),
      name: player.name
    })
  })
    
    socket.on('game:quit', () => {
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (player) {
      room.players.delete(socket.id)
      
      // Notify others
      socket.to(socket.roomCode).emit('player:left', socket.id)
    }
    })
    
     //===================================
    // Handle disconnect
    //===================================
  socket.on('disconnect', () => {
  
    // Clean up from room
    const room = rooms.get(socket.roomCode);
    if (!room) return
    
    const roomCode = socket.roomCode
    const player = room.players.get(socket.id)
    
    // Remove player from room
    room.players.delete(socket.id);

   socket.to(roomCode).emit('player:left', socket.id)
    
    // Check if room should be deleted
    // Delete if: empty OR single-player mode and host is leaving
    const isHostLeaving = room.host === socket.id
    const isSinglePlayerMode = room.gameState.gameMode === 'single-player'
    const shouldDeleteRoom = room.players.size === 0 || (isSinglePlayerMode && isHostLeaving)
    
    if (shouldDeleteRoom) {
      // Delete room
      rooms.delete(roomCode)
      // Broadcast lobby update (room removed)
      broadcastLobbyUpdate(io, rooms)
      return
    }
    
    // If the host disconnected, transfer host to the next player
    if (isHostLeaving) {
      const nextHost = room.players.keys().next().value
      room.host = nextHost
      // Clean up NPCs when host disconnects
      room.npcs.clear();
    }
    
    // Sync game state
    syncRoomGameState(room);
    
    // Notify remaining players of updated room state
    io.to(roomCode).emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    });
    
    // Broadcast lobby update (player count changed)
    broadcastLobbyUpdate(io, rooms)
  })
    
    //===================================================
    // Handle game start (host only, requires 2+ players)
    //===================================================
  socket.on('game:start', (data) => {
    // Validate room and player
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = validatePlayer(socket, room)
    if (!player) return
    
    // Check if requester is the host
    if (room.host !== socket.id) {
      emitError(socket, 'Only the host can start the game', 'NOT_HOST')
      return
    }
    
    // Check if game is already running
    if (room.gameState.isRunning) {
      emitError(socket, 'Game is already running', 'GAME_ALREADY_RUNNING')
      return
    }
    
    // Check if there are at least 2 players
    const playerCount = room.players.size
    if (playerCount < 2) {
      emitError(socket, 'Need at least 2 players to start the game', 'NOT_ENOUGH_PLAYERS')
      return
    }
    
    // Reset game state for new game
    room.eliminationOrder = [] // Clear previous elimination order
    
    // Regenerate the board (fresh map)
    room.gameState.board = generateBoard()
    
    // Clear all bombs and powerups
    room.gameState.bombs = []
    room.gameState.powerups = []
    
    // Reset player positions to spawn points and reset stats
    // First, separate human players from NPCs
    const humanPlayers = []
    const npcPlayers = []
    
    room.players.forEach((player, playerId) => {
      if (player.isNPC) {
        npcPlayers.push({ player, playerId })
      } else {
        humanPlayers.push({ player, playerId })
      }
    })
    
    // Reset human players to corners (starting from position 0)
    let posIndex = 0
    humanPlayers.forEach(({ player }) => {
      // Reset stats
      player.lives = 3
      player.alive = true
      
      // Reset position to spawn point
      player.x = startPos[posIndex].x
      player.y = startPos[posIndex].y
      posIndex = (posIndex + 1) % startPos.length
    })
    
    // Reset NPCs to remaining corners
    if (room.npcs && room.npcs.size > 0) {
      room.npcs.forEach((npc, npcId) => {
        // Reset stats
        npc.lives = 3
        npc.alive = true
        
        // Reposition NPC to next available corner
        // Find NPC's entry in room.players to update it too
        const npcPlayer = room.players.get(npcId)
        if (npcPlayer) {
          npc.position.x = startPos[posIndex].x
          npc.position.y = startPos[posIndex].y
          npcPlayer.x = startPos[posIndex].x
          npcPlayer.y = startPos[posIndex].y
          posIndex = (posIndex + 1) % startPos.length
        }
      })
    }
    
    // Start the game
    room.gameState.isRunning = true
    room.gameStartTime = Date.now() // Track when game started for timer synchronization
    syncRoomGameState(room)
    
    // Broadcast game started event to all players in room
    io.to(socket.roomCode).emit('game:started', {
      roomCode: socket.roomCode,
      players: Array.from(room.players.values()),
      board: room.gameState.board,
      gameMode: room.gameState.gameMode,
      chats: room.chats,
      powerups: room.gameState.powerups || [],
      gameStartTime: room.gameStartTime // Send server timestamp for timer sync
    })
    
    // Broadcast lobby update to all clients (lobby is no longer available)
    broadcastLobbyUpdate(io, rooms)
  })

	
}