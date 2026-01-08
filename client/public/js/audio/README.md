# Sound Manager Documentation

## Overview

The sound manager provides a complete audio system for the Bomberman-style multiplayer game. It includes:
- Audio pooling for performance
- Volume controls (master, SFX, music)
- Generated sounds (works without audio files)
- Easy integration with game events
- Persistent volume settings (localStorage)

## Usage

### Basic Usage

```javascript
import { playSound } from './audio/soundManager.js'

// Play a sound effect
playSound('bombPlace')
playSound('explosion')
playSound('playerHit')
```

### With Options

```javascript
// Play with custom volume (0.0 to 1.0)
playSound('explosion', { volume: 0.7 })

// Play with looping
playSound('backgroundMusic', { loop: true })
```

### Available Sound Effects

#### Bomb Mechanics
- `bombPlace` - When a bomb is placed
- `bombTick` - Bomb ticking (optional, for countdown)
- `explosion` - Bomb explosion

#### Player Actions
- `playerHit` - Player takes damage
- `playerDeath` - Player eliminated

#### Blocks
- `blockDestroy` - Breakable block destroyed

#### Power-ups
- `powerupSpawn` - Power-up appears on map
- `powerupPickup` - Player collects power-up

#### UI & Menu
- `buttonClick` - Button clicked
- `buttonHover` - Button hovered (optional)
- `menuOpen` - Menu screen opened

#### Game Flow
- `gameStart` - Game begins
- `gameEnd` - Game ends
- `winner` - Winner announced
- `pause` - Game paused
- `resume` - Game resumed
- `timerWarning` - Timer running low (optional)

#### Multiplayer
- `playerJoin` - Player joined game
- `playerLeave` - Player left game
- `connectionError` - Connection error occurred

## Volume Control

```javascript
import { 
    setMasterVolume, 
    setSFXVolume, 
    setMusicVolume,
    setSoundEnabled 
} from './audio/soundManager.js'

// Set volumes (0.0 to 1.0)
setMasterVolume(0.8)  // 80% master volume
setSFXVolume(0.9)     // 90% SFX volume
setMusicVolume(0.5)   // 50% music volume

// Enable/disable all sounds
setSoundEnabled(true)
setSoundEnabled(false)
```

## Adding Real Sound Files

When you have actual audio files (MP3, OGG, etc.), you can load them:

```javascript
import { loadSoundFiles } from './audio/soundManager.js'

loadSoundFiles({
    bombPlace: 'sounds/bomb-place.mp3',
    explosion: 'sounds/explosion.mp3',
    playerHit: 'sounds/player-hit.mp3',
    playerDeath: 'sounds/player-death.mp3',
    // ... etc
})
```

### Sound File Recommendations

1. **Format**: MP3 or OGG (OGG has better compression, MP3 has better browser support)
2. **Duration**: Keep sounds short (0.1-0.5 seconds for most effects)
3. **Sample Rate**: 44.1kHz is standard
4. **Bitrate**: 128kbps is sufficient for game sounds
5. **File Size**: Keep individual files under 100KB when possible

### Where to Get Sound Files

- **Free Resources**:
  - [Freesound.org](https://freesound.org) - Free, requires attribution
  - [OpenGameArt.org](https://opengameart.org) - Free game assets
  - [Zapsplat](https://www.zapsplat.com) - Free with account
  - [Pixabay](https://pixabay.com/sound-effects/) - Free sound effects

- **Sound Generators**:
  - [sfxr](https://www.bfxr.net/) - Generate 8-bit style sounds
  - [ChipTone](https://sfbgames.itch.io/chiptone) - Chiptune sound generator
  - [Bfxr](https://www.bfxr.net/) - Sound effect generator

## Current Implementation

The sound manager currently uses **generated sounds** via Web Audio API. These are simple synthesized sounds that work immediately without requiring audio files. They provide basic audio feedback while you can add real sound files later.

### Generated Sound Characteristics

- **bombPlace**: Short square wave (200Hz)
- **explosion**: Sawtooth wave (100Hz, longer duration)
- **playerHit**: Square wave (300Hz)
- **playerDeath**: Sawtooth wave (150Hz, longer)
- **powerupPickup**: Sine wave (800Hz, bright)

## Integration Points

The sound manager is already integrated into:

1. **main.js** - Game start/end, player join/leave, connection errors
2. **bombController.js** - Bomb placement, explosions, block destruction
3. **player.js** - Player damage/death (via bombController)
4. **powerupController.js** - Power-up spawn and pickup
5. **menu.js** - Button clicks, menu navigation
6. **pause.js** - Pause/resume sounds
7. **lobby.js** - Lobby button clicks

## Performance Considerations

- **Audio Pooling**: The sound manager uses an audio pool system to avoid creating new Audio objects for each sound, which improves performance
- **Preloading**: Audio files are preloaded when `loadSoundFiles()` is called
- **Volume Calculation**: Effective volume = masterVolume × sfxVolume (calculated once per play)

## Browser Compatibility

- **Web Audio API**: Supported in all modern browsers (Chrome, Firefox, Safari, Edge)
- **HTML5 Audio**: Fallback for older browsers
- **Autoplay Policy**: Some browsers require user interaction before playing sounds (handled gracefully)

## Future Enhancements

Potential improvements:
- 3D spatial audio for explosions
- Dynamic music that changes with game state
- Sound effect variations (multiple explosion sounds, randomized)
- Compression/optimization for mobile devices
- Audio visualization (optional)
