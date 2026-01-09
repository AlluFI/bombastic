const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const {PORT} = require('./config')
const allHandlers  = require('./socket-handlers')
const gameLoop = require('./game-loop')

//socket.io setup
const app = express()
const server = http.createServer(app)
const io = new Server(server)

// Serve all static files from the client folder
app.use(express.static(path.join(__dirname, '../client')))

const rooms = new Map()

//Connect client
io.on('connection', socket => {
  allHandlers(io, socket, rooms)
})

gameLoop(io, rooms)

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`)
  console.log(`\n🌐 To play on local network:`)
  console.log(`   1. Find your IP address (ifconfig/ipconfig)`)
  console.log(`   2. Open http://[YOUR_IP]:${PORT} on other devices`)
  console.log(`   3. Make sure devices are on the same WiFi network\n`)
})

 