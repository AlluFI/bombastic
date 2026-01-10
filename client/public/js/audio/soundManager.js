/**
 * Sound Manager for Bomberman-style multiplayer game
 * Handles all sound effects with volume control and audio pooling
 */

class SoundManager {
    constructor() {
        this.sounds = new Map()
        this.audioPools = new Map() // Pool of audio objects for each sound
        this.masterVolume = 1.0
        this.sfxVolume = 1.0
        this.musicVolume = 1.0
        this.enabled = true
        this.maxPoolSize = 5 // Maximum audio objects per sound type
        
        // Sound file paths (to be populated with actual sound files)
        this.soundPaths = {
            // Bomb mechanics
            bombPlace: null, // 'sounds/bomb-place.mp3'
            bombTick: null, // 'sounds/bomb-tick.mp3'
            explosion: null, // 'sounds/explosion.mp3'
            
            // Player actions
            playerHit: null, // 'sounds/player-hit.mp3'
            playerDeath: null, // 'sounds/player-death.mp3'
            
            // Blocks
            blockDestroy: null, // 'sounds/block-destroy.mp3'
            
            // Power-ups
            powerupSpawn: null, // 'sounds/powerup-spawn.mp3'
            powerupPickup: null, // 'sounds/powerup-pickup.mp3'
            powerupImmortal: null, // 'sounds/powerup-immortal.mp3'
            
            // UI & Menu
            buttonClick: null, // 'sounds/button-click.mp3'
            buttonHover: null, // 'sounds/button-hover.mp3'
            menuOpen: null, // 'sounds/menu-open.mp3'
            
            // Game flow
            gameStart: null, // 'sounds/game-start.mp3'
            gameEnd: null, // 'sounds/game-end.mp3'
            winner: null, // 'sounds/winner.mp3'
            pause: null, // 'sounds/pause.mp3'
            resume: null, // 'sounds/resume.mp3'
            timerWarning: null, // 'sounds/timer-warning.mp3'
            
            // Multiplayer
            playerJoin: null, // 'sounds/player-join.mp3'
            playerLeave: null, // 'sounds/player-leave.mp3'
            connectionError: null, // 'sounds/connection-error.mp3'
        }
        
        // Initialize audio pools
        this.initializeAudioPools()
    }
    
    /**
     * Initialize audio object pools for each sound type
     */
    initializeAudioPools() {
        for (const [soundName, path] of Object.entries(this.soundPaths)) {
            if (path) {
                const pool = []
                for (let i = 0; i < this.maxPoolSize; i++) {
                    const audio = new Audio(path)
                    audio.preload = 'auto'
                    audio.volume = this.getEffectiveVolume()
                    pool.push(audio)
                }
                this.audioPools.set(soundName, pool)
            }
        }
    }
    
    /**
     * Get an available audio object from the pool
     */
    getAudioFromPool(soundName) {
        if (!this.audioPools.has(soundName)) {
            console.warn(`Sound pool not found for: ${soundName}`)
            return null
        }
        
        const pool = this.audioPools.get(soundName)
        
        // Find an audio object that's not currently playing
        for (const audio of pool) {
            if (audio.paused || audio.ended) {
                audio.currentTime = 0 // Reset to start
                audio.volume = this.getEffectiveVolume()
                return audio
            }
        }
        
        // If all are playing, reuse the first one (interrupt)
        if (pool.length > 0) {
            const audio = pool[0]
            audio.currentTime = 0
            audio.volume = this.getEffectiveVolume()
            return audio
        }
        
        return null
    }
    
    /**
     * Calculate effective volume (master * sfx)
     */
    getEffectiveVolume() {
        return this.masterVolume * this.sfxVolume
    }
    
    /**
     * Play a sound effect
     * @param {string} soundName - Name of the sound to play
     * @param {Object} options - Optional settings (volume, loop, etc.)
     */
    play(soundName, options = {}) {
        if (!this.enabled) return
        
        // Check if sound path is configured
        if (!this.soundPaths[soundName]) {
            // Sound file not configured - use Web Audio API to generate a simple sound
            this.playGeneratedSound(soundName, options)
            return
        }
        
        const audio = this.getAudioFromPool(soundName)
        if (!audio) return
        
        // Apply options
        if (options.volume !== undefined) {
            audio.volume = this.getEffectiveVolume() * options.volume
        }
        
        if (options.loop !== undefined) {
            audio.loop = options.loop
        }
        
        // Play the sound
        audio.play().catch(error => {
            // Handle autoplay restrictions
            if (error.name === 'NotAllowedError') {
                console.warn(`Autoplay prevented for sound: ${soundName}. User interaction required.`)
            } else {
                console.error(`Error playing sound ${soundName}:`, error)
            }
        })
    }
    
    /**
     * Generate simple sounds using Web Audio API when sound files aren't available
     * This provides basic sound effects even without audio files
     */
    playGeneratedSound(soundName, options = {}) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            // Configure sound based on type
            const soundConfig = this.getSoundConfig(soundName)
            oscillator.type = soundConfig.type || 'sine'
            oscillator.frequency.value = soundConfig.frequency || 440
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime)
            gainNode.gain.linearRampToValueAtTime(
                (this.getEffectiveVolume() * (options.volume || 1)) * soundConfig.volume,
                audioContext.currentTime + 0.01
            )
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + soundConfig.duration)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + soundConfig.duration)
        } catch (error) {
            console.warn(`Could not generate sound for ${soundName}:`, error)
        }
    }
    
    /**
     * Get configuration for generated sounds
     */
    getSoundConfig(soundName) {
        const configs = {
            bombPlace: { type: 'square', frequency: 200, duration: 0.1, volume: 0.3 },
            bombTick: { type: 'sine', frequency: 400, duration: 0.05, volume: 0.2 },
            explosion: { type: 'sawtooth', frequency: 100, duration: 0.3, volume: 0.5 },
            playerHit: { type: 'square', frequency: 300, duration: 0.15, volume: 0.4 },
            playerDeath: { type: 'sawtooth', frequency: 150, duration: 0.5, volume: 0.5 },
            blockDestroy: { type: 'square', frequency: 250, duration: 0.2, volume: 0.3 },
            powerupSpawn: { type: 'sine', frequency: 600, duration: 0.2, volume: 0.4 },
            powerupPickup: { type: 'sine', frequency: 800, duration: 0.15, volume: 0.4 },
            powerupImmortal: { type: 'sine', frequency: 1000, duration: 0.3, volume: 0.6 }, // Higher pitch, longer duration for special reward
            buttonClick: { type: 'square', frequency: 500, duration: 0.1, volume: 0.3 },
            buttonHover: { type: 'sine', frequency: 700, duration: 0.05, volume: 0.2 },
            menuOpen: { type: 'sine', frequency: 400, duration: 0.2, volume: 0.3 },
            gameStart: { type: 'sine', frequency: 600, duration: 0.5, volume: 0.5 },
            gameEnd: { type: 'sawtooth', frequency: 200, duration: 0.8, volume: 0.5 },
            winner: { type: 'sine', frequency: 800, duration: 0.6, volume: 0.6 },
            pause: { type: 'square', frequency: 300, duration: 0.2, volume: 0.3 },
            resume: { type: 'sine', frequency: 500, duration: 0.2, volume: 0.3 },
            timerWarning: { type: 'square', frequency: 400, duration: 0.3, volume: 0.4 },
            playerJoin: { type: 'sine', frequency: 600, duration: 0.2, volume: 0.3 },
            playerLeave: { type: 'sawtooth', frequency: 300, duration: 0.2, volume: 0.3 },
            connectionError: { type: 'square', frequency: 200, duration: 0.4, volume: 0.5 },
        }
        
        return configs[soundName] || { type: 'sine', frequency: 440, duration: 0.2, volume: 0.3 }
    }
    
    /**
     * Stop a specific sound
     */
    stop(soundName) {
        const pool = this.audioPools.get(soundName)
        if (pool) {
            pool.forEach(audio => {
                audio.pause()
                audio.currentTime = 0
            })
        }
    }
    
    /**
     * Stop all sounds
     */
    stopAll() {
        this.audioPools.forEach(pool => {
            pool.forEach(audio => {
                audio.pause()
                audio.currentTime = 0
            })
        })
    }
    
    /**
     * Set master volume (0.0 to 1.0)
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume))
        this.updateAllVolumes()
    }
    
    /**
     * Set SFX volume (0.0 to 1.0)
     */
    setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume))
        this.updateAllVolumes()
    }
    
    /**
     * Set music volume (0.0 to 1.0)
     */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume))
    }
    
    /**
     * Update volumes of all audio objects
     */
    updateAllVolumes() {
        const effectiveVolume = this.getEffectiveVolume()
        this.audioPools.forEach(pool => {
            pool.forEach(audio => {
                audio.volume = effectiveVolume
            })
        })
    }
    
    /**
     * Enable/disable sound
     */
    setEnabled(enabled) {
        this.enabled = enabled
        if (!enabled) {
            this.stopAll()
        }
    }
    
    /**
     * Load sound files (call this when you have actual sound files)
     * @param {Object} soundPaths - Object mapping sound names to file paths
     */
    loadSounds(soundPaths) {
        Object.assign(this.soundPaths, soundPaths)
        this.initializeAudioPools()
    }
    
    /**
     * Preload all sounds
     */
    preloadAll() {
        this.audioPools.forEach(pool => {
            pool.forEach(audio => {
                audio.load()
            })
        })
    }
}

// Create singleton instance
const soundManager = new SoundManager()

// Export functions for easy use
export function playSound(soundName, options) {
    soundManager.play(soundName, options)
}

export function stopSound(soundName) {
    soundManager.stop(soundName)
}

export function stopAllSounds() {
    soundManager.stopAll()
}

export function setMasterVolume(volume) {
    soundManager.setMasterVolume(volume)
}

export function setSFXVolume(volume) {
    soundManager.setSFXVolume(volume)
}

export function setMusicVolume(volume) {
    soundManager.setMusicVolume(volume)
}

export function setSoundEnabled(enabled) {
    soundManager.setEnabled(enabled)
}

export function loadSoundFiles(soundPaths) {
    soundManager.loadSounds(soundPaths)
}

export function initializeSoundManager() {
    // Try to enable audio context (required for some browsers)
    // This needs to be called after user interaction
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        if (audioContext.state === 'suspended') {
            // Audio context is suspended, will be resumed on user interaction
            console.log('Audio context suspended, will resume on user interaction')
        }
    } catch (error) {
        console.warn('Web Audio API not supported:', error)
    }
    
    // Load saved volume settings from localStorage
    const savedMasterVolume = localStorage.getItem('soundMasterVolume')
    const savedSFXVolume = localStorage.getItem('soundSFXVolume')
    const savedMusicVolume = localStorage.getItem('soundMusicVolume')
    const savedEnabled = localStorage.getItem('soundEnabled')
    
    if (savedMasterVolume !== null) {
        soundManager.setMasterVolume(parseFloat(savedMasterVolume))
    }
    if (savedSFXVolume !== null) {
        soundManager.setSFXVolume(parseFloat(savedSFXVolume))
    }
    if (savedMusicVolume !== null) {
        soundManager.setMusicVolume(parseFloat(savedMusicVolume))
    }
    if (savedEnabled !== null) {
        soundManager.setEnabled(savedEnabled === 'true')
    }
    
    console.log('Sound manager initialized')
}

// Override methods to save to localStorage
const originalSetMasterVolume = soundManager.setMasterVolume.bind(soundManager)
soundManager.setMasterVolume = function(volume) {
    originalSetMasterVolume(volume)
    try {
        localStorage.setItem('soundMasterVolume', volume.toString())
    } catch (e) {
        console.warn('Could not save master volume to localStorage:', e)
    }
}

const originalSetSFXVolume = soundManager.setSFXVolume.bind(soundManager)
soundManager.setSFXVolume = function(volume) {
    originalSetSFXVolume(volume)
    try {
        localStorage.setItem('soundSFXVolume', volume.toString())
    } catch (e) {
        console.warn('Could not save SFX volume to localStorage:', e)
    }
}

const originalSetMusicVolume = soundManager.setMusicVolume.bind(soundManager)
soundManager.setMusicVolume = function(volume) {
    originalSetMusicVolume(volume)
    try {
        localStorage.setItem('soundMusicVolume', volume.toString())
    } catch (e) {
        console.warn('Could not save music volume to localStorage:', e)
    }
}

const originalSetEnabled = soundManager.setEnabled.bind(soundManager)
soundManager.setEnabled = function(enabled) {
    originalSetEnabled(enabled)
    try {
        localStorage.setItem('soundEnabled', enabled.toString())
    } catch (e) {
        console.warn('Could not save sound enabled state to localStorage:', e)
    }
}

export default soundManager
