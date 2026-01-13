export const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
}

window.addEventListener('keydown', (e) =>{
    if (e.repeat) return 

    if (e.key === 'ArrowUp') {
        keys.up = true
        e.preventDefault() // Prevent page scrolling
    }
    if (e.key === 'ArrowDown') {
        keys.down = true
        e.preventDefault() 
    }
    if (e.key === 'ArrowLeft') {
        keys.left = true
        e.preventDefault() 
    }
    if (e.key === 'ArrowRight') {
        keys.right = true
        e.preventDefault() 
    }
    if (e.key === ' ') {
        keys.space = true
        e.preventDefault() 
    }
})

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') keys.up = false
    if (e.key === 'ArrowDown') keys.down = false
    if (e.key === 'ArrowLeft') keys.left = false
    if (e.key === 'ArrowRight') keys.right = false
    if (e.key === ' ') keys.space = false
})