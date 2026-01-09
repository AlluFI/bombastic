import { setSoundEnabled, playSound } from '../audio/soundManager.js'

// Get all audio toggle buttons
const audioToggleButtons = [
    document.getElementById('audio-toggle'),
    document.getElementById('audio-toggle-lobby'),
    document.getElementById('audio-toggle-game')
]

// Load saved audio state from localStorage
let audioEnabled = localStorage.getItem('soundEnabled') !== 'false' // Default to true

// Initialize button states
function updateButtonStates() {
    audioToggleButtons.forEach(button => {
        if (button) {
            button.textContent = audioEnabled ? '🔊' : '🔇'
            if (audioEnabled) {
                button.classList.remove('muted')
            } else {
                button.classList.add('muted')
            }
        }
    })
}

// Toggle audio state
function toggleAudio() {
    audioEnabled = !audioEnabled
    setSoundEnabled(audioEnabled)
    localStorage.setItem('soundEnabled', audioEnabled.toString())
    updateButtonStates()
    
    // Play a test sound when enabling audio (but not when disabling)
    if (audioEnabled) {
        playSound('buttonClick')
    }
}

// Add click event listeners to all toggle buttons
audioToggleButtons.forEach(button => {
    if (button) {
        button.addEventListener('click', toggleAudio)
    }
})

// Initialize on load
updateButtonStates()
setSoundEnabled(audioEnabled)

export { toggleAudio, audioEnabled }