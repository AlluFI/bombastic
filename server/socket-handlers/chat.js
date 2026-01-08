

module.exports = function chatHandlers(io, socket, rooms) {
	//Send a message 
  socket.on('chat:send', (data) => {
    const room = rooms.get(socket.roomCode)
    if (!room) {
      console.log("error: room not found");
      socket.emit('error', { message: "room not found" })
      return
    } 
    

    const player = room.players.get(socket.id)
    if (!player) {
      console.log("error: player not found");
      socket.emit('error', { message: "player not found" })
      return
    } 

    const chatMessage = {
      message: data.chatMsg,
      by: player.name,
      timestamp: Date.now()
    }

    // Store message in room history
    room.chats.push(chatMessage)

    // Broadcast to room (including sender for consistency)
    io.to(socket.roomCode).emit('chat:toAll', chatMessage)
    
  })
}