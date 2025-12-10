import { keys } from "./controls.js"
import { map } from "./grid.js"


const gridElement = document.getElementById('grid')

//Player object constructor class
class Player {
    constructor(id, name, row, col, color = 'blue') {
        this.id = id //add socket id later
        this.name = name
        this.row = row
        this.col = col
        this.color = color //adding just a color for now
        this.element = null //dom element reference
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
        const tile = document.getElementById(`tile-${this.row}-${this.col}`)
        const tilePosition = tile.getBoundingClientRect()

        //Align the player to the tile
        this.element.style.position = 'absolute'
        this.element.style.left = tilePosition.left + 'px'
        this.element.style.top = tilePosition.top + 'px'

    }
}

let localPlayer

export function createLocalPlayer() {
    localPlayer = new Player(
        'local',
        'Player1',
        1,
        1,
        'blue'
    )

    localPlayer.createDomElement()
    gridElement.appendChild(localPlayer.element)
    return localPlayer
}

export function updatePlayerMovement(player) {
    let newRow = player.row
    let newCol = player.col

    if (keys.up) newRow--
    if (keys.down) newRow++
    if (keys.left) newCol--
    if (keys.right) newCol++

    //check if player can move 
    if(map[newRow] && map[newRow][newCol] === 'empty') {
        player.row = newRow
        player.col = newCol
        player.updatePosition()
    }
}