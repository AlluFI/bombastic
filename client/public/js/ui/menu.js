
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
    console.log('player mode changed to :' + selectedMode)
}

function handleDifficultyChange() {
    playerData.difficulty = difficultySelect.value
    console.log('difficulty changed to :' + difficultySelect.value)
}

export function intializeMenu() {
    console.log('menue intialized')

    //start button is disabled by default 
    //input checks if the length of the input is 2 or more to enable start playing
    playerNameInput.addEventListener('input', () => {
    const name = playerNameInput.value.trim()
    startButton.disabled = name.length < 2
    })
    modeSelect.addEventListener('change', handleModeChange)
    difficultySelect.addEventListener('change', handleDifficultyChange)
    startButton.addEventListener('click', handleStartGame)
}