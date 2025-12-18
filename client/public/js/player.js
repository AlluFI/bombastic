import { keys } from "./controls.js"
import { map } from "./grid.js"


const gridElement = document.getElementById('grid')

//Player object constructor class
class Player {
    constructor(id, name, x, y, color = 'blue') {
        this.id = id //add socket id later
        this.name = name
        this.x = x
        this.y = y
        this.color = color 
        this.lives = 3
        this.score = 0
        this.element = null 
    }

    createDomElement() {
        const el = document.createElement('div')
        el.classList.add('player')
        el.style.backgroundColor = this.color
        el.dataset.id = this.id

        this.element = el
        this.updatePosition()
    }

    updatePosition() {
        if(!this.element) return

        //get player current position on the dom by referancing to the tile position
        const tile = document.getElementById(`tile-${this.x}-${this.y}`)
        const tilePosition = tile.getBoundingClientRect()

        //Align the player to the tile
        this.element.style.position = 'absolute'
        this.element.style.left = tilePosition.left + 'px'
        this.element.style.top = tilePosition.top + 'px'

    }
}

let localPlayer
export const remotePlayers = new Map()

export function createLocalPlayer(id, name, x, y, color) {
    localPlayer = new Player(
       id || 'local',
     name || 'Player1',
        x || 1,
        y || 1,
    color || 'blue'
    );

    localPlayer.createDomElement()
    gridElement.appendChild(localPlayer.element)
    return localPlayer
}

export function createRemotePlayer(playerData) {
    
    const player = new Player(
        playerData.id,
        playerData.name,
        playerData.x,
        playerData.y,
        playerData.color
    )

    player.createDomElement()
    gridElement.appendChild(player.element)
    remotePlayers.set(playerData.id, player)
    return player
}

export function removeRemotePlayer(playerId) {
    const player = remotePlayers.get(playerId)
    if (player && player.element) {
        player.element.remove()
        remotePlayers.delete(playerId)
    }
}

export function removeLocalPlayer() {
    if (localPlayer && localPlayer.element) {
        localPlayer.element.remove()
        localPlayer = null
    }
}

export function clearAllPlayers() {
    // Remove local player
    removeLocalPlayer()
    
    // Remove all remote players
    remotePlayers.forEach((player, playerId) => {
        if (player.element) {
            player.element.remove()
        }
    })
    remotePlayers.clear()
}

export function updateRemotePlayer(playerId, x, y) {
    const player = remotePlayers.get(playerId)
    if (player) {
        player.x = x
        player.y = y
        player.updatePosition()
    }
}

export function getLocalPlayer() {
    return localPlayer
}

export function updatePlayerMovement(player) {
    let newX = player.x
    let newY = player.y

    if (keys.up) newX--
    if (keys.down) newX++
    if (keys.left) newY--
    if (keys.right) newY++

    //check if player can move 
    if(map[newX] && map[newX][newY] === 'empty') {
        player.x = newX
        player.y = newY
        player.updatePosition()
    }
}