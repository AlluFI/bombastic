
import { socket } from '../main.js'

//ui screen sections
const menuScreen = document.getElementById('menue-screen')
const gameScreen = document.getElementById('game-screen')
const endScreen = document.getElementById('end-screen')

//game control elements
const playerNameInput = document.getElementById('player-name')
const modeSelect = document.getElementById('mode')
const difficultySection = document.getElementById('difficulty-section')
const difficultySelect = document.getElementById('difficulty')
const startButton = document.getElementById('start-button')
const joinButton = document.getElementById('join-button')
const hostButton = document.getElementById('host-button')
const joinInput = document.getElementById('join-input')
// const startGameBtn = document.getElementById('start-game-button')

//player choices
export const playerData = {
    name: '',
    mode: 'multi', //multi player mode set to default
    difficulty: 'easy' //multi mode has only one level
}


export function showMenuScreen() {
    menuScreen.classList.remove('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.add('hidden')
}

export function showGameScreen() {
    menuScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    endScreen.classList.add('hidden')
}

export function showEndScreen() {
    menuScreen.classList.add('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.remove('hidden')
}

function handleStartGame() {
    console.log('start button clicked')

    playerData.name = playerNameInput.value.trim()
    playerData.mode = modeSelect.value
    playerData.difficulty = difficultySelect.value

    console.log('player data recorder', playerData)    

    //enable gamescreen
    
        socket.emit('player:join', {
        name: playerData.name,
    }) 
}

function handleModeChange() {
    const selectedMode = modeSelect.value
    difficultySection.classList.toggle('hidden', selectedMode !== 'single')
    startButton.classList.toggle('hidden', selectedMode !== 'single')
    joinButton.classList.toggle('hidden', selectedMode !== 'multi')
    hostButton.classList.toggle('hidden', selectedMode !== 'multi')
    joinInput.classList.toggle('hidden', selectedMode !== 'multi')

    console.log('player mode changed to :' + selectedMode)
}

function handleDifficultyChange() {
    playerData.difficulty = difficultySelect.value
    console.log('difficulty changed to :' + difficultySelect.value)
}

function handleHostGame() {

    playerData.name = playerNameInput.value.trim()
    socket.emit('game:host', {
        name: playerData.name
    })
}

function handleJoinGame() {

    playerData.name = playerNameInput.value.trim()
    const roomId = joinInput.value.trim()

    if (roomId) {
     socket.emit('game:join',{
        roomId: roomId,
        name: playerData.name,
 })
}
    console.log("Room ID:", roomId);   
}

export function intializeMenu() {
    console.log('menue intialized')

    //start button is disabled by default 
    //input checks if the length of the input is 2 or more to enable start playing
    playerNameInput.addEventListener('input', () => {
    const name = playerNameInput.value.trim()
        startButton.disabled = name.length < 2
        hostButton.disabled = name.length < 2
    })

    //join button is disabled by default
    joinInput.addEventListener('input', () => {
        hostButton.disabled = joinInput.value
        joinButton.disabled = joinInput.value.trim() < 2
    })
    modeSelect.addEventListener('change', handleModeChange)
    difficultySelect.addEventListener('change', handleDifficultyChange)
    startButton.addEventListener('click', handleStartGame)
    hostButton.addEventListener('click', handleHostGame)
    joinButton.addEventListener('click', handleJoinGame)
    startGameBtn.addEventListener('click', )
}