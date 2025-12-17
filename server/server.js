const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

//socket.io setup
const app = express()
const server = http.createServer(app)
const io = new Server(server)

const PORT = process.env.PORT || 3000

// Serve all static files from the client folder
app.use(express.static(path.join(__dirname, '../client')))

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Game state

const rooms = new Map()
const allPlayers = new Map()

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


//Connect client
io.on('connection', socket => {
 
  // Initialize new player
  socket.on('player:join', (data) => {
      
    if (allPlayers.size === 4) {
      socket.emit('error', {message: "Lobby is full"})
      return
    }
 
      // Get the next available spawn position & colo
      const spawnIndex = allPlayers.size % startPos.length
      const colorIndex = allPlayers.size % colors.length
      const color = colors[colorIndex]
      const spawn = startPos[spawnIndex]
      
    allPlayers.set(socket.id, {
      id: socket.id,
      name: data.name || `Player${allPlayers.size + 1}`,
      x: spawn.x,
      y: spawn.y,
      color: color
      
    })

        // Send current allPlayers to new player
        socket.emit('game:state', {        
      allPlayers: Array.from(allPlayers.values())
    })

    // Broadcast new player to others
    socket.broadcast.emit('player:joined', allPlayers.get(socket.id))
    
    console.log(`${allPlayers.get(socket.id).name} joined at (${allPlayers.get(socket.id).x}, ${allPlayers.get(socket.id).y})`)
  })

  //Room logic
  socket.on('room:host', (data) => {
  const roomId = generateRoomCode() 
  
  // Create room data structure with a NEW Map for players
  rooms.set(roomId, {
    host: socket.id,
    players: new Map(),
    started: false
  })
  
  const room = rooms.get(roomId)
  
  // Add host as first player
  room.players.set(socket.id, {
    id: socket.id,
    name: data.name,
    x: startPos[0].x,
    y: startPos[0].y,
    color: colors[0]
  })
  
  //  JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  // STORE ROOM CODE ON SOCKET (for later use)
  socket.roomCode = roomId
  
  // Send room info back to client
  socket.emit('room:created', {
    roomCode: roomId,
    players: Array.from(room.players.values())
  })
})

  socket.on('room:join', (data) => {
  const roomId = data.roomId
  const room = rooms.get(roomId)
  
  if (!room) {
    socket.emit('error', { message: 'Room not found' })
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
    color: colors[room.players.size]
  })
  
  // JOIN THE SOCKET.IO ROOM
  socket.join(roomId)
  
  //  STORE ROOM CODE ON SOCKET
    socket.roomCode = roomId
        
  // Notify all players in this room
  io.to(roomId).emit('room:updated', {
    players: Array.from(room.players.values()),
    roomCode : roomId
  })
})
  

  // Handle player movement
  socket.on('player:move', (moveData) => {
    const room = rooms.get(socket.roomCode)
    if (!room) return
    
    const player = room.players.get(socket.id)
    if (!player) return

    player.x = moveData.x
    player.y = moveData.y

    // Broadcast movement to players in the same room only
    socket.to(socket.roomCode).emit('player:moved', {
      id: socket.id,
      x: moveData.x,
      y: moveData.y
    })
  })

  // Handle game pause/resume
  socket.on('game:pause', (payload) => {
    const player = allPlayers.get(socket.id)
    if (!player) return

    console.log(`${player.name} ${payload.paused ? 'paused' : 'resumed'} the game`)

    // Broadcast to ALL clients (including sender) for sync
    io.emit('game:pause', {
      paused: !!payload.paused,
      by: socket.id,
      ts: Date.now(),
      name: player.name
    })
  })

  socket.on('game:quit', () => {
    const player = allPlayers.get(socket.id)
    if (player) {
      console.log(`${player.name} disconnected`)
      allPlayers.delete(socket.id)
      
      // Notify others
      socket.broadcast.emit('player:left', socket.id)
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    const player = allPlayers.get(socket.id)
    if (player) {
      console.log(`${player.name} disconnected`)
      allPlayers.delete(socket.id)
      
      // Notify others
      socket.broadcast.emit('player:left', socket.id)
    }
  })

})

server.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`))