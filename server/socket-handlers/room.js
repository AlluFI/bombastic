const {generateRoomCode, generateBoard, syncRoomGameState, colors, startPos, broadcastLobbyUpdate} = require('../utils.js')


module.exports = function roomHandlers(io, socket, rooms) {
	//Host new room
  socket.on('room:host', (data) => {
  console.log(`📥 Received room:host from ${socket.id}, name: ${data.name}`)
  const roomId = generateRoomCode() 
  console.log(`🏠 Creating room ${roomId} for host ${socket.id}`)
  
  // Create room data structure with a NEW Map for players
  rooms.set(roomId, {
    host: socket.id,
    players: new Map(),
    started: false,
    chats: [],
    
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
  
  // Add host as first player
  const playerData = {
    id: socket.id,
    name: data.name || `Player${room.players.size + 1}`,
    x: startPos[0].x,
    y: startPos[0].y,
    color: colors[0],
    lives: 3,
    alive: true
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

  //Join to room
  socket.on('room:join', (data) => {
  const roomId = data.roomId
  const room = rooms.get(roomId)
  
  if (!room) {
    socket.emit('error', { message: 'Room not found' })
    return
  }
  
  // Reject if single-player mode
  if (room.gameState.gameMode === 'single-player') {
    socket.emit('error', { message: 'Room is in single-player mode' })
    return
  }
    
    if (room.players.size === 4) {
      socket.emit('error', { message: "Lobby is full" })
      return
    }
  
  // Add new player to room
  room.players.set(socket.id, {
    id: socket.id,
    name: data.name,
    x: startPos[room.players.size].x,
    y: startPos[room.players.size].y,
    color: colors[room.players.size],
    lives: 3,
    alive: true
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