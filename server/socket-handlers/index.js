const bombHandlers = require('./bomb')
const chatHandlers = require('./chat')
const gameHandlers = require('./game')
const lobbyHandlers = require('./lobby')
const roomHandlers = require('./room')
const npcHandlers = require('./npc-handlers')
const playerHandlers = require('./player')

function allHandlers(io,socket,rooms) {
    bombHandlers(io, socket, rooms)
    chatHandlers(io, socket, rooms)
    gameHandlers(io, socket, rooms)
    lobbyHandlers(io, socket, rooms)
    roomHandlers(io, socket, rooms)
    npcHandlers(io, socket, rooms)
    playerHandlers(io,socket,rooms)
}

module.exports = allHandlers
