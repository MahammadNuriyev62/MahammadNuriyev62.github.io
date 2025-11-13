// Terraria Clone - Main Game Logic
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game constants
const BLOCK_SIZE = 32;
const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 100;
const GRAVITY = 0.5;
const JUMP_FORCE = 12;
const MOVE_SPEED = 5;
const MAX_FALL_SPEED = 15;
const MINING_SPEED = 500; // ms per block
const REACH_DISTANCE = 5; // blocks

// Block types
const BLOCK_TYPES = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    COAL: 6,
    IRON: 7,
    GOLD: 8,
    BEDROCK: 9
};

const BLOCK_COLORS = {
    [BLOCK_TYPES.AIR]: null,
    [BLOCK_TYPES.DIRT]: '#8B4513',
    [BLOCK_TYPES.GRASS]: '#228B22',
    [BLOCK_TYPES.STONE]: '#808080',
    [BLOCK_TYPES.WOOD]: '#D2691E',
    [BLOCK_TYPES.LEAVES]: '#90EE90',
    [BLOCK_TYPES.COAL]: '#333333',
    [BLOCK_TYPES.IRON]: '#C0C0C0',
    [BLOCK_TYPES.GOLD]: '#FFD700',
    [BLOCK_TYPES.BEDROCK]: '#1a1a1a'
};

const BLOCK_NAMES = {
    [BLOCK_TYPES.DIRT]: 'dirt',
    [BLOCK_TYPES.GRASS]: 'grass',
    [BLOCK_TYPES.STONE]: 'stone',
    [BLOCK_TYPES.WOOD]: 'wood',
    [BLOCK_TYPES.LEAVES]: 'leaves',
    [BLOCK_TYPES.COAL]: 'coal',
    [BLOCK_TYPES.IRON]: 'iron',
    [BLOCK_TYPES.GOLD]: 'gold'
};

// Item system
const ITEMS = {
    pickaxe: { name: 'Pickaxe', emoji: '⛏️', damage: 10, miningPower: 3 },
    axe: { name: 'Axe', emoji: '🪓', damage: 8, miningPower: 2 },
    sword: { name: 'Sword', emoji: '⚔️', damage: 20, miningPower: 0 },
    dirt: { name: 'Dirt', block: BLOCK_TYPES.DIRT, emoji: '🟫' },
    grass: { name: 'Grass', block: BLOCK_TYPES.GRASS, emoji: '🟩' },
    stone: { name: 'Stone', block: BLOCK_TYPES.STONE, emoji: '⬜' },
    wood: { name: 'Wood', block: BLOCK_TYPES.WOOD, emoji: '🟨' },
    coal: { name: 'Coal', block: BLOCK_TYPES.COAL, emoji: '⬛' },
    iron: { name: 'Iron', block: BLOCK_TYPES.IRON, emoji: '⚙️' },
    gold: { name: 'Gold', block: BLOCK_TYPES.GOLD, emoji: '🌟' }
};

// Game state
let world = [];
let players = {};
let myPlayerId = null;
let enemies = [];
let projectiles = [];
let particles = [];
let camera = { x: 0, y: 0 };
let keys = {};
let mouse = { x: 0, y: 0, left: false, right: false };
let miningProgress = { x: -1, y: -1, progress: 0, lastTime: 0 };
let gameTime = 0;
let dayNightCycle = 0; // 0-1, 0 = midnight, 0.5 = noon

// Network
let ws = null;
let connected = false;

// Simplex/Perlin Noise implementation for terrain generation
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.p = this.buildPermutationTable();
    }

    buildPermutationTable() {
        const p = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        // Shuffle using seed
        let n, temp;
        for (let i = 255; i > 0; i--) {
            n = Math.floor((this.seed * 287 + i) % (i + 1));
            temp = p[i];
            p[i] = p[n];
            p[n] = temp;
            this.seed = (this.seed * 16807) % 2147483647;
        }
        // Duplicate
        for (let i = 0; i < 256; i++) {
            p[256 + i] = p[i];
        }
        return p;
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = this.fade(x);
        const v = this.fade(y);
        const a = this.p[X] + Y;
        const aa = this.p[a];
        const ab = this.p[a + 1];
        const b = this.p[X + 1] + Y;
        const ba = this.p[b];
        const bb = this.p[b + 1];

        return this.lerp(v,
            this.lerp(u, this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y)),
            this.lerp(u, this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1))
        );
    }

    octaveNoise(x, y, octaves, persistence) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
}

// Generate world
function generateWorld(seed) {
    const noise = new SimplexNoise(seed);
    world = [];

    for (let x = 0; x < WORLD_WIDTH; x++) {
        world[x] = [];

        // Terrain height using noise
        const height = Math.floor(WORLD_HEIGHT * 0.4 + noise.octaveNoise(x * 0.02, 0, 4, 0.5) * 15);

        // Cave noise
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            if (y > height) {
                // Underground
                const caveNoise = noise.octaveNoise(x * 0.05, y * 0.05, 3, 0.6);

                if (caveNoise > 0.15) {
                    // Determine block type based on depth
                    if (y === height + 1) {
                        world[x][y] = BLOCK_TYPES.DIRT;
                    } else if (y < height + 5) {
                        world[x][y] = BLOCK_TYPES.DIRT;
                    } else {
                        world[x][y] = BLOCK_TYPES.STONE;

                        // Add ores
                        const oreNoise = noise.noise(x * 0.1, y * 0.1);
                        if (y > height + 10 && oreNoise > 0.7) {
                            world[x][y] = BLOCK_TYPES.COAL;
                        } else if (y > height + 20 && oreNoise > 0.8) {
                            world[x][y] = BLOCK_TYPES.IRON;
                        } else if (y > height + 30 && oreNoise > 0.85) {
                            world[x][y] = BLOCK_TYPES.GOLD;
                        }
                    }
                } else {
                    world[x][y] = BLOCK_TYPES.AIR;
                }
            } else if (y === height) {
                world[x][y] = BLOCK_TYPES.GRASS;
            } else {
                world[x][y] = BLOCK_TYPES.AIR;
            }
        }

        // Bedrock at bottom
        world[x][WORLD_HEIGHT - 1] = BLOCK_TYPES.BEDROCK;
    }

    // Generate trees
    for (let x = 5; x < WORLD_WIDTH - 5; x += Math.floor(Math.random() * 8 + 5)) {
        let groundY = -1;
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            if (world[x][y] === BLOCK_TYPES.GRASS) {
                groundY = y;
                break;
            }
        }

        if (groundY !== -1 && groundY > 10) {
            generateTree(x, groundY - 1);
        }
    }
}

function generateTree(x, y) {
    const height = Math.floor(Math.random() * 3 + 5);

    // Trunk
    for (let i = 0; i < height; i++) {
        if (y - i >= 0) {
            world[x][y - i] = BLOCK_TYPES.WOOD;
        }
    }

    // Leaves
    const topY = y - height;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 1; dy++) {
            const lx = x + dx;
            const ly = topY + dy;
            if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
                if (world[lx][ly] === BLOCK_TYPES.AIR && Math.random() > 0.2) {
                    world[lx][ly] = BLOCK_TYPES.LEAVES;
                }
            }
        }
    }
}

// Enemy class
class Enemy {
    constructor(x, y, type = 'slime') {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = 0;
        this.width = 32;
        this.height = 32;
        this.type = type;
        this.health = 30;
        this.maxHealth = 30;
        this.damage = 10;
        this.id = Date.now() + Math.random();
        this.color = type === 'slime' ? '#00ff00' : '#ff0000';
        this.onGround = false;
    }

    update(dt) {
        // Simple AI - move towards nearest player
        let nearestPlayer = null;
        let nearestDist = Infinity;

        for (let id in players) {
            const player = players[id];
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestPlayer = player;
            }
        }

        if (nearestPlayer && nearestDist < 400) {
            const dx = nearestPlayer.x - this.x;
            this.vx = dx > 0 ? 1 : -1;

            // Jump if blocked
            if (this.onGround && Math.random() < 0.02) {
                this.vy = -8;
            }
        }

        // Apply physics
        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        this.x += this.vx;
        this.y += this.vy;

        // Collision with world
        this.onGround = false;
        const collisions = checkCollision(this.x, this.y, this.width, this.height);

        if (collisions.bottom) {
            this.y = Math.floor(this.y / BLOCK_SIZE) * BLOCK_SIZE;
            this.vy = 0;
            this.onGround = true;
        }
        if (collisions.top) {
            this.vy = 0;
        }
        if (collisions.left || collisions.right) {
            this.vx *= -1;
        }

        // Damage players on contact
        if (nearestPlayer && nearestDist < 40) {
            if (Math.random() < 0.02) {
                damagePlayer(nearestPlayer.id, this.damage);
            }
        }
    }

    draw() {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Draw enemy (simple slime)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width/2, screenY + this.height/2,
                    this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(screenX + 8, screenY + 8, 6, 6);
        ctx.fillRect(screenX + 18, screenY + 8, 6, 6);

        // Health bar
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(screenX, screenY - 10, this.width, 4);
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : '#ff0000';
        ctx.fillRect(screenX, screenY - 10, this.width * healthPercent, 4);
    }
}

// Particle effects
function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 1,
            color: color
        });
    }
}

// Check collision with world
function checkCollision(x, y, width, height) {
    const left = Math.floor(x / BLOCK_SIZE);
    const right = Math.floor((x + width - 1) / BLOCK_SIZE);
    const top = Math.floor(y / BLOCK_SIZE);
    const bottom = Math.floor((y + height - 1) / BLOCK_SIZE);

    const result = {
        left: false,
        right: false,
        top: false,
        bottom: false
    };

    for (let bx = left; bx <= right; bx++) {
        for (let by = top; by <= bottom; by++) {
            if (isBlockSolid(bx, by)) {
                const blockX = bx * BLOCK_SIZE;
                const blockY = by * BLOCK_SIZE;

                // Determine collision side
                const overlapLeft = (x + width) - blockX;
                const overlapRight = (blockX + BLOCK_SIZE) - x;
                const overlapTop = (y + height) - blockY;
                const overlapBottom = (blockY + BLOCK_SIZE) - y;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapBottom) result.bottom = true;
                if (minOverlap === overlapTop) result.top = true;
                if (minOverlap === overlapLeft) result.left = true;
                if (minOverlap === overlapRight) result.right = true;
            }
        }
    }

    return result;
}

function isBlockSolid(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return true;
    return world[x][y] !== BLOCK_TYPES.AIR;
}

function getBlock(x, y) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return BLOCK_TYPES.BEDROCK;
    return world[x][y];
}

function setBlock(x, y, type) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return;
    if (world[x][y] === BLOCK_TYPES.BEDROCK) return; // Can't break bedrock
    world[x][y] = type;
}

// Player functions
function updatePlayer(player, dt) {
    if (!player) return;

    // Apply gravity
    player.vy += GRAVITY;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

    // Movement (only for local player)
    if (player.id === myPlayerId) {
        player.vx = 0;

        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            player.vx = -MOVE_SPEED;
            player.direction = -1;
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            player.vx = MOVE_SPEED;
            player.direction = 1;
        }

        // Jump
        if ((keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W']) && player.onGround) {
            player.vy = -JUMP_FORCE;
            player.onGround = false;
        }
    }

    // Update position
    player.x += player.vx;
    player.y += player.vy;

    // World bounds
    if (player.x < 0) player.x = 0;
    if (player.x > WORLD_WIDTH * BLOCK_SIZE - player.width) {
        player.x = WORLD_WIDTH * BLOCK_SIZE - player.width;
    }

    // Collision detection
    player.onGround = false;
    const collisions = checkCollision(player.x, player.y, player.width, player.height);

    if (collisions.bottom) {
        player.y = Math.floor((player.y + player.height) / BLOCK_SIZE) * BLOCK_SIZE - player.height;
        player.vy = 0;
        player.onGround = true;
    }
    if (collisions.top) {
        player.y = Math.ceil(player.y / BLOCK_SIZE) * BLOCK_SIZE;
        player.vy = 0;
    }
    if (collisions.left) {
        player.x = Math.ceil(player.x / BLOCK_SIZE) * BLOCK_SIZE;
    }
    if (collisions.right) {
        player.x = Math.floor((player.x + player.width) / BLOCK_SIZE) * BLOCK_SIZE - player.width;
    }

    // Send update to server
    if (player.id === myPlayerId && connected) {
        sendPlayerUpdate(player);
    }
}

function drawPlayer(player) {
    const screenX = player.x - camera.x;
    const screenY = player.y - camera.y;

    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(screenX, screenY, player.width, player.height);

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX, screenY, player.width, player.height);

    // Eyes
    ctx.fillStyle = '#fff';
    const eyeOffset = player.direction > 0 ? 4 : -4;
    ctx.fillRect(screenX + 8 + eyeOffset, screenY + 12, 6, 6);
    ctx.fillRect(screenX + 18 + eyeOffset, screenY + 12, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(screenX + 10 + eyeOffset, screenY + 14, 3, 3);
    ctx.fillRect(screenX + 20 + eyeOffset, screenY + 14, 3, 3);

    // Name
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, screenX + player.width/2, screenY - 10);

    // Health bar
    const healthPercent = player.health / player.maxHealth;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(screenX, screenY - 5, player.width, 3);
    ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : '#ff0000';
    ctx.fillRect(screenX, screenY - 5, player.width * healthPercent, 3);
}

// Update camera to follow player
function updateCamera() {
    const player = players[myPlayerId];
    if (!player) return;

    camera.x = player.x - canvas.width / 2 + player.width / 2;
    camera.y = player.y - canvas.height / 2 + player.height / 2;

    // Clamp camera
    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH * BLOCK_SIZE - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT * BLOCK_SIZE - canvas.height));
}

// Render functions
function drawWorld() {
    const startX = Math.floor(camera.x / BLOCK_SIZE);
    const startY = Math.floor(camera.y / BLOCK_SIZE);
    const endX = Math.min(WORLD_WIDTH, startX + Math.ceil(canvas.width / BLOCK_SIZE) + 1);
    const endY = Math.min(WORLD_HEIGHT, startY + Math.ceil(canvas.height / BLOCK_SIZE) + 1);

    for (let x = Math.max(0, startX); x < endX; x++) {
        for (let y = Math.max(0, startY); y < endY; y++) {
            const blockType = world[x][y];
            if (blockType === BLOCK_TYPES.AIR) continue;

            const screenX = x * BLOCK_SIZE - camera.x;
            const screenY = y * BLOCK_SIZE - camera.y;

            // Draw block
            ctx.fillStyle = BLOCK_COLORS[blockType];
            ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);

            // Add texture/variation
            ctx.fillStyle = 'rgba(0,0,0,' + (Math.sin(x * 0.5) * 0.1 + 0.1) + ')';
            ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);

            // Border
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
        }
    }

    // Draw mining progress
    if (miningProgress.x >= 0 && miningProgress.y >= 0) {
        const screenX = miningProgress.x * BLOCK_SIZE - camera.x;
        const screenY = miningProgress.y * BLOCK_SIZE - camera.y;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX + 2, screenY + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);

        // Progress overlay
        const progress = miningProgress.progress;
        ctx.fillStyle = `rgba(255,255,255,${progress * 0.3})`;
        ctx.fillRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE * progress);
    }
}

function drawBackground() {
    // Sky gradient based on time of day
    const skyColors = {
        day: ['#87CEEB', '#5C9FCC'],
        sunset: ['#FF6B6B', '#4ECDC4'],
        night: ['#0a0e27', '#1a1a3e']
    };

    let colors;
    if (dayNightCycle < 0.25 || dayNightCycle > 0.75) {
        colors = skyColors.night;
    } else if (dayNightCycle < 0.4 || dayNightCycle > 0.6) {
        colors = skyColors.sunset;
    } else {
        colors = skyColors.day;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars at night
    if (dayNightCycle < 0.25 || dayNightCycle > 0.75) {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 100; i++) {
            const x = (i * 123) % canvas.width;
            const y = (i * 456) % (canvas.height / 2);
            ctx.fillRect(x, y, 2, 2);
        }
    }
}

function drawUI() {
    const player = players[myPlayerId];
    if (!player) return;

    // Update health display
    document.getElementById('playerInfo').textContent =
        `Health: ${player.health}/${player.maxHealth}`;
    document.getElementById('healthFill').style.width =
        `${(player.health / player.maxHealth) * 100}%`;

    // Time
    const timeStr = dayNightCycle < 0.5 ? 'Night' : 'Day';
    document.getElementById('timeDisplay').textContent = `Time: ${timeStr}`;

    // Position
    const blockX = Math.floor(player.x / BLOCK_SIZE);
    const blockY = Math.floor(player.y / BLOCK_SIZE);
    document.getElementById('positionDisplay').textContent =
        `Position: ${blockX}, ${blockY}`;

    // Draw inventory
    const inventoryEl = document.getElementById('inventory');
    inventoryEl.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const slot = player.inventory[i];
        const slotEl = document.createElement('div');
        slotEl.className = 'inventorySlot';
        if (i === player.selectedSlot) {
            slotEl.classList.add('selected');
        }

        if (slot && slot.type && ITEMS[slot.type]) {
            const item = ITEMS[slot.type];
            slotEl.innerHTML = `
                <span style="font-size: 20px;">${item.emoji}</span>
                <span class="count">${slot.count > 1 ? slot.count : ''}</span>
            `;
        }

        slotEl.onclick = () => {
            player.selectedSlot = i;
        };

        inventoryEl.appendChild(slotEl);
    }

    // Draw crosshair/cursor
    const worldX = (mouse.x + camera.x) / BLOCK_SIZE;
    const worldY = (mouse.y + camera.y) / BLOCK_SIZE;
    const blockX2 = Math.floor(worldX);
    const blockY2 = Math.floor(worldY);

    const playerBlockX = Math.floor(player.x / BLOCK_SIZE);
    const playerBlockY = Math.floor(player.y / BLOCK_SIZE);
    const distance = Math.hypot(blockX2 - playerBlockX, blockY2 - playerBlockY);

    if (distance <= REACH_DISTANCE) {
        const screenX = blockX2 * BLOCK_SIZE - camera.x;
        const screenY = blockY2 * BLOCK_SIZE - camera.y;

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, BLOCK_SIZE, BLOCK_SIZE);
    }
}

// Mining and building
function handleMining(dt) {
    const player = players[myPlayerId];
    if (!player) return;

    const worldX = (mouse.x + camera.x) / BLOCK_SIZE;
    const worldY = (mouse.y + camera.y) / BLOCK_SIZE;
    const blockX = Math.floor(worldX);
    const blockY = Math.floor(worldY);

    const playerBlockX = Math.floor(player.x / BLOCK_SIZE);
    const playerBlockY = Math.floor(player.y / BLOCK_SIZE);
    const distance = Math.hypot(blockX - playerBlockX, blockY - playerBlockY);

    if (mouse.left && distance <= REACH_DISTANCE) {
        const blockType = getBlock(blockX, blockY);

        if (blockType !== BLOCK_TYPES.AIR && blockType !== BLOCK_TYPES.BEDROCK) {
            // Start or continue mining
            if (miningProgress.x !== blockX || miningProgress.y !== blockY) {
                miningProgress.x = blockX;
                miningProgress.y = blockY;
                miningProgress.progress = 0;
                miningProgress.lastTime = Date.now();
            }

            const now = Date.now();
            const elapsed = now - miningProgress.lastTime;
            miningProgress.progress += elapsed / MINING_SPEED;
            miningProgress.lastTime = now;

            if (miningProgress.progress >= 1) {
                // Block broken!
                const blockName = BLOCK_NAMES[blockType];
                if (blockName) {
                    addItemToInventory(player, blockName, 1);
                }

                setBlock(blockX, blockY, BLOCK_TYPES.AIR);
                createParticles(blockX * BLOCK_SIZE + BLOCK_SIZE/2,
                               blockY * BLOCK_SIZE + BLOCK_SIZE/2,
                               BLOCK_COLORS[blockType]);

                if (connected) {
                    ws.send(JSON.stringify({
                        type: 'blockBreak',
                        x: blockX,
                        y: blockY
                    }));
                }

                miningProgress.x = -1;
                miningProgress.y = -1;
                miningProgress.progress = 0;
            }
        } else {
            // Attack enemies
            for (let enemy of enemies) {
                const ex = enemy.x + enemy.width/2;
                const ey = enemy.y + enemy.height/2;
                const mx = (mouse.x + camera.x);
                const my = (mouse.y + camera.y);

                if (Math.hypot(ex - mx, ey - my) < 50) {
                    const selectedItem = player.inventory[player.selectedSlot];
                    if (selectedItem && selectedItem.type && ITEMS[selectedItem.type]) {
                        const damage = ITEMS[selectedItem.type].damage || 5;
                        enemy.health -= damage;
                        createParticles(ex, ey, '#ff0000', 5);

                        if (enemy.health <= 0) {
                            enemies = enemies.filter(e => e.id !== enemy.id);
                        }
                    }
                    break;
                }
            }
        }
    } else {
        miningProgress.x = -1;
        miningProgress.y = -1;
        miningProgress.progress = 0;
    }

    // Place block
    if (mouse.right && distance <= REACH_DISTANCE) {
        const blockType = getBlock(blockX, blockY);

        if (blockType === BLOCK_TYPES.AIR) {
            const selectedItem = player.inventory[player.selectedSlot];

            if (selectedItem && selectedItem.count > 0 && ITEMS[selectedItem.type] && ITEMS[selectedItem.type].block) {
                const placeBlockType = ITEMS[selectedItem.type].block;

                // Check if player is not in the way
                const playerCollides = (
                    blockX * BLOCK_SIZE < player.x + player.width &&
                    blockX * BLOCK_SIZE + BLOCK_SIZE > player.x &&
                    blockY * BLOCK_SIZE < player.y + player.height &&
                    blockY * BLOCK_SIZE + BLOCK_SIZE > player.y
                );

                if (!playerCollides) {
                    setBlock(blockX, blockY, placeBlockType);
                    selectedItem.count--;

                    if (connected) {
                        ws.send(JSON.stringify({
                            type: 'blockPlace',
                            x: blockX,
                            y: blockY,
                            blockType: placeBlockType
                        }));
                    }

                    mouse.right = false; // Prevent rapid placement
                }
            }
        }
    }
}

function addItemToInventory(player, itemType, count) {
    // Try to stack with existing
    for (let slot of player.inventory) {
        if (slot.type === itemType && slot.count < 99) {
            const addCount = Math.min(count, 99 - slot.count);
            slot.count += addCount;
            count -= addCount;
            if (count === 0) return;
        }
    }

    // Find empty slot
    for (let slot of player.inventory) {
        if (!slot.type || slot.count === 0) {
            slot.type = itemType;
            slot.count = count;
            return;
        }
    }
}

// Spawn enemies
function spawnEnemies() {
    // Only spawn at night
    if (dayNightCycle < 0.3 || dayNightCycle > 0.7) {
        return;
    }

    if (enemies.length < 10 && Math.random() < 0.02) {
        const player = players[myPlayerId];
        if (!player) return;

        // Spawn near player but off screen
        const spawnX = player.x + (Math.random() - 0.5) * 800;
        const spawnY = 100;

        enemies.push(new Enemy(spawnX, spawnY));
    }
}

function damagePlayer(playerId, damage) {
    const player = players[playerId];
    if (!player) return;

    player.health = Math.max(0, player.health - damage);

    if (playerId === myPlayerId && connected) {
        ws.send(JSON.stringify({
            type: 'playerDamage',
            targetId: playerId,
            damage: damage
        }));
    }

    if (player.health <= 0) {
        // Respawn
        player.health = player.maxHealth;
        player.x = 400;
        player.y = 100;
    }
}

// Update particles
function updateParticles(dt) {
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // Gravity
        p.life -= dt / 1000;
        return p.life > 0;
    });
}

function drawParticles() {
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x - camera.x, p.y - camera.y, 4, 4);
        ctx.globalAlpha = 1;
    });
}

// Network functions
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('Attempting to connect to:', wsUrl);

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('Connected to server');
            connected = true;
            reconnectAttempts = 0;
            document.getElementById('connectionStatus').classList.add('hidden');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };

        ws.onclose = (event) => {
            console.log('Disconnected from server', event.code, event.reason);
            connected = false;
            document.getElementById('connectionStatus').classList.remove('hidden');

            if (reconnectAttempts === 0) {
                // First disconnect - show helpful message
                document.getElementById('connectionStatus').innerHTML = `
                    <h3 style="color: #ff6b6b; margin-bottom: 10px;">⚠️ Server Not Running</h3>
                    <p style="margin-bottom: 10px;">To play TerraQuest, you need to start the server first:</p>
                    <ol style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        <li>Open terminal/command prompt</li>
                        <li>Navigate to: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">cd terraria-clone</code></li>
                        <li>Run: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">npm start</code></li>
                        <li>Refresh this page</li>
                    </ol>
                    <p style="font-size: 14px; color: #94a3b8;">Retrying connection... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})</p>
                `;
            } else {
                document.getElementById('connectionStatus').innerHTML = `
                    <h3 style="color: #ff6b6b; margin-bottom: 10px;">Reconnecting...</h3>
                    <p>Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}</p>
                    <p style="font-size: 14px; margin-top: 10px;">Make sure the server is running with <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">npm start</code></p>
                `;
            }

            // Try to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectToServer, 3000);
            } else {
                document.getElementById('connectionStatus').innerHTML = `
                    <h3 style="color: #ff6b6b; margin-bottom: 10px;">❌ Connection Failed</h3>
                    <p style="margin-bottom: 15px;">Could not connect to game server.</p>
                    <p style="margin-bottom: 10px;"><strong>To start the server:</strong></p>
                    <ol style="text-align: left; margin: 10px 0; padding-left: 20px;">
                        <li>Open terminal in the <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">terraria-clone</code> folder</li>
                        <li>Run: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">npm install</code> (first time only)</li>
                        <li>Run: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">npm start</code></li>
                        <li>Wait for "server running on port 3000"</li>
                        <li><button onclick="location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #00ff88; border: none; color: #000; cursor: pointer; font-weight: bold;">Refresh Page</button></li>
                    </ol>
                `;
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            connected = false;
        };
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        connected = false;
        document.getElementById('connectionStatus').classList.remove('hidden');
        document.getElementById('connectionStatus').innerHTML = `
            <h3 style="color: #ff6b6b;">Connection Error</h3>
            <p>Make sure the server is running: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px;">npm start</code></p>
        `;
    }
}

function handleServerMessage(data) {
    switch(data.type) {
        case 'init':
            myPlayerId = data.playerId;
            players = data.gameState.players;

            // Generate world with server seed
            if (data.gameState.worldSeed) {
                generateWorld(data.gameState.worldSeed);
            }
            break;

        case 'playerJoined':
            players[data.player.id] = data.player;
            console.log(`Player ${data.player.name} joined`);
            break;

        case 'playerLeft':
            delete players[data.playerId];
            console.log(`Player left`);
            break;

        case 'playerUpdate':
            if (data.player.id !== myPlayerId) {
                players[data.player.id] = data.player;
            }
            break;

        case 'blockBreak':
            if (data.playerId !== myPlayerId) {
                setBlock(data.x, data.y, BLOCK_TYPES.AIR);
                createParticles(data.x * BLOCK_SIZE + BLOCK_SIZE/2,
                               data.y * BLOCK_SIZE + BLOCK_SIZE/2,
                               BLOCK_COLORS[getBlock(data.x, data.y)]);
            }
            break;

        case 'blockPlace':
            if (data.playerId !== myPlayerId) {
                setBlock(data.x, data.y, data.blockType);
            }
            break;

        case 'playerDamage':
            if (players[data.playerId]) {
                players[data.playerId].health = data.health;
            }
            break;
    }
}

function sendPlayerUpdate(player) {
    if (!connected) return;

    ws.send(JSON.stringify({
        type: 'playerUpdate',
        player: {
            id: player.id,
            x: player.x,
            y: player.y,
            vx: player.vx,
            vy: player.vy,
            direction: player.direction,
            health: player.health,
            selectedSlot: player.selectedSlot
        }
    }));
}

// Input handlers
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // Number keys for inventory
    const num = parseInt(e.key);
    if (num >= 1 && num <= 8) {
        const player = players[myPlayerId];
        if (player) {
            player.selectedSlot = num - 1;
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const player = players[myPlayerId];
    if (!player) return;

    if (e.deltaY > 0) {
        player.selectedSlot = (player.selectedSlot + 1) % 8;
    } else {
        player.selectedSlot = (player.selectedSlot - 1 + 8) % 8;
    }
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Game loop
let lastTime = Date.now();

function gameLoop() {
    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;

    // Update
    gameTime += dt;
    dayNightCycle = ((gameTime / 60000) % 1); // 1 minute full cycle

    for (let id in players) {
        updatePlayer(players[id], dt);
    }

    enemies.forEach(enemy => enemy.update(dt));
    updateParticles(dt);
    handleMining(dt);
    spawnEnemies();
    updateCamera();

    // Draw
    drawBackground();
    drawWorld();

    for (let id in players) {
        drawPlayer(players[id]);
    }

    enemies.forEach(enemy => enemy.draw());
    drawParticles();
    drawUI();

    requestAnimationFrame(gameLoop);
}

// Start game
generateWorld(12345); // Default seed
connectToServer();
gameLoop();
