const {syncRoomGameState, broadcastLobbyUpdate} = require('../utils.js')



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

    console.log(`${player.name} ${payload.paused ? 'paused' : 'resumed'} the game`)

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
      console.log(`${player.name} disconnected`)
      room.players.delete(socket.id)
      
      // Notify others
      socket.to(socket.roomCode).emit('player:left', socket.id)
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
  
    // Clean up from room
    const room = rooms.get(socket.roomCode);
    if (room) {
      // Remove player from room
      room.players.delete(socket.id);

      socket.to(socket.roomCode).emit('player:left', socket.id)

      
      // If host disconnected, handle room cleanup
      if (room.host === socket.id) {
        // Clean up NPCs
        room.npcs.clear();
        // Optionally: delete room or transfer host
      }
      
      // Sync game state
      syncRoomGameState(room);
      
      // Notify room
      io.to(socket.roomCode).emit('room:updated', {
        players: Array.from(room.players.values()),
        roomCode: socket.roomCode,
        chats: room.chats,
        hostId: room.host,
        isRunning: room.gameState.isRunning,
        gameMode: room.gameState.gameMode
      });
      
      // Broadcast lobby update (player left)
      broadcastLobbyUpdate(io, rooms)
      
      // If room is empty or host left, remove room
      if (room.players.size === 0 || room.host === socket.id) {
        rooms.delete(socket.roomCode)
        console.log(`🗑️ Room ${socket.roomCode} deleted (empty or host left)`)
        // Broadcast lobby update (room removed)
        broadcastLobbyUpdate(io, rooms)
      }
    }
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
    
    // Start the game
    room.gameState.isRunning = true
    syncRoomGameState(room)
    
    console.log(`🎮 Game started in room ${socket.roomCode} by host ${socket.id} with ${playerCount} players`)
    
    // Broadcast game started event to all players in room
    io.to(socket.roomCode).emit('game:started', {
      roomCode: socket.roomCode,
      players: Array.from(room.players.values()),
      board: room.gameState.board,
      gameMode: room.gameState.gameMode,
      chats: room.chats,
      powerups: room.gameState.powerups || []
    })
    
    // Broadcast lobby update to all clients (lobby is no longer available)
    broadcastLobbyUpdate(io, rooms)
  })

	
}