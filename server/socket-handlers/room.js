const {generateRoomCode, generateBoard, syncRoomGameState, colors, startPos, getNextAvailableColorIndex, getNextAvailablePositionIndex, broadcastLobbyUpdate} = require('../utils.js')
const {emitError} = require('../errorHandler.js')
const {sanitizePlayerName} = require('../validation.js')
const CONSTANTS = require('../constants.js')

module.exports = function roomHandlers(io, socket, rooms) {

    //======================
    //Host new room
    //======================
  socket.on('room:host', (data) => {
    // Validate input
    if (!data || typeof data !== 'object') {
      emitError(socket, 'Invalid room host data', 'INVALID_DATA')
      return
    }
    
    // Sanitize and validate player name
    const sanitizedName = sanitizePlayerName(data.name)
    if (!sanitizedName) {
      emitError(socket, `Player name must be between ${CONSTANTS.MIN_PLAYER_NAME_LENGTH} and ${CONSTANTS.MAX_PLAYER_NAME_LENGTH} characters`, 'INVALID_PLAYER_NAME')
      return
    }
    
    console.log(`📥 Received room:host from ${socket.id}, name: ${sanitizedName}`)
    const roomId = generateRoomCode() 
    console.log(`🏠 Creating room ${roomId} for host ${socket.id}`)
    
    // Create room data structure with a NEW Map for players
    const now = Date.now()
    rooms.set(roomId, {
      host: socket.id,
      players: new Map(),
      started: false,
      chats: [],
      eliminationOrder: [], // Track order of player eliminations (last eliminated = winner)
      createdAt: now, // Track when room was created for cleanup
      
      // Full game state for NPCs
      gameState: {
        players: [],      // Array format (synced from players Map)
        bombs: [],
        powerups: [],
        board: generateBoard(), // Generate board once when room is created
        gameMode: 'multiplayer', // 'multiplayer' | 'single-player'
        isRunning: false,
        isPaused: false, // Pause state
      },
      // NPC instances (only for single-player mode)
      npcs: new Map(),    // npc.id -> NPC instance
    })
    
    const room = rooms.get(roomId)
    
    // Add host as first player (no uniqueness check needed - room is empty)
    const playerData = {
      id: socket.id,
      name: sanitizedName,
      x: startPos[0].x,
      y: startPos[0].y,
      color: colors[0],
      lives: CONSTANTS.DEFAULT_LIVES,
      alive: true,
      bombRange: 2,
      immortal: false,
      immortalEnd: 0
    }
    room.players.set(socket.id, playerData)
    console.log(`👤 Added host as player:`, playerData)
  
  // Sync game state after room creation
  syncRoomGameState(room)
  console.log(`🔄 Synced game state. Players in gameState:`, room.gameState.players.map(p => ({ id: p.id, name: p.name })))
  
  //  JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  // STORE ROOM CODE ON SOCKET (for later use)
  socket.roomCode = roomId
  
  // Send room info back to client
  const responseData = {
    roomCode: roomId,
    players: Array.from(room.players.values()),
    chats: room.chats,
    hostId: room.host,
    isRunning: room.gameState.isRunning,
    gameMode: room.gameState.gameMode
  }
  console.log(`📤 Emitting room:created to ${socket.id} with players:`, responseData.players.map(p => ({ id: p.id, name: p.name })))
  socket.emit('room:created', responseData)
  console.log(`✅ room:created event sent`)
  
  // Broadcast lobby update to all clients
  broadcastLobbyUpdate(io, rooms)
})

     //=======================
    //Join to room
    //========================
  socket.on('room:join', (data) => {
    // Validate input
    if (!data || typeof data !== 'object') {
      emitError(socket, 'Invalid room join data', 'INVALID_DATA')
      return
    }
    
    // Validate room code
    const {validateRoomCode} = require('../validation.js')
    if (!validateRoomCode(data.roomId)) {
      emitError(socket, 'Invalid room code format', 'INVALID_ROOM_CODE')
      return
    }
    
    // Sanitize and validate player name
    const sanitizedName = sanitizePlayerName(data.name)
    if (!sanitizedName) {
      emitError(socket, `Player name must be between ${CONSTANTS.MIN_PLAYER_NAME_LENGTH} and ${CONSTANTS.MAX_PLAYER_NAME_LENGTH} characters`, 'INVALID_PLAYER_NAME')
      return
    }
    
    const roomId = data.roomId
    const room = rooms.get(roomId)
    
    if (!room) {
      emitError(socket, 'Room not found', 'ROOM_NOT_FOUND')
      return
    }
    
    // Reject if single-player mode
    if (room.gameState.gameMode === 'single-player') {
      emitError(socket, 'Room is in single-player mode', 'SINGLE_PLAYER_MODE')
      return
    }
      
    if (room.players.size >= CONSTANTS.MAX_PLAYERS_PER_ROOM) {
      emitError(socket, 'Lobby is full', 'LOBBY_FULL')
      return
    }
    
    // Check if player name is already taken in this room (case-insensitive)
    const existingNames = Array.from(room.players.values()).map(p => p.name.toLowerCase().trim())
    if (existingNames.includes(sanitizedName.toLowerCase().trim())) {
      emitError(socket, 'Player name already taken in this room. Please choose a different name.', 'NAME_TAKEN')
      return
    }
  
    // Find next available color and position
    const colorIndex = getNextAvailableColorIndex(room.players)
    const posIndex = getNextAvailablePositionIndex(room.players)
  
    // Add new player to room
    room.players.set(socket.id, {
      id: socket.id,
      name: sanitizedName,
      x: startPos[posIndex].x,
      y: startPos[posIndex].y,
      color: colors[colorIndex],
      lives: CONSTANTS.DEFAULT_LIVES,
      alive: true,
      bombRange: 2,
      immortal: false,
      immortalEnd: 0
    })
  
  // Sync game state after player joins
  syncRoomGameState(room)
  
  // JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  //  STORE ROOM CODE ON SOCKET
    socket.roomCode = roomId
        
  // Notify all players in this room
  io.to(roomId).emit('room:updated', {
    players: Array.from(room.players.values()),
    roomCode : roomId,
    chats: room.chats,
    hostId: room.host,
    isRunning: room.gameState.isRunning,
    gameMode: room.gameState.gameMode
  })
  
  // Broadcast lobby update to all clients (player count changed)
  broadcastLobbyUpdate(io, rooms)
})
  
}