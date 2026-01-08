# Bomberman-Style Multiplayer Web Game

A real-time multiplayer Bomberman-style game built with vanilla JavaScript and Node.js. Supports 2-4 players simultaneously over the internet, with optional single-player mode against AI opponents.

## 🎮 Features

- **Multiplayer Mode**: 2-4 players can join and play simultaneously
- **Single-Player Mode**: Play against 1-3 AI opponents with adjustable difficulty
- **Real-time Synchronization**: Smooth gameplay with Socket.io WebSocket connections
- **DOM-based Rendering**: No canvas - pure HTML/CSS/JavaScript with 60 FPS animations
- **Sound Effects**: Complete audio system with volume controls
- **Power-ups**: Collect power-ups to upgrade bomb range
- **Chat System**: In-game chat for multiplayer sessions
- **Room System**: Create or join games with room codes

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ installed
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-player
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   - Navigate to `http://localhost:3000`
   - The game will load automatically

### Development

The server uses `nodemon` for auto-reload during development. Just run `npm start` and edit files - the server will restart automatically.

## 📁 Project Structure

```
multi-player/
├── client/                    # Frontend (vanilla JavaScript)
│   ├── index.html            # Main HTML file
│   ├── css/                  # Stylesheets
│   └── public/js/           # JavaScript modules
│       ├── main.js           # Entry point
│       ├── game/             # Game logic (bombs, blocks, powerups)
│       ├── ui/               # UI components (menu, chat, scoreboard)
│       └── audio/            # Sound manager
│
├── server/                    # Backend (Node.js)
│   ├── server.js             # Server entry point
│   ├── config.js             # Configuration & feature flags
│   ├── game-loop.js          # Main game loop (60 FPS)
│   ├── utils.js              # Utility functions
│   ├── socket-handlers/      # Socket.io event handlers
│   └── npc/                  # NPC AI system
│
├── documentation/            # Developer documentation
└── README.md                 # This file
```

## 🎯 How to Play

### Multiplayer Mode

1. **Host a Game**:
   - Enter your name (min 2 characters)
   - Click "Create Lobby"
   - Share the room code with friends
   - Wait for players to join (2-4 players)
   - Click "Start Game" when ready

2. **Join a Game**:
   - Enter your name
   - Enter the room code from the host
   - Click "Join"
   - Wait in the lobby for the host to start

### Single-Player Mode

1. Select "Single" mode on the main menu
2. Enter your name
3. Choose number of bots (1-3)
4. Select difficulty (Easy/Medium/Hard)
5. Click "Start Single-Player Game"

### Controls

- **Arrow Keys** or **WASD**: Move player
- **Space**: Place bomb
- **Escape**: Pause/Resume game

### Game Rules

- **Objective**: Be the last player standing
- **Bombs**: Explode after 3 seconds, destroy blocks and damage players
- **Lives**: Each player starts with 3 lives
- **Power-ups**: Collect power-ups to increase bomb range
- **Blocks**: Breakable blocks can be destroyed, solid walls cannot

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (optional):

```env
PORT=3000
ENABLE_NPC=true
ENABLE_SINGLE_PLAYER_MODE=true
```

### Feature Flags

Edit `server/config.js` to enable/disable features:

- `ENABLE_NPC`: Enable/disable NPC system
- `ENABLE_SINGLE_PLAYER_MODE`: Enable/disable single-player mode
- `PORT`: Server port (default: 3000)

## 🏗️ Architecture

### Client-Server Model

- **Server**: Node.js with Socket.io for real-time communication
- **Client**: Vanilla JavaScript with ES modules (no build tools)
- **Communication**: WebSocket (Socket.io) for game state synchronization
- **Rendering**: DOM-based (no canvas) with CSS animations

### Game Loop

- **Server**: 60 FPS game loop processes all games
- **Client**: 60 FPS render loop using `requestAnimationFrame`
- **Synchronization**: Server-authoritative game state

### Room System

- Each game runs in an isolated room
- Rooms support up to 4 players
- Room codes are 6-character alphanumeric strings
- Rooms are cleaned up when host disconnects

## 📚 Documentation

### Core Documentation
- **[Architecture](ARCHITECTURE.md)**: System architecture and design patterns
- **[API Reference](API.md)**: Complete Socket.io event protocol
- **[Game Mechanics](GAME_MECHANICS.md)**: Game rules, systems, and mechanics

### Module Documentation
- **[NPC System](server/npc/README.md)**: Complete NPC AI documentation
- **[Sound Manager](client/public/js/audio/README.md)**: Audio system documentation

### Planning & Development
- **[Project Plan](PROJECT_PLAN.md)**: Detailed project plan and implementation status
- **[Developer Notes](documentation/)**: Individual developer documentation

## 🧪 Testing

### Run NPC Tests

```bash
npm run test:npc
```

### Manual Testing

1. Open multiple browser tabs/windows
2. Join the same room from different tabs
3. Test multiplayer functionality
4. Test single-player mode with NPCs

## 🐛 Troubleshooting

### Server won't start

- Check if port 3000 is already in use
- Verify Node.js version: `node --version` (should be 18+)
- Check dependencies: `npm install`

### Connection issues

- Ensure server is running
- Check browser console for errors
- Verify WebSocket connection in Network tab

### NPCs not working

- Check `ENABLE_NPC` flag in `server/config.js`
- Verify single-player mode is enabled
- Check server console for errors

## 🚢 Deployment

### Requirements

- Node.js 18+ runtime
- Persistent WebSocket connections
- Low latency (< 100ms ideal)

### Deployment Options

- **Railway**: Easy Node.js deployment
- **Render**: Simple deployment with WebSocket support
- **Fly.io**: Global edge deployment (requires paid plan)
- **Heroku**: Traditional Node.js hosting

### Environment Setup

Set environment variables on your hosting platform:

```env
PORT=3000
ENABLE_NPC=true
ENABLE_SINGLE_PLAYER_MODE=true
```

## 👥 Development Team

- **Hasitha**: Game Engine & Frontend
- **Joel**: Backend & Multiplayer Networking
- **Aleksi**: NPC AI & Menu System

## 📝 License

ISC

## 🔗 Links

- [NPC Documentation](server/npc/README.md)
- [Sound System Documentation](client/public/js/audio/README.md)
- [Project Plan](PROJECT_PLAN.md)
