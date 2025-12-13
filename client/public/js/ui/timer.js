const timerElement = document.getElementById('timer')

let startTime = null
let elapsedSeconds = 0
let timerInterval = null
let isTimerRunning = false

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds/60)
    const seconds = totalSeconds % 60

    const minutesStr = String(minutes).padStart(2,0)
    const secondsStr = String(seconds).padStart(2,0)

    return `${minutesStr}:${secondsStr}`
}

function updateTimerDisplay() {
    timerElement.textContent = formatTime(elapsedSeconds)
}

export function startTimer() {
    if (isTimerRunning) return //timer is already running

    console.log('Timer started')
    isTimerRunning = true
    startTime = Date.now() - (elapsedSeconds * 1000)

    //time is updated every second
    timerInterval = setInterval(() => {
        const now = Date.now()
        elapsedSeconds = Math.floor((now - startTime) / 1000)
        updateTimerDisplay()
    }, 1000);
}

export function stopTimer() {
    if (!isTimerRunning) return // timer is already stopped

    console.log('Timer stopped')
    isTimerRunning = false

    if (timerInterval) {
        clearInterval(timerInterval) //clear the interval
        timerInterval = null
    }
}

export function resetTimer() {
    console.log('Timer reset')

    stopTimer()

    elapsedSeconds = 0
    startTime = null

    updateTimerDisplay()
}

//sync the time with server time
export function syncTimer(serverSeconds) {
    elapsedSeconds = serverSeconds
    startTime = Date.now() - (elapsedSeconds * 1000)
    updateTimerDisplay()
}

export function intializeTimer() {
    console.log('Timer initialized')

    updateTimerDisplay() //initial display set to 00:00
}