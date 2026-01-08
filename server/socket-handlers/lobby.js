const {getActiveLobbies} = require('../utils')

module.exports = function lobbyHandlers(io, socket, rooms) {
	 // Handle lobby list request
  socket.on('lobby:list-request', () => {
    const activeLobbies = getActiveLobbies(rooms)
    socket.emit('lobby:list', activeLobbies)
  })

}