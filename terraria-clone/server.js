const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Game state
const gameState = {
  players: {},
  world: null,
  enemies: [],
  projectiles: [],
  worldSeed: Math.floor(Math.random() * 1000000)
};

let nextPlayerId = 1;

// Broadcast to all connected clients
function broadcast(data, excludeClient = null) {
  wss.clients.forEach(client => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
  const playerId = nextPlayerId++;

  // Create new player
  const player = {
    id: playerId,
    x: 400,
    y: 100,
    vx: 0,
    vy: 0,
    width: 32,
    height: 48,
    health: 100,
    maxHealth: 100,
    inventory: Array(40).fill(null).map(() => ({ type: null, count: 0 })),
    selectedSlot: 0,
    direction: 1,
    onGround: false,
    name: `Player${playerId}`,
    color: `hsl(${Math.random() * 360}, 70%, 50%)`
  };

  // Give starting items
  player.inventory[0] = { type: 'pickaxe', count: 1 };
  player.inventory[1] = { type: 'axe', count: 1 };
  player.inventory[2] = { type: 'sword', count: 1 };
  player.inventory[3] = { type: 'dirt', count: 99 };
  player.inventory[4] = { type: 'wood', count: 50 };

  gameState.players[playerId] = player;

  // Send initial game state to new player
  ws.send(JSON.stringify({
    type: 'init',
    playerId: playerId,
    gameState: gameState
  }));

  // Notify other players
  broadcast({
    type: 'playerJoined',
    player: player
  }, ws);

  console.log(`Player ${playerId} connected`);

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch(data.type) {
        case 'playerUpdate':
          if (gameState.players[playerId]) {
            Object.assign(gameState.players[playerId], data.player);
            broadcast({
              type: 'playerUpdate',
              player: gameState.players[playerId]
            }, ws);
          }
          break;

        case 'blockBreak':
          broadcast({
            type: 'blockBreak',
            x: data.x,
            y: data.y,
            playerId: playerId
          });
          break;

        case 'blockPlace':
          broadcast({
            type: 'blockPlace',
            x: data.x,
            y: data.y,
            blockType: data.blockType,
            playerId: playerId
          });
          break;

        case 'projectile':
          const projectile = {
            id: Date.now() + Math.random(),
            ...data.projectile
          };
          gameState.projectiles.push(projectile);
          broadcast({
            type: 'projectile',
            projectile: projectile
          });
          break;

        case 'enemyDamage':
          broadcast({
            type: 'enemyDamage',
            enemyId: data.enemyId,
            damage: data.damage
          });
          break;

        case 'playerDamage':
          if (gameState.players[data.targetId]) {
            gameState.players[data.targetId].health -= data.damage;
            broadcast({
              type: 'playerDamage',
              playerId: data.targetId,
              health: gameState.players[data.targetId].health
            });
          }
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    delete gameState.players[playerId];
    broadcast({
      type: 'playerLeft',
      playerId: playerId
    });
    console.log(`Player ${playerId} disconnected`);
  });
});

// Game loop for server-side updates (enemies, etc.)
setInterval(() => {
  // Update enemies, projectiles, etc.
  // This keeps server as source of truth for game entities
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Terraria Clone server running on port ${PORT}`);
  console.log(`Players can connect at http://localhost:${PORT}`);
  console.log(`Or use your local IP address for WiFi multiplayer`);
});
