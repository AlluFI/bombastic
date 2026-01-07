// Toast notification system for error messages and feedback

let toastContainer = null

function initToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div')
        toastContainer.id = 'toast-container'
        toastContainer.className = 'toast-container'
        document.body.appendChild(toastContainer)
    }
    return toastContainer
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'error', 'success', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
export function showToast(message, type = 'error', duration = 4000) {
    const container = initToastContainer()
    
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    
    // Add icon based on type
    let icon = '⚠️'
    if (type === 'success') icon = '✅'
    else if (type === 'info') icon = 'ℹ️'
    else if (type === 'warning') icon = '⚠️'
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close">×</button>
    `
    
    container.appendChild(toast)
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show')
    })
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close')
    closeBtn.addEventListener('click', () => {
        removeToast(toast)
    })
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast)
        }, duration)
    }
    
    return toast
}

function removeToast(toast) {
    toast.classList.remove('show')
    toast.classList.add('hide')
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast)
        }
    }, 300) // Match CSS transition duration
}

/**
 * Show an error toast (convenience function)
 */
export function showError(message, duration = 5000) {
    return showToast(message, 'error', duration)
}

/**
 * Show a success toast (convenience function)
 */
export function showSuccess(message, duration = 3000) {
    return showToast(message, 'success', duration)
}

/**
 * Show an info toast (convenience function)
 */
export function showInfo(message, duration = 4000) {
    return showToast(message, 'info', duration)
}

/**
 * Show a warning toast (convenience function)
 */
export function showWarning(message, duration = 4000) {
    return showToast(message, 'warning', duration)
}

