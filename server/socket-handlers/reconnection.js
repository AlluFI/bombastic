/**
 * Reconnection Handlers
 * Handles player reconnection to existing rooms
 */

const { validateRoom, emitError } = require('../errorHandler')
const { syncRoomGameState, broadcastLobbyUpdate } = require('../utils')
const { logRoomEvent, logPlayerAction, logSocketEvent } = require('../logger')

// Store disconnected player info temporarily (for reconnection)
// Maps: playerName+roomCode -> { playerData, roomCode, disconnectedAt }
const disconnectedPlayers = new Map()

// Cleanup disconnected players after timeout (30 seconds)
const RECONNECTION_TIMEOUT_MS = 30 * 1000

function cleanupDisconnectedPlayers() {
  const now = Date.now()
  const toDelete = []
  
  disconnectedPlayers.forEach((data, key) => {
    if (now - data.disconnectedAt > RECONNECTION_TIMEOUT_MS) {
      toDelete.push(key)
    }
  })
  
  toDelete.forEach(key => {
    disconnectedPlayers.delete(key)
  })
}

// Run cleanup every 10 seconds
setInterval(cleanupDisconnectedPlayers, 10 * 1000)

/**
 * Store disconnected player data for potential reconnection
 * Called from disconnect handler in game.js
 */
function storeDisconnectedPlayer(player, roomCode) {
  if (!player || !roomCode) return
  
  const key = `${player.name.toLowerCase()}_${roomCode}`
  disconnectedPlayers.set(key, {
    playerData: { ...player }, // Copy player data
    roomCode,
    disconnectedAt: Date.now()
  })
}

module.exports = function reconnectionHandlers(io, socket, rooms) {
  /**
   * Handle player reconnection attempt
   * Client sends: { roomCode, playerName }
   */
  socket.on('room:rejoin', (data) => {
    // Validate input
    if (!data || typeof data !== 'object') {
      emitError(socket, 'Invalid rejoin data', 'INVALID_DATA')
      return
    }
    
    const { roomCode, playerName } = data
    
    if (!roomCode || !playerName) {
      emitError(socket, 'Room code and player name required', 'INVALID_DATA')
      return
    }
    
    logSocketEvent(socket.id, 'room:rejoin', { roomCode, playerName })
    
    // Check if room exists
    const room = rooms.get(roomCode)
    if (!room) {
      emitError(socket, 'Room not found', 'ROOM_NOT_FOUND')
      return
    }
    
    // Check if game is running (allow rejoin during game)
    if (!room.gameState.isRunning) {
      emitError(socket, 'Cannot rejoin lobby. Game must be running to rejoin.', 'GAME_NOT_RUNNING')
      return
    }
    
    // Look for disconnected player with matching name in this room
    const disconnectedKey = `${playerName.toLowerCase()}_${roomCode}`
    const disconnectedData = disconnectedPlayers.get(disconnectedKey)
    
    if (!disconnectedData) {
      emitError(socket, 'No reconnection data found. Room may have been deleted or timeout expired.', 'RECONNECTION_EXPIRED')
      return
    }
    
    // Check if a player with this name already exists in the room
    const existingPlayer = Array.from(room.players.values()).find(
      p => p.name.toLowerCase() === playerName.toLowerCase()
    )
    
    if (existingPlayer && existingPlayer.id !== socket.id) {
      // Someone else took this name, or player is already in room with different socket ID
      emitError(socket, 'Player name already taken in this room', 'NAME_TAKEN')
      disconnectedPlayers.delete(disconnectedKey)
      return
    }
    
    // Restore player data
    const playerData = disconnectedData.playerData
    playerData.id = socket.id // Update to new socket ID
    
    // Restore player to room
    room.players.set(socket.id, playerData)
    
    // Remove from disconnected players
    disconnectedPlayers.delete(disconnectedKey)
    
    // Join socket.io room
    socket.join(roomCode)
    socket.roomCode = roomCode
    
    // Sync game state
    syncRoomGameState(room)
    
    logPlayerAction(socket.id, playerName, 'rejoined room', { roomCode })
    logRoomEvent(roomCode, 'Player rejoined', { socketId: socket.id, playerName })
    
    // Send full game state to rejoining player
    socket.emit('room:rejoined', {
      roomCode,
      players: Array.from(room.players.values()),
      roomCode: roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode,
      gameState: room.gameState // Include full game state for game sync
    })
    
    // Notify other players that player rejoined
    socket.to(roomCode).emit('player:rejoined', {
      playerId: socket.id,
      playerName: playerData.name
    })
    
    // Notify all players in room of updated room state
    io.to(roomCode).emit('room:updated', {
      players: Array.from(room.players.values()),
      roomCode: roomCode,
      chats: room.chats,
      hostId: room.host,
      isRunning: room.gameState.isRunning,
      gameMode: room.gameState.gameMode
    })
    
    // Broadcast lobby update (if game not running, player count changed)
    if (!room.gameState.isRunning) {
      broadcastLobbyUpdate(io, rooms)
    }
  })
  
  return {
    storeDisconnectedPlayer
  }
}

// Export storeDisconnectedPlayer for use in game.js
module.exports.storeDisconnectedPlayer = storeDisconnectedPlayer
