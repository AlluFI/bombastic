
import { socket } from '../main.js'
import { clearAllPlayers } from '../player.js'
import { initializeLobbyBrowser } from './lobbyBrowser.js'
import { playSound } from '../audio/soundManager.js'
import { returnToLobby } from './lobby.js'

//ui screen sections
const menuScreen = document.getElementById('menue-screen')
const gameScreen = document.getElementById('game-screen')
const endScreen = document.getElementById('end-screen')
const codeElement= document.getElementById('room-code')

//game control elements
const playerNameInput = document.getElementById('player-name')
const playerNameJoinInput = document.getElementById('player-name-join')
const playerNameSingleInput = document.getElementById('player-name-single')
const modeSelect = document.getElementById('mode')
const multiModeBtn = document.getElementById('multi-mode-btn')
const singleModeBtn = document.getElementById('single-mode-btn')
const multiPlayerSection = document.getElementById('multi-player-section')
const singlePlayerSection = document.getElementById('single-player-section')
const npcCountSelect = document.getElementById('npc-count')
const npcDifficultiesSection = document.getElementById('npc-difficulties-section')
const npcDifficultyList = document.getElementById('npc-difficulty-list')
const npcCustomConfig = document.getElementById('npc-custom-config')
const npcPresetConfig = document.getElementById('npc-preset-config')
const customModeBtn = document.getElementById('custom-mode-btn')
const presetModeBtn = document.getElementById('preset-mode-btn')
const npcPresetList = document.getElementById('npc-preset-list')
const startButton = document.getElementById('start-button')
const joinButton = document.getElementById('join-button')
const hostButton = document.getElementById('host-button')
const joinInput = document.getElementById('join-input')
const restartButton = document.getElementById('restart-button')


// const startGameBtn = document.getElementById('start-game-button')

//player choices
export const playerData = {
    name: '',
    mode: 'multi', //multi player mode set to default
    difficulties: ['medium', 'medium'], //default difficulties for each NPC
    strategies: ['balanced', 'balanced'], //default strategies for each NPC
    npcNames: ['Bot 1', 'Bot 2'], //default names for each NPC
    npcCount: 2, //default number of NPCs for single-player
    usePresets: false //whether to use preset configurations
}

// Preset NPC configurations
const NPC_PRESETS = [
    {
        id: 'aggressor',
        name: 'The Aggressor',
        difficulty: 'hard',
        strategy: 'aggressive',
        description: 'High difficulty, aggressive playstyle'
    },
    {
        id: 'defender',
        name: 'The Defender',
        difficulty: 'easy',
        strategy: 'defensive',
        description: 'Low difficulty, defensive playstyle'
    },
    {
        id: 'collector',
        name: 'The Collector',
        difficulty: 'medium',
        strategy: 'powerup-hunter',
        description: 'Medium difficulty, prioritizes powerups'
    },
    {
        id: 'trapper',
        name: 'The Trapper',
        difficulty: 'hard',
        strategy: 'trapper',
        description: 'High difficulty, strategic bomb placement'
    },
    {
        id: 'balanced',
        name: 'The Balanced',
        difficulty: 'medium',
        strategy: 'balanced',
        description: 'Medium difficulty, balanced playstyle'
    }
]




export function showMenuScreen() {
    menuScreen.classList.remove('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.add('hidden')
    
    // Play menu open sound
    playSound('menuOpen', { volume: 0.5 })
    
    // Show chat when returning to menu (for multiplayer)
    import('./chat.js').then(({ setChatVisibility }) => {
        setChatVisibility(true)
    })
}

export function showGameScreen(roomCode, gameMode = null) {
    menuScreen.classList.add('hidden')
    gameScreen.classList.remove('hidden')
    endScreen.classList.add('hidden')
    
    if (roomCode) {
        codeElement.textContent = `Room code: ${roomCode}`
    }
    
    // Initialize mobile controls when game screen is shown
    import('../ui/mobile-controls.js').then(({ initializeMobileControls }) => {
        initializeMobileControls()
    })
    
    // Hide chat in single-player mode, show in multiplayer
    // Check both playerData.mode (client-side) and gameMode (server-side)
    import('./chat.js').then(({ setChatVisibility }) => {
        const isSinglePlayer = gameMode === 'single-player' || playerData.mode === 'single'
        setChatVisibility(!isSinglePlayer)
    })
}

export function showEndScreen() {
    menuScreen.classList.add('hidden')
    gameScreen.classList.add('hidden')
    endScreen.classList.remove('hidden')
}

function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading')
        button.disabled = true
    } else {
        button.classList.remove('loading')
        button.disabled = false
    }
}

export function clearButtonLoading() {
    // Clear loading state from all menu buttons
    setButtonLoading(startButton, false)
    setButtonLoading(hostButton, false)
    setButtonLoading(joinButton, false)
}

function handleStartGame() {
    playerData.name = playerNameSingleInput.value.trim()
    playerData.mode = modeSelect.value
    playerData.npcCount = parseInt(npcCountSelect.value, 10)
    
    if (playerData.usePresets) {
        // Collect preset selections
        playerData.difficulties = []
        playerData.strategies = []
        playerData.npcNames = []
        
        for (let i = 0; i < playerData.npcCount; i++) {
            const presetSelect = document.getElementById(`npc-preset-${i}`)
            if (presetSelect && presetSelect.value) {
                const preset = NPC_PRESETS.find(p => p.id === presetSelect.value)
                if (preset) {
                    playerData.difficulties.push(preset.difficulty)
                    playerData.strategies.push(preset.strategy)
                    playerData.npcNames.push(preset.name)
                } else {
                    // Fallback
                    playerData.difficulties.push('medium')
                    playerData.strategies.push('balanced')
                    playerData.npcNames.push(`Bot ${i + 1}`)
                }
            } else {
                playerData.difficulties.push('medium')
                playerData.strategies.push('balanced')
                playerData.npcNames.push(`Bot ${i + 1}`)
            }
        }
    } else {
        // Collect individual customizations
        playerData.difficulties = []
        playerData.strategies = []
        playerData.npcNames = []
        
        for (let i = 0; i < playerData.npcCount; i++) {
            const difficultySelect = document.getElementById(`npc-difficulty-${i}`)
            const strategySelect = document.getElementById(`npc-strategy-${i}`)
            const nameInput = document.getElementById(`npc-name-${i}`)
            
            if (difficultySelect) {
                playerData.difficulties.push(difficultySelect.value)
            } else {
                playerData.difficulties.push('medium')
            }
            
            if (strategySelect) {
                playerData.strategies.push(strategySelect.value)
            } else {
                playerData.strategies.push('balanced')
            }
            
            if (nameInput) {
                const name = nameInput.value.trim() || `Bot ${i + 1}`
                playerData.npcNames.push(name)
            } else {
                playerData.npcNames.push(`Bot ${i + 1}`)
            }
        }
    }

    // Set loading state
    setButtonLoading(startButton, true)

    // For single-player mode:
    // 1. First create a room (host)
    socket.emit('room:host', {
        name: playerData.name
    })
    
    // The rest will be handled in the 'room:created' event handler in main.js
}

function handleModeChange() {
    const selectedMode = modeSelect.value
    const isSinglePlayer = selectedMode === 'single'
    
    // Update button styles
    if (isSinglePlayer) {
        singleModeBtn.classList.add('active')
        multiModeBtn.classList.remove('active')
    } else {
        multiModeBtn.classList.add('active')
        singleModeBtn.classList.remove('active')
    }
    
    // Show/hide single-player specific UI
    singlePlayerSection.classList.toggle('hidden', !isSinglePlayer)
    
    // Show/hide multiplayer specific UI
    multiPlayerSection.classList.toggle('hidden', isSinglePlayer)

}

function updateNPCDifficultySelectors() {
    const count = parseInt(npcCountSelect.value, 10)
    playerData.npcCount = count
    
    // Ensure arrays match count
    while (playerData.difficulties.length < count) {
        playerData.difficulties.push('medium')
    }
    playerData.difficulties = playerData.difficulties.slice(0, count)
    
    while (playerData.strategies.length < count) {
        playerData.strategies.push('balanced')
    }
    playerData.strategies = playerData.strategies.slice(0, count)
    
    while (playerData.npcNames.length < count) {
        playerData.npcNames.push(`Bot ${playerData.npcNames.length + 1}`)
    }
    playerData.npcNames = playerData.npcNames.slice(0, count)
    
    // Update based on current mode
    if (playerData.usePresets) {
        updatePresetSelectors()
    } else {
        updateCustomSelectors()
    }
}

function updateCustomSelectors() {
    const count = playerData.npcCount
    npcDifficultyList.innerHTML = ''
    
    for (let i = 0; i < count; i++) {
        const container = document.createElement('div')
        container.className = 'npc-difficulty-item'
        container.style.marginBottom = '15px'
        container.style.padding = '12px'
        container.style.backgroundColor = 'rgba(0, 119, 182, 0.1)'
        container.style.borderRadius = '6px'
        container.style.border = '1px solid rgba(0, 191, 255, 0.2)'
        
        // Bot header
        const botHeader = document.createElement('div')
        botHeader.textContent = `Bot ${i + 1}`
        botHeader.style.fontWeight = 'bold'
        botHeader.style.color = '#00bfff'
        botHeader.style.marginBottom = '10px'
        botHeader.style.fontSize = '14px'
        container.appendChild(botHeader)
        
        // Name input
        const nameLabel = document.createElement('label')
        nameLabel.textContent = 'Name:'
        nameLabel.style.display = 'block'
        nameLabel.style.marginBottom = '5px'
        nameLabel.style.color = '#00bfff'
        nameLabel.style.fontSize = '13px'
        
        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.id = `npc-name-${i}`
        nameInput.value = playerData.npcNames[i] || `Bot ${i + 1}`
        nameInput.style.width = '100%'
        nameInput.style.padding = '6px'
        nameInput.style.fontSize = '14px'
        nameInput.style.backgroundColor = 'rgba(0, 119, 182, 0.2)'
        nameInput.style.color = '#00bfff'
        nameInput.style.border = '2px solid #0077b6'
        nameInput.style.borderRadius = '4px'
        nameInput.style.marginBottom = '8px'
        nameInput.maxLength = 15
        
        nameInput.addEventListener('input', () => {
            playerData.npcNames[i] = nameInput.value.trim() || `Bot ${i + 1}`
        })
        
        // Difficulty selector
        const difficultyLabel = document.createElement('label')
        difficultyLabel.textContent = 'Difficulty:'
        difficultyLabel.style.display = 'block'
        difficultyLabel.style.marginBottom = '5px'
        difficultyLabel.style.color = '#00bfff'
        difficultyLabel.style.fontSize = '13px'
        
        const difficultySelect = document.createElement('select')
        difficultySelect.id = `npc-difficulty-${i}`
        difficultySelect.style.width = '100%'
        difficultySelect.style.padding = '6px'
        difficultySelect.style.fontSize = '14px'
        difficultySelect.style.backgroundColor = 'rgba(0, 119, 182, 0.2)'
        difficultySelect.style.color = '#00bfff'
        difficultySelect.style.border = '2px solid #0077b6'
        difficultySelect.style.borderRadius = '4px'
        difficultySelect.style.marginBottom = '8px'
        
        const difficultyOptions = [
            { value: 'easy', text: 'Easy' },
            { value: 'medium', text: 'Medium' },
            { value: 'hard', text: 'Hard' }
        ]
        
        difficultyOptions.forEach(opt => {
            const option = document.createElement('option')
            option.value = opt.value
            option.textContent = opt.text
            if (opt.value === (playerData.difficulties[i] || 'medium')) {
                option.selected = true
            }
            difficultySelect.appendChild(option)
        })
        
        difficultySelect.addEventListener('change', () => {
            playerData.difficulties[i] = difficultySelect.value
        })
        
        // Strategy selector
        const strategyLabel = document.createElement('label')
        strategyLabel.textContent = 'Strategy:'
        strategyLabel.style.display = 'block'
        strategyLabel.style.marginBottom = '5px'
        strategyLabel.style.color = '#00bfff'
        strategyLabel.style.fontSize = '13px'
        
        const strategySelect = document.createElement('select')
        strategySelect.id = `npc-strategy-${i}`
        strategySelect.style.width = '100%'
        strategySelect.style.padding = '6px'
        strategySelect.style.fontSize = '14px'
        strategySelect.style.backgroundColor = 'rgba(0, 119, 182, 0.2)'
        strategySelect.style.color = '#00bfff'
        strategySelect.style.border = '2px solid #0077b6'
        strategySelect.style.borderRadius = '4px'
        
        const strategyOptions = [
            { value: 'balanced', text: 'Balanced' },
            { value: 'aggressive', text: 'Aggressive' },
            { value: 'defensive', text: 'Defensive' },
            { value: 'powerup-hunter', text: 'Power-up Hunter' },
            { value: 'trapper', text: 'Trapper' }
        ]
        
        strategyOptions.forEach(opt => {
            const option = document.createElement('option')
            option.value = opt.value
            option.textContent = opt.text
            if (opt.value === (playerData.strategies[i] || 'balanced')) {
                option.selected = true
            }
            strategySelect.appendChild(option)
        })
        
        strategySelect.addEventListener('change', () => {
            playerData.strategies[i] = strategySelect.value
        })
        
        container.appendChild(nameLabel)
        container.appendChild(nameInput)
        container.appendChild(difficultyLabel)
        container.appendChild(difficultySelect)
        container.appendChild(strategyLabel)
        container.appendChild(strategySelect)
        npcDifficultyList.appendChild(container)
    }
}

function updatePresetSelectors() {
    const count = playerData.npcCount
    npcPresetList.innerHTML = ''
    
    for (let i = 0; i < count; i++) {
        const container = document.createElement('div')
        container.className = 'npc-preset-item'
        container.style.marginBottom = '15px'
        container.style.padding = '12px'
        container.style.backgroundColor = 'rgba(0, 119, 182, 0.1)'
        container.style.borderRadius = '6px'
        container.style.border = '1px solid rgba(0, 191, 255, 0.2)'
        
        const label = document.createElement('label')
        label.textContent = `Bot ${i + 1} Preset:`
        label.style.display = 'block'
        label.style.marginBottom = '8px'
        label.style.color = '#00bfff'
        label.style.fontWeight = 'bold'
        label.style.fontSize = '14px'
        
        const select = document.createElement('select')
        select.id = `npc-preset-${i}`
        select.style.width = '100%'
        select.style.padding = '8px'
        select.style.fontSize = '14px'
        select.style.backgroundColor = 'rgba(0, 119, 182, 0.2)'
        select.style.color = '#00bfff'
        select.style.border = '2px solid #0077b6'
        select.style.borderRadius = '4px'
        
        // Add "None" option
        const noneOption = document.createElement('option')
        noneOption.value = ''
        noneOption.textContent = '-- Select Preset --'
        select.appendChild(noneOption)
        
        NPC_PRESETS.forEach(preset => {
            const option = document.createElement('option')
            option.value = preset.id
            option.textContent = `${preset.name} (${preset.description})`
            select.appendChild(option)
        })
        
        // Show preset details when selected
        const detailsDiv = document.createElement('div')
        detailsDiv.id = `preset-details-${i}`
        detailsDiv.style.marginTop = '8px'
        detailsDiv.style.padding = '8px'
        detailsDiv.style.backgroundColor = 'rgba(0, 191, 255, 0.1)'
        detailsDiv.style.borderRadius = '4px'
        detailsDiv.style.fontSize = '12px'
        detailsDiv.style.color = '#cceeff'
        detailsDiv.className = 'hidden'
        
        select.addEventListener('change', () => {
            const preset = NPC_PRESETS.find(p => p.id === select.value)
            if (preset) {
                detailsDiv.textContent = `Difficulty: ${preset.difficulty.charAt(0).toUpperCase() + preset.difficulty.slice(1)} | Strategy: ${preset.strategy.charAt(0).toUpperCase() + preset.strategy.slice(1).replace('-', ' ')}`
                detailsDiv.classList.remove('hidden')
            } else {
                detailsDiv.classList.add('hidden')
            }
        })
        
        container.appendChild(label)
        container.appendChild(select)
        container.appendChild(detailsDiv)
        npcPresetList.appendChild(container)
    }
}

function handleModeToggle(usePresets) {
    playerData.usePresets = usePresets
    
    if (usePresets) {
        customModeBtn.classList.remove('active')
        presetModeBtn.classList.add('active')
        customModeBtn.style.background = 'rgba(0, 119, 182, 0.1)'
        presetModeBtn.style.background = 'rgba(0, 191, 255, 0.2)'
        npcCustomConfig.classList.add('hidden')
        npcPresetConfig.classList.remove('hidden')
        updatePresetSelectors()
    } else {
        customModeBtn.classList.add('active')
        presetModeBtn.classList.remove('active')
        customModeBtn.style.background = 'rgba(0, 191, 255, 0.2)'
        presetModeBtn.style.background = 'rgba(0, 119, 182, 0.1)'
        npcCustomConfig.classList.remove('hidden')
        npcPresetConfig.classList.add('hidden')
        updateCustomSelectors()
    }
}

function handleNPCCountChange() {
    updateNPCDifficultySelectors()
}

function handleHostGame() {
    playerData.name = playerNameInput.value.trim()
    
    // Set loading state
    setButtonLoading(hostButton, true)
    
    socket.emit('room:host', {
        name: playerData.name
    })
}

function handleJoinGame() {
    playerData.name = playerNameJoinInput.value.trim()
    const roomId = joinInput.value.trim()

    if (roomId) {
        // Set loading state
        setButtonLoading(joinButton, true)
        
        socket.emit('room:join', {
            roomId: roomId,
            name: playerData.name,
        })
    }
}

function handleRestartGame() {
    
    // Clear all players from the game view
    clearAllPlayers()
    
        // Check if this is single-player mode
    if (playerData.mode === 'single') {
        window.location.reload()
        console.log('Single-player mode - returning to main menu')
        showMenuScreen()
        
        // Optionally, you can reload to fully reset the state
        // window.location.reload()
    } else {
        // Multiplayer: return to lobby
        console.log('Multiplayer mode - returning to lobby')
        returnToLobby()
    }
}

export function initializeMenu() {
    // Initialize lobby browser
    initializeLobbyBrowser()

    //Mode toggle buttons
    multiModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
        modeSelect.value = 'multi'
        handleModeChange()
    })

    singleModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
        modeSelect.value = 'single'
        handleModeChange()
    })

    //Host button - enable when player name has 2+ characters
    playerNameInput.addEventListener('input', () => {
        const name = playerNameInput.value.trim()
        hostButton.disabled = name.length < 2
    })

    //Start button - enable when single-player name has 2+ characters
    playerNameSingleInput.addEventListener('input', () => {
        const name = playerNameSingleInput.value.trim()
        startButton.disabled = name.length < 2
    })

    //Join button - enable when both room code and name are valid
    const checkJoinButton = () => {
        const name = playerNameJoinInput.value.trim()
        const roomId = joinInput.value.trim()
        joinButton.disabled = name.length < 2 || roomId.length < 2
    }

    playerNameJoinInput.addEventListener('input', checkJoinButton)
    joinInput.addEventListener('input', checkJoinButton)

    modeSelect.addEventListener('change', handleModeChange)
    npcCountSelect.addEventListener('change', handleNPCCountChange)
    
    // Mode toggle buttons
    customModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
        handleModeToggle(false)
    })
    
    presetModeBtn.addEventListener('click', () => {
        playSound('buttonClick')
        handleModeToggle(true)
    })
    
    // Initialize mode toggle button styles
    if (customModeBtn && presetModeBtn) {
        customModeBtn.style.background = 'rgba(0, 191, 255, 0.2)'
        presetModeBtn.style.background = 'rgba(0, 119, 182, 0.1)'
    }
    
    // Initialize NPC difficulty selectors on page load
    updateNPCDifficultySelectors()
    startButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleStartGame()
    })
    hostButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleHostGame()
    })
    joinButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleJoinGame()
    })
    restartButton.addEventListener('click', () => {
        playSound('buttonClick')
        handleRestartGame()
    })
    
    // Initialize mode change handler to set initial UI state
    handleModeChange()
    
    // Initialize button states
    startButton.disabled = playerNameSingleInput.value.trim().length < 2
}