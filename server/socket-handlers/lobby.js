const {getActiveLobbies, syncRoomGameState, broadcastLobbyUpdate} = require('../utils')

module.exports = function lobbyHandlers(io, socket, rooms) {
	 // Handle lobby list request
  socket.on('lobby:list-request', () => {
    const activeLobbies = getActiveLobbies(rooms)
    socket.emit('lobby:list', activeLobbies)
  })

  socket.on('lobby:leave', () => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return
    
    console.log(`${player.name} leaving lobby ${socket.roomCode}`)
    
    // Remove player from room
    room.players.delete(socket.id)
    
    // Leave the socket.io room
    socket.leave(socket.roomCode)
    
    // Clear room code from socket
    const roomCode = socket.roomCode
    socket.roomCode = null
    
    // Notify others that player left
    socket.to(roomCode).emit('player:left', socket.id)
    
    // Check if room is now empty
    if (room.players.size === 0) {
      // Delete empty room
      rooms.delete(roomCode)
      console.log(`🗑️ Room ${roomCode} deleted (empty after lobby leave)`)
      // Broadcast lobby update (room removed)
      broadcastLobbyUpdate(io, rooms)
      return
    }
    
    // If the host left, transfer host to the next player
    if (room.host === socket.id) {
      const nextHost = room.players.keys().next().value
      room.host = nextHost
      console.log(`👑 Host transferred to ${nextHost} in room ${roomCode}`)
    }
    
    // Sync game state after player leaves
    syncRoomGameState(room)
    
    // Notify remaining players of updated room state
    io.to(roomCode).emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    })
    
    // Broadcast lobby update (player count changed)
    broadcastLobbyUpdate(io, rooms)
  })

}