const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const {PORT, CORS_ORIGIN} = require('./config')
const CONSTANTS = require('./constants')
const allHandlers  = require('./socket-handlers')
const gameLoop = require('./game-loop')
const { logger } = require('./logger')


//socket.io setup
const app = express()

// Trust proxy for Fly.io
app.set('trust proxy', true)

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: CONSTANTS.PING_TIMEOUT_MS,
  pingInterval: 25000,
  cookie: false,
  allowUpgrades: true,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8,
  perMessageDeflate: false
})

// Serve all static files from the client folder
app.use(express.static(path.join(__dirname, '../client')))

const rooms = new Map()

// Health check endpoint (must be after rooms is defined)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    rooms: rooms.size,
    environment: process.env.NODE_ENV || 'development'
  })
})

// Log server start
logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server starting')

//Connect client
io.on('connection', socket => {
  logger.info({ socketId: socket.id, transport: socket.conn.transport.name }, 'Client connected')
  allHandlers(io, socket, rooms)
  
  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason, roomCount: rooms.size }, 'Client disconnected')
  })
})

// Periodic logging of active rooms for debugging
setInterval(() => {
  if (rooms.size > 0) {
    const roomSummary = Array.from(rooms.entries()).map(([code, room]) => ({
      code,
      players: room.players.size,
      started: room.started,
      gameMode: room.gameState?.gameMode
    }))
    logger.debug({ rooms: roomSummary, totalRooms: rooms.size }, 'Active rooms status')
  }
}, CONSTANTS.ROOM_STATUS_LOG_INTERVAL_MS) // Log every minute

gameLoop(io, rooms)

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server listening')
})  