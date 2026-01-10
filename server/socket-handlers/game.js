const {syncRoomGameState, broadcastLobbyUpdate, generateBoard, startPos} = require('../utils.js')
const { logPlayerAction, logRoomEvent } = require('../logger')



module.exports = function gameHandlers(io, socket, rooms) {
    //=============================
    // Handle game pause/resume
    //=============================
  socket.on('game:pause', (payload) => {

    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
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

    logPlayerAction(socket.id, player.name, `${payload.paused ? 'paused' : 'resumed'} the game`, { roomId: socket.roomCode })

    // Broadcast to ALL clients (including sender) for sync
    io.to(socket.roomCode).emit('game:pause', {
      paused: !!payload.paused,
      by: socket.id,
      ts: Date.now(),
      name: player.name
    })
  })
    
    socket.on('game:quit', () => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (player) {
      logPlayerAction(socket.id, player.name, 'quit game', { roomId: socket.roomCode })
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
    
    if (player) {
      logPlayerAction(socket.id, player.name, 'disconnected from room', { roomId: roomCode })
    }
    
    // Remove player from room
    room.players.delete(socket.id);

    // Notify others that player left
    socket.to(roomCode).emit('player:left', socket.id)
    
    // Check if room is now empty
    if (room.players.size === 0) {
      // Delete empty room
      rooms.delete(roomCode)
      logRoomEvent(roomCode, 'Room deleted (empty after disconnect)')
      // Broadcast lobby update (room removed)
      broadcastLobbyUpdate(io, rooms)
      return
    }
    
    // If the host disconnected, transfer host to the next player
    if (room.host === socket.id) {
      const nextHost = room.players.keys().next().value
      room.host = nextHost
      logRoomEvent(roomCode, 'Host transferred', { newHostId: nextHost, previousHostId: socket.id })
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
    const room = rooms.get(socket.roomCode)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    
    // Check if requester is the host
    if (room.host !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' })
      return
    }
    
    // Check if game is already running
    if (room.gameState.isRunning) {
      socket.emit('error', { message: 'Game is already running' })
      return
    }
    
    // Check if there are at least 2 players
    const playerCount = room.players.size
    if (playerCount < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start the game' })
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
    let posIndex = 0
    room.players.forEach(player => {
      // Reset stats
      player.lives = 3
      player.alive = true
      
      // Reset position to spawn point
      player.x = startPos[posIndex].x
      player.y = startPos[posIndex].y
      posIndex = (posIndex + 1) % startPos.length
    })
    
    // Reset NPCs if any exist
    if (room.npcs) {
      room.npcs.forEach(npc => {
        npc.lives = 3
        npc.alive = true
        // NPCs will get repositioned by the NPC system
      })
    }
    
    // Start the game
    room.gameState.isRunning = true
    room.gameStartTime = Date.now() // Track when game started for timer synchronization
    syncRoomGameState(room)
    
    logRoomEvent(socket.roomCode, 'Game started', { hostId: socket.id, playerCount, gameMode: room.gameState.gameMode })
    
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