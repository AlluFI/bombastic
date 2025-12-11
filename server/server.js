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

// Game state
const allPlayers = new Map()
const startPos = [
    { x: 1, y: 1, },
    { x: 1, y: 13 },
    { x: 11, y: 1 },
    { x: 11, y: 13 },
]
const colors = [
    'blue',
    'red',
    'green',
    'yellow',
    'purple',
    'orange']

io.on('connection', socket => {
 
  // Initialize new player
    socket.on('player:join', () => {
       

      // Get the next available spawn position & colo
      const spawnIndex = allPlayers.size % startPos.length
      const colorIndex = allPlayers.size % colors.length
      const color = colors[colorIndex]
      const spawn = startPos[spawnIndex]
      
    allPlayers.set(socket.id, {
      id: socket.id,
      name: `Player${allPlayers.size + 1}`,
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

  // Handle player movement
  socket.on('player:move', (moveData) => {
    const player = allPlayers.get(socket.id)
    if (!player) return

    player.x = moveData.x
    player.y = moveData.y

    // Broadcast movement to all other clients
    socket.broadcast.emit('player:moved', {
      id: socket.id,
      x: moveData.x,
      y: moveData.y
    })
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