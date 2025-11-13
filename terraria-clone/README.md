# TerraQuest - Local Multiplayer Terraria Clone

A 2D sandbox game inspired by Terraria, designed for local multiplayer gaming over WiFi!

## Features

- **Procedural Terrain Generation**: Unique worlds with caves, ores, and trees
- **Mining & Building**: Gather resources and construct structures
- **Combat System**: Fight enemies that spawn at night
- **Day/Night Cycle**: Dynamic lighting and enemy spawning
- **Inventory System**: Collect and manage items
- **Local Multiplayer**: Play with friends on the same WiFi network
- **Real-time Synchronization**: All players share the same world

## How to Play Locally (Same WiFi)

### Quick Start (Recommended)

**Option 1: Using Start Scripts**
- **Windows**: Double-click `start.bat`
- **Mac/Linux**: Run `./start.sh` in terminal

The script will automatically install dependencies and show your IP address for multiplayer!

**Option 2: Manual Start**

1. **Install Dependencies** (first time only)
   ```bash
   cd terraria-clone
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Find Your Local IP Address**

   **On Windows:**
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.100)

   **On Mac/Linux:**
   ```bash
   ifconfig
   ```
   or
   ```bash
   ip addr show
   ```
   Look for your local IP (usually starts with 192.168.x.x or 10.x.x.x)

4. **Connect Players**
   - **Host player**: Open browser and go to `http://localhost:3000`
   - **Other players on WiFi**: Open browser and go to `http://[HOST_IP]:3000`
     - Example: `http://192.168.1.100:3000`

### Important Notes

⚠️ **The server MUST be running before opening the game in browser!**
- If you see "Server Not Running" message, make sure you've started the server with `npm start`
- The game will automatically try to reconnect if the connection is lost
- You'll see step-by-step instructions in the browser if the server isn't detected

### Game Controls

| Action | Keys |
|--------|------|
| Move Left/Right | A/D or Arrow Keys |
| Jump | W/Space/Up Arrow |
| Mine/Attack | Left Click |
| Place Block | Right Click |
| Select Item | 1-8 or Mouse Wheel |
| Change Slot | Scroll Wheel |

### Gameplay Tips

1. **Mining**: Click and hold on blocks to mine them. Different tools have different mining speeds.

2. **Building**: Select a block from your inventory and right-click to place it.

3. **Combat**: Use your sword (slot 3) to fight enemies. They spawn at night!

4. **Resource Management**:
   - Start with a pickaxe, axe, and sword
   - Mine stone, coal, iron, and gold
   - Collect wood from trees

5. **Survival**:
   - Enemies appear during the night cycle
   - Build shelters to protect yourself
   - Your health regenerates over time

6. **Multiplayer**:
   - All players share the same world
   - Work together to build and survive
   - Changes made by one player appear for everyone

## Items & Blocks

### Tools
- **Pickaxe** ⛏️: Mine stone and ores
- **Axe** 🪓: Chop wood quickly
- **Sword** ⚔️: Combat weapon

### Blocks
- **Dirt** 🟫: Basic building material
- **Grass** 🟩: Surface terrain
- **Stone** ⬜: Underground material
- **Wood** 🟨: From trees
- **Coal** ⬛: Fuel resource
- **Iron** ⚙️: Valuable ore
- **Gold** 🌟: Rare ore

## Technical Details

### Architecture
- **Backend**: Node.js + Express + WebSocket (ws)
- **Frontend**: HTML5 Canvas + Vanilla JavaScript
- **Networking**: WebSocket for real-time multiplayer
- **Terrain**: Simplex noise-based procedural generation

### Port Configuration
Default port: 3000

To change the port:
```bash
PORT=8080 npm start
```

### Firewall Notes
If players can't connect:
- Make sure port 3000 is open on the host's firewall
- Ensure all devices are on the same WiFi network
- Some networks may block WebSocket connections

## Troubleshooting

**Players can't connect:**
- Verify all devices are on the same WiFi
- Check firewall settings on host computer
- Make sure you're using the correct local IP address
- Try disabling VPN if active

**Game is laggy:**
- Too many players (designed for 2-4 players)
- Slow WiFi connection
- Try reducing browser window size

**World not syncing:**
- Check WebSocket connection status
- Refresh all browsers and reconnect
- Restart the server

## Development

To modify the game:
- `server.js`: Server logic and multiplayer handling
- `game.js`: Client game logic, rendering, physics
- `index.html`: UI and styles

## Credits

Created as a Terraria-inspired local multiplayer game for fun with friends!

Enjoy building and exploring together!
