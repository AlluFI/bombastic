const path = require('path')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const {PORT, CORS_ORIGIN} = require('./config')
const CONSTANTS = require('./constants')
const allHandlers  = require('./socket-handlers')
const gameLoop = require('./game-loop')
const { logger } = require('./logger')
const metrics = require('./metrics')
const auth = require('./auth')


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

// Metrics endpoint
app.get('/metrics', (req, res) => {
  // Update active counts before returning metrics
  let totalPlayers = 0
  rooms.forEach(room => {
    totalPlayers += room.players.size
  })
  metrics.updateActiveCounts(rooms.size, totalPlayers)
  
  res.status(200).json(metrics.getMetrics())
})

// Log server start
logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server starting')

//Connect client
io.on('connection', socket => {
  logger.info({ socketId: socket.id, transport: socket.conn.transport.name }, 'Client connected')
  metrics.recordConnection()
  
  // Create session for this connection
  const sessionId = auth.createSession(socket.id)
  socket.sessionId = sessionId
  socket.emit('auth:session', { sessionId })
  
  allHandlers(io, socket, rooms)
  
  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason, roomCount: rooms.size }, 'Client disconnected')
    metrics.recordDisconnection()
    
    // Cleanup session on disconnect
    if (socket.sessionId) {
      auth.deleteSession(socket.sessionId)
    }
  })
})

// Store interval ID for cleanup
let statusLogIntervalId = null

// Periodic logging of active rooms for debugging and metrics update
statusLogIntervalId = setInterval(() => {
  // Update metrics with current counts
  let totalPlayers = 0
  rooms.forEach(room => {
    totalPlayers += room.players.size
  })
  metrics.updateActiveCounts(rooms.size, totalPlayers)
  
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

const gameLoopCleanup = gameLoop(io, rooms)

// Graceful shutdown handler
function gracefulShutdown() {
  logger.info('Shutting down gracefully...')
  
  // Clear intervals
  if (statusLogIntervalId) {
    clearInterval(statusLogIntervalId)
    statusLogIntervalId = null
  }
  
  if (gameLoopCleanup && gameLoopCleanup.cleanup) {
    gameLoopCleanup.cleanup()
  }
  
  // Cleanup reconnection handler intervals
  const reconnectionHandlers = require('./socket-handlers/reconnection.js')
  if (reconnectionHandlers.cleanup) {
    reconnectionHandlers.cleanup()
  }
  
  // Close server
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server listening')
})  