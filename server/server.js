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
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false
})

// Serve all static files from the client folder
app.use(express.static(path.join(__dirname, '../client')))

const rooms = new Map()

//Connect client
io.on('connection', socket => {
  allHandlers(io, socket, rooms)
})

gameLoop(io, rooms)

server.listen(PORT)  