const bombHandlers = require('./bomb')
const chatHandlers = require('./chat')
const gameHandlers = require('./game')
const lobbyHandlers = require('./lobby')
const roomHandlers = require('./room')
const npcHandlers = require('./npc-handlers')
const playerHandlers = require('./player')
const powerupHandlers = require('./powerup')
const { cleanupRateLimit } = require('../rateLimiter.js')

function allHandlers(io, socket, rooms) {
    // Clean up rate limiting on disconnect
    socket.on('disconnect', () => {
      cleanupRateLimit(socket.id)
    })
    
    bombHandlers(io, socket, rooms)
    chatHandlers(io, socket, rooms)
    gameHandlers(io, socket, rooms)
    lobbyHandlers(io, socket, rooms)
    roomHandlers(io, socket, rooms)
    npcHandlers(io, socket, rooms)
    playerHandlers(io, socket, rooms)
    powerupHandlers(socket, io, rooms)
}

module.exports = allHandlers
