const {validateRoom, validatePlayer, emitError} = require('../errorHandler.js')
const {isRateLimited} = require('../rateLimiter.js')
const {sanitizeChatMessage} = require('../validation.js')

module.exports = function chatHandlers(io, socket, rooms) {
	//Send a message 
  socket.on('chat:send', (data) => {
    // Rate limiting
    if (isRateLimited(socket, 'CHAT')) {
      return
    }
    
    // Validate input
    if (!data || typeof data !== 'object' || typeof data.chatMsg !== 'string') {
      emitError(socket, 'Invalid chat message data', 'INVALID_CHAT_DATA')
      return
    }
    
    // Sanitize message
    const sanitizedMessage = sanitizeChatMessage(data.chatMsg)
    if (!sanitizedMessage) {
      emitError(socket, 'Invalid chat message', 'INVALID_CHAT_MESSAGE')
      return
    }
    
    // Validate room and player
    const room = validateRoom(socket, socket.roomCode, rooms)
    if (!room) return
    
    const player = validatePlayer(socket, room)
    if (!player) return

    const chatMessage = {
      message: sanitizedMessage,
      by: player.name,
      playerId: socket.id,
      timestamp: Date.now()
    }

    // Store message in room history (limit to last 100 messages)
    if (!room.chats) {
      room.chats = []
    }
    room.chats.push(chatMessage)
    if (room.chats.length > 100) {
      room.chats.shift() // Remove oldest message
    }

    // Broadcast to room (including sender for consistency)
    io.to(socket.roomCode).emit('chat:toAll', chatMessage)
    
  })
}