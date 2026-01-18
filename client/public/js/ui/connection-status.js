/**
 * Connection Status Indicator
 * Shows connection status and handles reconnection UI
 */

let connectionStatusElement = null
let isConnected = true
let reconnectAttempts = 0

/**
 * Initialize connection status indicator
 */
export function initializeConnectionStatus() {
    // Get or create connection status element
    connectionStatusElement = document.getElementById('connection-status')
    
    if (!connectionStatusElement) {
        // Fallback: create if not in HTML
        connectionStatusElement = document.createElement('div')
        connectionStatusElement.id = 'connection-status'
        connectionStatusElement.className = 'connection-status'
        connectionStatusElement.innerHTML = `
            <span class="connection-indicator"></span>
            <span class="connection-text">Connected</span>
        `
        // Try to add to game-controls-header, fallback to body
        const gameControlsHeader = document.querySelector('.game-controls-header')
        if (gameControlsHeader) {
            gameControlsHeader.insertBefore(connectionStatusElement, gameControlsHeader.firstChild)
        } else {
            document.body.appendChild(connectionStatusElement)
        }
    } else {
        // Element exists in HTML, ensure it has the right structure
        if (!connectionStatusElement.querySelector('.connection-indicator')) {
            connectionStatusElement.innerHTML = `
                <span class="connection-indicator"></span>
                <span class="connection-text">Connected</span>
            `
        }
    }
    
    // Add CSS if not already present
    if (!document.getElementById('connection-status-style')) {
        const style = document.createElement('style')
        style.id = 'connection-status-style'
        style.textContent = `
            .connection-status {
                position: static;
                padding: 6px 12px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 20px;
                color: white;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.3s ease;
                flex-shrink: 0;
            }
            
            .connection-status.disconnected {
                background: rgba(220, 53, 69, 0.9);
            }
            
            .connection-status.reconnecting {
                background: rgba(255, 193, 7, 0.9);
            }
            
            .connection-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #28a745;
                display: inline-block;
                animation: pulse 2s infinite;
            }
            
            @media screen and (max-width: 768px) {
                .connection-indicator {
                    width: 8px;
                    height: 8px;
                }
            }
            
            .connection-status.disconnected .connection-indicator {
                background: #dc3545;
                animation: none;
            }
            
            .connection-status.reconnecting .connection-indicator {
                background: #ffc107;
                animation: pulse-fast 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            @keyframes pulse-fast {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            
            .connection-text {
                font-weight: 500;
            }
        `
        document.head.appendChild(style)
    }
}

/**
 * Update connection status
 * @param {string} status - 'connected', 'disconnected', 'reconnecting'
 * @param {string} message - Optional custom message
 */
export function updateConnectionStatus(status, message = null) {
    if (!connectionStatusElement) return
    
    // Remove all status classes
    connectionStatusElement.classList.remove('connected', 'disconnected', 'reconnecting')
    
    // Add current status class
    connectionStatusElement.classList.add(status)
    
    // Update text
    const textElement = connectionStatusElement.querySelector('.connection-text')
    if (textElement) {
        if (message) {
            textElement.textContent = message
        } else {
            switch (status) {
                case 'connected':
                    textElement.textContent = 'Connected'
                    isConnected = true
                    reconnectAttempts = 0
                    break
                case 'disconnected':
                    textElement.textContent = 'Disconnected'
                    isConnected = false
                    break
                case 'reconnecting':
                    textElement.textContent = `Reconnecting... (${reconnectAttempts})`
                    break
            }
        }
    }
}

/**
 * Set reconnection attempt count
 */
export function setReconnectAttempts(attempts) {
    reconnectAttempts = attempts
    if (!isConnected) {
        updateConnectionStatus('reconnecting')
    }
}

/**
 * Get current connection status
 */
export function getConnectionStatus() {
    return {
        isConnected,
        reconnectAttempts
    }
}
