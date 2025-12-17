const chatForm = document.getElementById('chat-form')
const chatMessages = document.getElementById('chat-messages')
const chatInput = document.getElementById('chat-input')

let chats = []

// Function to render a single chat message
function renderChatMessage(data) {
    const msgElement = document.createElement('div')
    msgElement.innerHTML = `<p>${data.by}: ${data.message}</p>`
    chatMessages.appendChild(msgElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
}

// Function to load chat history
export function loadChatHistory(chatHistory) {
    chats = chatHistory || []
    chatMessages.innerHTML = '' // Clear existing messages
    chats.forEach(msg => renderChatMessage(msg))
}

// Initialize chat with socket
export function initializeChat(socket) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault()

        const msg = chatInput.value.trim()
        if (!msg) return

        socket.emit('chat:send', { chatMsg: msg })
        chatInput.value = ""
    })

    // Receive messages from other players
    socket.on('chat:toAll', (data) => {
        chats.push(data)
        renderChatMessage(data)
    })
}








