const {getActiveLobbies, syncRoomGameState, broadcastLobbyUpdate} = require('../utils')
const { logPlayerAction, logRoomEvent } = require('../logger')

module.exports = function lobbyHandlers(io, socket, rooms) {
	 // Handle lobby list request
  socket.on('lobby:list-request', () => {
    const activeLobbies = getActiveLobbies(rooms)
    logRoomEvent('LOBBY', 'List requested', { totalRooms: rooms.size, activeLobbies: activeLobbies.length, socketId: socket.id })
    socket.emit('lobby:list', activeLobbies)
  })

  // Handle room state request (for returning to lobby from end screen)
  socket.on('room:state-request', () => {
    const room = rooms.get(socket.roomCode)
    if (!room) {
      socket.emit('error', { message: 'Room not found' })
      return
    }
    
    // Send current room state back to the requesting player
    socket.emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: socket.roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    })
  })

  socket.on('lobby:leave', () => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return
    
    // logPlayerAction(socket.id, player.name, 'leaving lobby', { roomId: socket.roomCode })
    
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
      // logRoomEvent(roomCode, 'Room deleted (empty after lobby leave)')
      // Broadcast lobby update (room removed)
      broadcastLobbyUpdate(io, rooms)
      return
    }
    
    // If the host left, transfer host to the next player
    if (room.host === socket.id) {
      const nextHost = room.players.keys().next().value
      room.host = nextHost
      // logRoomEvent(roomCode, 'Host transferred', { newHostId: nextHost, previousHostId: socket.id })
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