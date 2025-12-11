const { createServer } = require("http")
const { Server } = require("socket.io")

const app = require('express')()
const httpServer = createServer(app)

const io = new Server(httpServer, {
    //options
})

io.on('connection', (socket) => {
    console.log('User connected', socket.id);

    socket.on('disconnect', (socket) => {
        console.log('User disconnected', socket.id);

        
    });

    
});


httpServer.listen(3000, () => {
    console.log('Server listening http://localhost:3000');
    
});