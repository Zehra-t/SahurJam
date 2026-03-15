/**
 * Sahur Sprint V2
 * 
 * Subway Surfers style endless runner using a pseudo-3D "forward runner" perspective.
 * Features: Sliding, Power-ups, Dog-Chase second chance system, and Parallax backgrounds.
 */

// ====== DOM & GLOBALS ======
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreValue = document.getElementById('scoreValue');
const finalScore = document.getElementById('finalScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreHUD = document.getElementById('scoreHUD');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const x2Indicator = document.getElementById('x2Indicator');
const x2Bar = document.getElementById('x2Bar');
const speedIndicator = document.getElementById('speedIndicator');
const speedBar = document.getElementById('speedBar');

let GAME_WIDTH = window.innerWidth;
let GAME_HEIGHT = window.innerHeight;

const imgDrummer = new Image();
imgDrummer.src = 'drummer.png';

const imgCannon = new Image();
imgCannon.src = 'cannon.png';

const imgCoin = new Image();
imgCoin.src = 'coin.png';

const imgDog = new Image();
imgDog.src = 'dog.png';

const imgMinaret = new Image();
imgMinaret.src = 'minaret.png';

const imgLanterns = new Image();
imgLanterns.src = 'lanterns.png';

let isIftarMode = false;
const themeToggleBtn = document.getElementById('themeToggleBtn');
themeToggleBtn.addEventListener('click', () => {
    isIftarMode = !isIftarMode;
    themeToggleBtn.innerHTML = isIftarMode ? '☀️ İftar' : '🌙 Sahur';
    themeToggleBtn.style.background = isIftarMode ? 'rgba(234, 88, 12, 0.8)' : 'rgba(30, 41, 59, 0.8)';
});

let gameState = 'START'; 
let score = 0;
let lastTime = 0;
let totalDistance = 0;

// ====== CONFIGURATION ======
let FOV;
let HORIZON_Y;
let CAMERA_Y;

const LANE_WIDTH = 300; // Increased path size
const LANES = 3; 

let currentSpeed = 800;
let BASE_SPEED = 800;
const SPEED_INC = 15; 
const MAX_SPEED = 2500;

// ====== GAME STATE ARRAYS ======
let entities = [];
let particles = [];
let floatingTexts = [];

// Parallax Layers
let stars = [];
let farBuildings = [];
let midBuildings = [];
let foregroundPillars = [];

// Shake effect
let cameraShake = 0;

// Dog Chase System
let isDogChasing = false;
let chaseTimer = 0;
const CHASE_DURATION = 15; // seconds to escape the dog
let chaseDistanceOffset = 400; // how far behind the dog is

// Powerup System
let activePowerups = {
    x2: 0, // time remaining
    speed: 0
};
const X2_DURATION = 10;
const SPEED_DURATION = 5;

// ====== PLAYER STATE ======
const player = {
    x: 0,
    y: 0,
    z: 100, 
    targetLane: 0,
    vy: 0,
    state: 'RUNNING', // RUNNING, JUMPING, SLIDING
    slideTimer: 0,
    hitboxHeight: 70
};

// Handle Resizing
function resize() {
    GAME_WIDTH = window.innerWidth;
    GAME_HEIGHT = window.innerHeight;
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    
    FOV = GAME_WIDTH * 0.8;
    HORIZON_Y = GAME_HEIGHT * 0.45;
    CAMERA_Y = 150; 
}
window.addEventListener('resize', resize);
resize();

// ====== PROCEDURAL BACKGROUND INIT ======
function initBackground() {
    stars = [];
    for(let i=0; i<80; i++) {
        stars.push({
            px: Math.random(),
            py: Math.random() * 0.45, 
            size: 0.5 + Math.random() * 1.5,
            twinkleSpeed: 2 + Math.random() * 5,
            offset: Math.random() * Math.PI * 2
        });
    }

    // Far Layer (Mosques/Tall Buildings)
    farBuildings = [];
    let px = 0;
    while(px < 1.0) {
        let w = 0.05 + Math.random() * 0.08;
        let h = 0.1 + Math.random() * 0.15;
        let isMosque = Math.random() < 0.2;
        farBuildings.push({ px: px, pw: w, ph: h, isMosque });
        px += w;
    }

    // Mid Layer (Houses)
    midBuildings = [];
    px = 0;
    while(px < 1.5) { // generate extra for scrolling wrapping
        let w = 0.06 + Math.random() * 0.05;
        let h = 0.05 + Math.random() * 0.08;
        midBuildings.push({ px: px, pw: w, ph: h, windowLight: Math.random() > 0.5 });
        px += w;
    }
}
initBackground();

// ====== INPUT HANDLING ======
window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (gameState === 'START' && (e.key === ' ' || e.key === 'Enter')) {
        startGame(); return;
    }
    if (gameState === 'GAMEOVER' && (e.key === ' ' || e.key === 'Enter')) {
        startGame(); return;
    }

    if (gameState !== 'PLAYING') return;

    // Lane switching
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        player.targetLane = Math.max(-1, player.targetLane - 1);
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        player.targetLane = Math.min(1, player.targetLane + 1);
    }
    
    // Jump
    if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp' || e.key === ' ') && player.state !== 'JUMPING') {
        player.vy = 850; 
        player.state = 'JUMPING';
        player.slideTimer = 0;
        player.hitboxHeight = 70;
    }

    // Slide
    if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && player.state !== 'SLIDING') {
        // Fast drop if in air
        if (player.state === 'JUMPING') {
            player.vy = -1500; 
        }
        player.state = 'SLIDING';
        player.slideTimer = 0.8; // Slide duration
        player.hitboxHeight = 30; // Shrink hitbox
    }
});

// ====== GAME CONTROL ======
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreHUD.classList.remove('hidden');
    
    x2Indicator.classList.add('hidden');
    speedIndicator.classList.add('hidden');

    score = 0;
    scoreValue.innerText = score;
    BASE_SPEED = 800;
    currentSpeed = BASE_SPEED;
    totalDistance = 0;
    
    entities = [];
    particles = [];
    floatingTexts = [];
    
    player.x = 0;
    player.targetLane = 0;
    player.y = 0;
    player.vy = 0;
    player.state = 'RUNNING';
    player.hitboxHeight = 70;
    
    activePowerups.x2 = 0;
    activePowerups.speed = 0;

    isDogChasing = false;
    chaseTimer = 0;

    cameraShake = 0;
    gameState = 'PLAYING';
    lastTime = performance.now();
    
    spawnEntityDistance = 1000;
}

function handleHit() {
    if (isDogChasing) {
        // Second hit = Game Over
        gameOver();
    } else {
        // First hit = Stumble & Spawn Dog
        isDogChasing = true;
        chaseTimer = CHASE_DURATION;
        chaseDistanceOffset = 300;
        cameraShake = 0.4;
        
        // Push player slightly forward to recover, slow down speed momentarily
        currentSpeed *= 0.7; 
        
        floatingTexts.push({
            x: player.x, y: 150, z: player.z,
            text: 'WATCH OUT!', life: 1.5, color: '#ef4444'
        });
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    cameraShake = 0.6; 
    
    setTimeout(() => {
        scoreHUD.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
        finalScore.innerText = score;
    }, 500); 
}

// ====== MATH & PROJECTION ======
function project(worldX, worldY, worldZ) {
    if (worldZ < 0) return null;
    const scale = FOV / (FOV + worldZ);
    const screenX = GAME_WIDTH / 2 + worldX * scale;
    const screenY = HORIZON_Y + (CAMERA_Y - worldY) * scale; 
    return { screenX, screenY, scale };
}

// ====== SPAWNING SYSTEM ======
let spawnEntityDistance = 1000;
const CHUNK_Z = 3000; 

function spawnTick(dt) {
    if (currentSpeed * dt > 1000) return; 
    spawnEntityDistance -= currentSpeed * dt;
    
    if (spawnEntityDistance <= 0) {
        let lane = Math.floor(Math.random() * 3) - 1; 
        let typeRand = Math.random();
        let groupZLength = 0;
        
        if (typeRand < 0.35) {
            // Collectibles: Coins (25%) or Powerups (10%)
            if (Math.random() < 0.15) {
                let entity = {
                    lane: lane, x: lane * LANE_WIDTH, y: 0, z: CHUNK_Z,
                    markedForDeletion: false,
                    type: Math.random() > 0.5 ? 'powerup_x2' : 'powerup_speed',
                    hitArea: 'all'
                };
                entities.push(entity);
            } else {
                // Spawn a line or arc of coins!
                let coinCount = 4 + Math.floor(Math.random() * 6); // 4 to 9 coins
                let spacing = 120;
                groupZLength = coinCount * spacing;
                let isArc = Math.random() < 0.4; // 40% chance to be an aerial arc requiring a jump
                
                for (let i = 0; i < coinCount; i++) {
                    let coinY = 0;
                    if (isArc) {
                        // Parabola shape for jumping
                        let half = (coinCount - 1) / 2;
                        let norm = (i - half) / half; // ranges from -1 to 1
                        coinY = (1 - norm * norm) * 150; // max height 150
                    }
                    entities.push({
                        lane: lane,
                        x: lane * LANE_WIDTH,
                        y: coinY,
                        z: CHUNK_Z + (i * spacing),
                        type: 'coin',
                        hitArea: 'all',
                        markedForDeletion: false
                    });
                }
            }
        } else {
            // Obstacles
            let entity = {
                lane: lane, x: lane * LANE_WIDTH, y: 0, z: CHUNK_Z,
                markedForDeletion: false
            };
            
            let rand = Math.random();
            if (rand < 0.25) {
                entity.type = 'crate';
                entity.hitArea = 'ground';
            }
            else if (rand < 0.5) {
                entity.type = 'trashbin';
                entity.hitArea = 'ground';
            }
            else if (rand < 0.75) {
                entity.type = 'minaret';
                entity.hitArea = 'ground';
            }
            else {
                entity.type = 'lanterns';
                entity.hitArea = 'high';
            }
            entities.push(entity);
        }
        
        spawnEntityDistance = 300 + Math.random() * 500 + groupZLength + (3000 - currentSpeed)*0.4; 
    }
}

// ====== UPDATE LOGIC ======
function update(dt) {
    // Normal Speed progression
    if (BASE_SPEED < MAX_SPEED) {
        BASE_SPEED += SPEED_INC * dt;
    }
    
    // Apply Speed Powerup
    let targetSpeed = BASE_SPEED;
    if (activePowerups.speed > 0) {
        activePowerups.speed -= dt;
        targetSpeed *= 1.5;
        
        // UI updates
        speedIndicator.classList.remove('hidden');
        speedBar.style.transform = `scaleX(${activePowerups.speed / SPEED_DURATION})`;
        if (activePowerups.speed <= 0) speedIndicator.classList.add('hidden');
    }

    // Lerp actual speed
    currentSpeed += (targetSpeed - currentSpeed) * 5 * dt;
    totalDistance += currentSpeed * dt;

    // x2 Powerup Logic UI
    if (activePowerups.x2 > 0) {
        activePowerups.x2 -= dt;
        x2Indicator.classList.remove('hidden');
        x2Bar.style.transform = `scaleX(${activePowerups.x2 / X2_DURATION})`;
        if (activePowerups.x2 <= 0) x2Indicator.classList.add('hidden');
    }

    // Player Lane logic (smooth movement)
    let targetX = player.targetLane * LANE_WIDTH;
    player.x += (targetX - player.x) * 15 * dt;
    
    // Player Jump logic
    if (player.state === 'JUMPING') {
        player.vy -= 2800 * dt; // Gravity
        player.y += player.vy * dt;
        if (player.y <= 0) {
            player.y = 0;
            player.vy = 0;
            player.state = 'RUNNING';
            player.hitboxHeight = 70;
            
            // Dust particle on land
            for(let i=0; i<3; i++) spawnDust(player.x, player.z);
        }
    }

    // Player Slide logic
    if (player.state === 'SLIDING') {
        player.slideTimer -= dt;
        if (player.slideTimer <= 0) {
            player.state = 'RUNNING';
            player.hitboxHeight = 70;
        }
        if (Math.random() < 0.2) spawnDust(player.x, player.z); // sliding dust
    }

    // Chase System
    if (isDogChasing) {
        chaseTimer -= dt;
        // Make dog visually approach based on timer
        chaseDistanceOffset = 100 + (chaseTimer / CHASE_DURATION) * 200;
        if (chaseTimer <= 0) {
            isDogChasing = false; // Successfully outran the dog!
            floatingTexts.push({
                x: player.x, y: 150, z: player.z,
                text: 'ESCAPED!', life: 1.0, color: '#4ade80'
            });
        }
    }

    if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - dt * 2);

    spawnTick(dt);

    // Collision Check
    const HIT_Z_TOLERANCE = 40;
    const HIT_X_TOLERANCE = 60;

    for (let e of entities) {
        e.z -= currentSpeed * dt;

        if (Math.abs(e.z - player.z) < HIT_Z_TOLERANCE && Math.abs(e.x - player.x) < HIT_X_TOLERANCE) {
            if (!e.markedForDeletion) {
                let hitResult = checkVerticalCollision(e);
                if (hitResult) {
                    e.markedForDeletion = true;
                    handleCollision(e);
                }
            }
        }
        if (e.z < -200) e.markedForDeletion = true;
    }
    
    entities = entities.filter(e => !e.markedForDeletion);

    // Particles & Texts
    updateParticlesAndText(dt);
}

function checkVerticalCollision(entity) {
    if (entity.hitArea === 'all') return true; // Collectibles hit regardless of height

    if (entity.hitArea === 'ground') {
        // Hit if player is too low (not jumping high enough)
        return player.y < 50; 
    }

    if (entity.hitArea === 'high') {
        // Hit if player is NOT sliding, or if they jumped into it
        return player.hitboxHeight > 40 || player.y > 20; 
    }
    return false;
}

function handleCollision(entity) {
    if (entity.type === 'coin') {
        let gain = activePowerups.x2 > 0 ? 2 : 1;
        score += gain;
        scoreValue.innerText = score;
        spawnFloatingText(`+${gain}`, '#fde047', entity.x, 100);
        spawnCoinSparkles(entity.x);
    } 
    else if (entity.type === 'powerup_x2') {
        activePowerups.x2 = X2_DURATION;
        spawnFloatingText('DOUBLE BAHŞİŞ!', '#facc15', entity.x, 150);
        spawnCoinSparkles(entity.x);
    }
    else if (entity.type === 'powerup_speed') {
        activePowerups.speed = SPEED_DURATION;
        spawnFloatingText('SPEED BOOST!', '#38bdf8', entity.x, 150);
        spawnCoinSparkles(entity.x);
    }
    else {
        // Obstacle Hit
        handleHit();
    }
}

function spawnDust(x, z) {
    particles.push({
        x: x + (Math.random()-0.5)*40, y: 5, z: z,
        vx: (Math.random()-0.5)*100, vy: 20 + Math.random()*50, vz: (Math.random()-0.5)*100,
        color: 'rgba(200, 200, 200, 0.5)', life: 0.5 + Math.random()*0.5, size: 10 + Math.random()*15, isDust: true
    });
}

function spawnCoinSparkles(x) {
    for(let i=0; i<5; i++) {
        particles.push({
            x: x, y: 60, z: player.z,
            vx: (Math.random()-0.5)*200, vy: 150 + Math.random()*200, vz: (Math.random()-0.5)*200,
            color: '#fef08a', life: 0.8, size: 5, isDust: false
        });
    }
}

function spawnFloatingText(text, color, x, y) {
    floatingTexts.push({ x: x, y: y, z: player.z, text: text, life: 1.0, color: color });
}

function updateParticlesAndText(dt) {
    for (let ft of floatingTexts) {
        ft.y += 100 * dt;
        ft.life -= dt * 1.5;
    }
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
    
    for (let p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (!p.isDust) p.vy -= 800 * dt; 
        p.life -= dt * 2;
        p.size *= 0.95;
    }
    particles = particles.filter(p => p.life > 0);
}

// ====== DRAWING ROUTINES ======
function drawBackground(time) {
    // 1) Sky color gradient (Softened for Iftar)
    let skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    if (isIftarMode) {
        skyGrad.addColorStop(0, '#fde047'); // Soft warm yellow top
        skyGrad.addColorStop(1, '#fdba74'); // Soft peach horizon
    } else {
        skyGrad.addColorStop(0, '#0f172a'); // Deep dark blue
        skyGrad.addColorStop(1, '#3b0764'); // Dark purple
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, HORIZON_Y);

    // 2) Sky details (Stars / Sun / Clouds / Birds / Fireflies)
    if (!isIftarMode) {
        ctx.fillStyle = '#fff';
        for (const star of stars) {
            const alpha = Math.abs(Math.sin(time * star.twinkleSpeed + star.offset));
            ctx.globalAlpha = 0.2 + 0.8 * alpha;
            ctx.beginPath();
            ctx.arc(star.px * GAME_WIDTH, star.py * GAME_HEIGHT, star.size, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        
        // Crescent Moon
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(GAME_WIDTH * 0.85, HORIZON_Y * 0.2, 40, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        // Shift the inner circle more aggressively to make a crisp crescent shape
        ctx.arc(GAME_WIDTH * 0.85 - 15, HORIZON_Y * 0.2 - 10, 38, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    } else {
        // --- IFTAR MODE ---
        // Sun - Soft and integrated
        ctx.fillStyle = '#fde047'; // Match the top gradient for a softer look
        ctx.beginPath();
        ctx.arc(GAME_WIDTH * 0.85, HORIZON_Y * 0.35, 45, 0, Math.PI*2);
        ctx.fill();

        // Minimal Clouds
        function drawPuffyCloud(cx, cy, scale) {
            ctx.beginPath();
            ctx.arc(cx, cy, 20*scale, Math.PI*0.5, Math.PI*1.5);
            ctx.arc(cx+15*scale, cy-15*scale, 25*scale, Math.PI, Math.PI*2);
            ctx.arc(cx+45*scale, cy-10*scale, 20*scale, Math.PI*1.2, Math.PI*2.2);
            ctx.arc(cx+55*scale, cy, 15*scale, Math.PI*1.5, Math.PI*0.5);
            ctx.lineTo(cx, cy+20*scale);
            ctx.fill();
        }
        
        ctx.fillStyle = 'rgba(254, 215, 170, 0.4)'; // very soft warm white
        let c1x = (GAME_WIDTH * 0.2 + time * 6) % (GAME_WIDTH + 300) - 150;
        drawPuffyCloud(c1x, HORIZON_Y * 0.2, 1.0);
        
        let c2x = (GAME_WIDTH * 0.6 + time * 4) % (GAME_WIDTH + 300) - 150;
        drawPuffyCloud(c2x, HORIZON_Y * 0.25, 0.7);

        // Single distant bird
        ctx.strokeStyle = '#9a3412';
        ctx.lineWidth = 2;
        let bx = GAME_WIDTH * 0.7; let by = HORIZON_Y * 0.15;
        let flap = Math.sin(time * 3) * 4;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - flap); ctx.quadraticCurveTo(bx - 5, by, bx, by);
        ctx.quadraticCurveTo(bx + 5, by, bx + 10, by - flap);
        ctx.stroke();
    // Sub-decorations: simple lanterns hanging from top
    ctx.strokeStyle = isIftarMode ? '#ea580c' : '#fde047'; // Softened stroke
    ctx.lineWidth = 2;
    ctx.fillStyle = isIftarMode ? '#f97316' : '#facc15'; // Softened lantern color
    const lanternPositions = [0.15, 0.3, 0.7, 0.85];
    for (let lx of lanternPositions) {
        let lx_px = GAME_WIDTH * lx;
        let lh = 30 + Math.sin(time * 2 + lx*10) * 10;
        ctx.beginPath();
        ctx.moveTo(lx_px, 0);
        ctx.lineTo(lx_px, HORIZON_Y * 0.15);
        ctx.stroke();
        
        // simple lantern diamond
        ctx.beginPath();
        ctx.moveTo(lx_px, HORIZON_Y * 0.15);
        ctx.lineTo(lx_px - 10, HORIZON_Y * 0.15 + 15);
        ctx.lineTo(lx_px, HORIZON_Y * 0.15 + 30);
        ctx.lineTo(lx_px + 10, HORIZON_Y * 0.15 + 15);
        ctx.fill();
    }
    // 4) Static Mosque Silhouette Background Header (PRO/CLEAN VERSION)
    ctx.save();
    ctx.fillStyle = isIftarMode ? '#451a03' : '#020617'; 
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = -2;

    let mCenter = GAME_WIDTH / 2;
    let ground = HORIZON_Y;
    
    // Smooth geometric Main Dome
    ctx.beginPath();
    ctx.arc(mCenter, ground, 160, Math.PI, 0);
    ctx.fill();
    // Square base under Main Dome for sharp corners
    ctx.fillRect(mCenter - 160, ground - 30, 320, 30);

    // Symmetric Side Domes
    ctx.beginPath();
    ctx.arc(mCenter - 140, ground - 30, 80, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(mCenter - 220, ground - 30, 160, 30);

    ctx.beginPath();
    ctx.arc(mCenter + 140, ground - 30, 80, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(mCenter + 60, ground - 30, 160, 30);
    
    // Sharp Minarets (Clean geometry)
    ctx.shadowBlur = 0; // Turn off shadow so thin lines look sharp
    
    let leftX = mCenter - 240;
    let rightX = mCenter + 240;
    let minHeight = 280;
    let minW = 20;
    
    // Left Minaret Tower
    ctx.fillRect(leftX - minW/2, ground - minHeight, minW, minHeight);
    // Left Roof Cone
    ctx.beginPath(); ctx.moveTo(leftX - minW/2 - 2, ground - minHeight);
    ctx.lineTo(leftX + minW/2 + 2, ground - minHeight); ctx.lineTo(leftX, ground - minHeight - 40); ctx.fill();
    // Left Balconies
    ctx.fillRect(leftX - minW/2 - 6, ground - minHeight + 60, minW + 12, 6);
    ctx.fillRect(leftX - minW/2 - 6, ground - minHeight + 140, minW + 12, 6);

    // Right Minaret Tower
    ctx.fillRect(rightX - minW/2, ground - minHeight, minW, minHeight);
    // Right Roof Cone
    ctx.beginPath(); ctx.moveTo(rightX - minW/2 - 2, ground - minHeight);
    ctx.lineTo(rightX + minW/2 + 2, ground - minHeight); ctx.lineTo(rightX, ground - minHeight - 40); ctx.fill();
    // Right Balconies
    ctx.fillRect(rightX - minW/2 - 6, ground - minHeight + 60, minW + 12, 6);
    ctx.fillRect(rightX - minW/2 - 6, ground - minHeight + 140, minW + 12, 6);
    
    // Straight solid ground block matching mosque color
    ctx.fillRect(0, ground - 30, GAME_WIDTH, 30);
    ctx.restore();

    // 5) "Hoşgeldin Ramazan" Text (Drawn LAST so it's always in front!)
    ctx.save();
    ctx.fillStyle = isIftarMode ? '#fde047' : '#fde047'; // Bright yellow so it pops
    ctx.font = `bold ${GAME_HEIGHT * 0.08}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    // Very strong contrasting text shadow (glow)
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    // Draw string higher up, but cleanly over anything
    ctx.fillText("Hoşgeldin Ramazan", GAME_WIDTH / 2, HORIZON_Y * 0.20); // Moved up slightly
    ctx.restore();
}

function drawRoad() {
    let groundGrad = ctx.createLinearGradient(0, HORIZON_Y, 0, GAME_HEIGHT);
    groundGrad.addColorStop(0, isIftarMode ? '#c2410c' : '#1e293b'); // Softer ground top (Sahur fixed lightness)
    groundGrad.addColorStop(1, isIftarMode ? '#7c2d12' : '#0f172a'); // Softer ground bottom
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, HORIZON_Y, GAME_WIDTH, GAME_HEIGHT - HORIZON_Y);

    // Depth Lines
    const zFar = 5000;
    
    // We want the road to cover the entire horizontal screen width below the horizon
    ctx.fillStyle = isIftarMode ? '#fb923c' : '#334155'; // Fixed sahur road color to not be pitch black
    ctx.fillRect(0, HORIZON_Y, GAME_WIDTH, GAME_HEIGHT - HORIZON_Y);

    // Scrolling dashed lines
    const dashLength = 150;
    const spacing = 300;
    const offset = (-totalDistance) % spacing;

    ctx.strokeStyle = isIftarMode ? '#fef08a' : '#475569'; // Softer dashed lines
    drawDashedLine(-LANE_WIDTH * 0.5, offset, dashLength, spacing, zFar);
    drawDashedLine(LANE_WIDTH * 0.5, offset, dashLength, spacing, zFar);
}

function drawDashedLine(x, offset, dashLen, spacing, maxZ) {
    for (let z = offset; z < maxZ; z += spacing) {
        if (z < 0) continue;
        const p1 = project(x, 0, z);
        const p2 = project(x, 0, z + dashLen);
        if (p1 && p2 && p1.scale > 0 && p2.scale > 0) {
            ctx.beginPath();
            ctx.moveTo(p1.screenX, p1.screenY);
            ctx.lineTo(p2.screenX, p2.screenY);
            ctx.lineWidth = 10 * p1.scale;
            ctx.stroke();
        }
    }
}

// ==== FOREGROUND DRAW PROCEDURES ====

function drawDrummer(x, y, scale, time) {
    if (!imgDrummer.complete || imgDrummer.naturalWidth === 0) return;
    
    scale *= 1.25; // Increase character scaling
    let bob = (player.state === 'RUNNING') ? Math.sin(time * 25) * 6 * scale : 0;
    
    let sizeW = 100 * scale;
    let sizeH = 100 * scale * (imgDrummer.naturalHeight / imgDrummer.naturalWidth);
    let jumpOffset = (player.state !== 'RUNNING') ? player.y * scale : 0;

    if (player.state === 'SLIDING') {
        sizeH = sizeH * 0.7; // squash
        y += 20 * scale;
    } else if (player.state === 'JUMPING') {
        sizeH = sizeH * 1.2; // stretch
        bob = -20 * scale;
    }
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + jumpOffset, sizeW*0.3, sizeW*0.1, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.drawImage(imgDrummer, x - sizeW/2, y - sizeH + (sizeH*0.1) + bob - jumpOffset, sizeW, sizeH);
}

function drawDogEntity(x, y, scale, time) {
    if (!imgDog.complete || imgDog.naturalWidth === 0) return;
    
    scale *= 1.25; // Increase dog scaling
    let bob = Math.sin(time * 30) * 5 * scale;
    let sizeW = 150 * scale;
    let sizeH = 150 * scale * (imgDog.naturalHeight / imgDog.naturalWidth);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, sizeW*0.3, sizeH*0.1, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.drawImage(imgDog, x - sizeW/2, y - sizeH + (sizeH*0.1) + bob, sizeW, sizeH);
}

function drawCrate(x, y, scale) {
    scale *= 1.2; // Increase scale
    // Treat crate as Ramazan Cannon (jump over)
    if (imgCannon.complete && imgCannon.naturalWidth > 0) {
        let sizeW = 120 * scale;
        let sizeH = 120 * scale * (imgCannon.naturalHeight / imgCannon.naturalWidth);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(x, y, sizeW*0.4, sizeH*0.15, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.drawImage(imgCannon, x - sizeW/2, y - sizeH + (sizeH*0.1), sizeW, sizeH);
    } else {
        const s = 60 * scale;
        ctx.fillStyle = '#78350f'; 
        ctx.fillRect(x - s/2, y - s, s, s);
    }
}

function drawTrashBin(x, y, scale) {
    // Alternate ground obstacle: Also Ramazan Cannon for now
    drawCrate(x, y, scale);
}

function drawLaundry(x, y, scale) {
    // Mahya / Minaret style obstacle (slide under)
    drawCrate(x, y, scale); // share cannon visual for standard ground obstacles
}

function drawMinaret(x, y, scale) {
    scale *= 1.2;
    if (imgMinaret.complete && imgMinaret.naturalWidth > 0) {
        let sizeW = 150 * scale; // Ground scale width
        let sizeH = 150 * scale * (imgMinaret.naturalHeight / imgMinaret.naturalWidth);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath();
        ctx.ellipse(x, y, sizeW*0.3, sizeH*0.1, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.drawImage(imgMinaret, x - sizeW/2, y - sizeH + (sizeH*0.05), sizeW, sizeH);
    }
}

function drawLanterns(x, y, scale) {
    scale *= 1.2;
    // High obstacle (slide under)
    if (imgLanterns.complete && imgLanterns.naturalWidth > 0) {
        let sizeW = 200 * scale;
        let sizeH = 200 * scale * (imgLanterns.naturalHeight / imgLanterns.naturalWidth);
        // Draw hanging high above the ground
        ctx.drawImage(imgLanterns, x - sizeW/2, y - sizeH - 60*scale, sizeW, sizeH);
    }
}

function drawCoin(x, y, scale, time) {
    scale *= 1.2;
    const s = 50 * scale;
    let hover = Math.sin(time * 8) * 15 * scale;
    
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, s*0.3, s*0.1, 0, 0, Math.PI*2);
    ctx.fill();

    if (imgCoin.complete && imgCoin.naturalWidth > 0) {
        ctx.drawImage(imgCoin, x - s/2, y - s - hover, s, s);
    }
}

function drawPowerup(x, y, scale, time, type) {
    const s = 30 * scale;
    let hover = Math.sin(time * 10) * 20 * scale;
    
    let color = type === 'powerup_x2' ? '#facc15' : '#38bdf8';
    
    ctx.shadowColor = color;
    ctx.shadowBlur = 25 * scale;
    
    // Diamond shape
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(x, y - s*2 - hover);
    ctx.lineTo(x + s, y - s - hover);
    ctx.lineTo(x, y - hover);
    ctx.lineTo(x - s, y - s - hover);
    ctx.fill();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 4 * scale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Icon Text
    ctx.fillStyle = color;
    ctx.font = `bold ${25 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'powerup_x2' ? 'x2' : '⚡', x, y - s - hover);
}


// ====== MAIN LOOP ======
function draw(dt, time) {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    if (cameraShake > 0) {
        let maxShake = cameraShake * 40; 
        ctx.translate((Math.random() - 0.5) * maxShake, (Math.random() - 0.5) * maxShake);
    }

    drawBackground(time);
    drawRoad();

    let renderList = [];

    renderList.push({ type: 'player', z: player.z, obj: player });

    // Ghost Dog (Second Chance System)
    if (isDogChasing) {
        // Place dog at a fixed steady Z relative to player to keep it consistently framed in 2D
        let dogZ = player.z - 40; 
        if (dogZ < 30) dogZ = 30; // Prevent it from going behind camera
        renderList.push({ type: 'chasing_dog', z: dogZ });
    }

    for (let e of entities) {
        renderList.push({ type: 'entity', z: e.z, obj: e });
    }
    for (let p of particles) {
        renderList.push({ type: 'particle', z: p.z, obj: p });
    }
    for (let ft of floatingTexts) {
        renderList.push({ type: 'text', z: ft.z, obj: ft });
    }

    renderList.sort((a, b) => b.z - a.z);

    for (let item of renderList) {
        let pxWorld = item.obj ? item.obj.x : 0; // default centered for chasing dog
        if (item.type === 'chasing_dog') pxWorld = player.x;

        let pyWorld = item.obj && item.obj.y ? item.obj.y : 0;
        
        const p = project(pxWorld, pyWorld, item.z);
        if (!p) continue;

        if (item.type === 'entity') {
            if (item.obj.type === 'coin') drawCoin(p.screenX, p.screenY, p.scale, time);
            else if (item.obj.type.startsWith('powerup')) drawPowerup(p.screenX, p.screenY, p.scale, time, item.obj.type);
            else if (item.obj.type === 'crate') drawCrate(p.screenX, p.screenY, p.scale);
            else if (item.obj.type === 'trashbin') drawTrashBin(p.screenX, p.screenY, p.scale);
            else if (item.obj.type === 'minaret') drawMinaret(p.screenX, p.screenY, p.scale);
            else if (item.obj.type === 'lanterns') drawLanterns(p.screenX, p.screenY, p.scale);
        } 
        else if (item.type === 'player') {
            drawDrummer(p.screenX, p.screenY, p.scale, time);
        }
        else if (item.type === 'chasing_dog') {
            // Dog is constantly visible chasing the player
            drawDogEntity(p.screenX, p.screenY, p.scale, time);
        }
        else if (item.type === 'particle') {
            ctx.fillStyle = item.obj.color;
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, item.obj.size * p.scale, 0, Math.PI*2);
            ctx.fill();
        }
        else if (item.type === 'text') {
            ctx.fillStyle = item.obj.color;
            ctx.globalAlpha = Math.max(0, item.obj.life);
            ctx.font = `bold ${35 * p.scale}px 'Outfit', sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 5;
            ctx.fillText(item.obj.text, p.screenX, p.screenY);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }

    ctx.restore();
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = timestamp;

    if (gameState === 'PLAYING') {
        update(dt);
    }
    
    draw(dt, timestamp/1000);
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
