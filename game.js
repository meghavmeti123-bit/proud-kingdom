/* ============================================================
   PROUD KINGDOM: Seedling Knight — game.js
   Full platformer game engine with Responsive Touch & Revive System
   ============================================================ */

'use strict';

// ── Canvas & Context ─────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const CANVAS_W = 800;
const CANVAS_H = 480;

canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

// ── Screens & Modals ─────────────────────────────────────────
const titleScreen    = document.getElementById('titleScreen');
const gameScreen     = document.getElementById('gameScreen');
const winScreen      = document.getElementById('winScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const reviveScreen   = document.getElementById('reviveScreen');

// ── HUD Elements ─────────────────────────────────────────────
const seedCountEl    = document.getElementById('seedCount');
const scoreCountEl   = document.getElementById('scoreCount');
const diamondCountEl = document.getElementById('diamondCount');
const hearts         = [
  document.getElementById('h1'),
  document.getElementById('h2'),
  document.getElementById('h3'),
];

// ── Revive Screen Elements ───────────────────────────────────
const reviveCurrentDiamondsEl = document.getElementById('reviveCurrentDiamonds');
const reviveMsgEl             = document.getElementById('reviveMsg');
const reviveContinueBtn       = document.getElementById('reviveContinueBtn');
const reviveGameOverBtn       = document.getElementById('reviveGameOverBtn');

// ── Touch Controls Elements ──────────────────────────────────
const touchLeftBtn  = document.getElementById('touchLeft');
const touchRightBtn = document.getElementById('touchRight');
const touchJumpBtn  = document.getElementById('touchJump');

// ── Checkpoint Flash ─────────────────────────────────────────
let checkpointMsg = document.getElementById('checkpointMsg');
if (!checkpointMsg) {
  checkpointMsg = document.createElement('div');
  checkpointMsg.id = 'checkpointMsg';
  checkpointMsg.textContent = '✦ CHECKPOINT ✦';
  document.body.appendChild(checkpointMsg);
}

// ── Constants ────────────────────────────────────────────────
const GRAVITY       = 0.55;
const JUMP_FORCE    = -13.5;
const MOVE_SPEED    = 3.8;
const MAX_FALL      = 14;
const TILE          = 32;
const REVIVE_COST   = 2; // Exactly 2 diamonds needed to revive

// ── Input State ──────────────────────────────────────────────
const keys = {};
const touchState = {
  left: false,
  right: false,
  jump: false,
};

// Keyboard listener
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD'].includes(e.code)) {
    e.preventDefault();
  }
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// Setup Touch / Pointer Controls
function setupTouchButton(btn, onStart, onEnd) {
  if (!btn) return;

  const handleStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerId !== undefined && btn.setPointerCapture) {
      try { btn.setPointerCapture(e.pointerId); } catch(err) {}
    }
    btn.classList.add('pressed');
    onStart();
  };

  const handleEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerId !== undefined && btn.releasePointerCapture) {
      try { btn.releasePointerCapture(e.pointerId); } catch(err) {}
    }
    btn.classList.remove('pressed');
    onEnd();
  };

  btn.addEventListener('pointerdown', handleStart);
  btn.addEventListener('pointerup', handleEnd);
  btn.addEventListener('pointercancel', handleEnd);

  // Fallback touch events
  btn.addEventListener('touchstart', handleStart, { passive: false });
  btn.addEventListener('touchend', handleEnd, { passive: false });
  btn.addEventListener('touchcancel', handleEnd, { passive: false });
}

setupTouchButton(touchLeftBtn,  () => { touchState.left = true; },  () => { touchState.left = false; });
setupTouchButton(touchRightBtn, () => { touchState.right = true; }, () => { touchState.right = false; });
setupTouchButton(touchJumpBtn,  () => {
  touchState.jump = true;
  // Trigger immediate jump if player is grounded
  if (player && player.onGround && !player.dead && state === 'playing') {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    player.jumping = true;
  }
}, () => {
  touchState.jump = false;
});

// Reset inputs when window blurs or visibility changes
window.addEventListener('blur', () => {
  touchState.left = false;
  touchState.right = false;
  touchState.jump = false;
  if (touchLeftBtn) touchLeftBtn.classList.remove('pressed');
  if (touchRightBtn) touchRightBtn.classList.remove('pressed');
  if (touchJumpBtn) touchJumpBtn.classList.remove('pressed');
});

// Prevent scrolling & pinch-zoom gestures on canvas container
const canvasContainer = document.getElementById('canvasContainer');
if (canvasContainer) {
  canvasContainer.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvasContainer.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
}

// ── Game State ───────────────────────────────────────────────
let state             = 'title';   // 'title' | 'playing' | 'revive' | 'win' | 'gameover'
let score             = 0;
let seedsCollected    = 0;
let diamondsCollected = 0;
let camera            = { x: 0 };
let gameTime          = 0;
let invincibleTimer   = 0;
let checkpointSaved   = false;
let checkpointPos     = { x: 50, y: 364 };

// Track safe positions for smart revival
let lastSafeGroundedPos = { x: 50, y: 364 };
let failPos             = { x: 50, y: 364 };
let safeReviveTarget    = { x: 50, y: 364 };

// ── Parallax Background Layers ────────────────────────────────
const BG_LAYERS = [
  { speed: 0.1 },  // distant mountains
  { speed: 0.25 }, // castle & mid forest
  { speed: 0.45 }, // near trees & bushes
];

// ── Player ───────────────────────────────────────────────────
let player;

function createPlayer(x, y) {
  return {
    x, y,
    w: 28, h: 36,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    health: 3,
    frameTimer: 0,
    walkFrame: 0,
    jumping: false,
    dead: false,
  };
}

// ── Level Data ───────────────────────────────────────────────
let platforms, seeds, diamonds, enemies, spikes, checkpoint, gate, levelWidth;

function buildLevel() {
  levelWidth = 6000;

  // ── Platforms ──────────────────────────────────────────────
  platforms = [
    // Start safe zone
    { x:    0, y: 400, w: 480, h: 80, type: 'ground' },
    // Gap then resuming ground
    { x:  560, y: 400, w: 320, h: 80, type: 'ground' },
    // Another gap
    { x:  960, y: 400, w: 280, h: 80, type: 'ground' },
    // Gap
    { x: 1320, y: 400, w: 200, h: 80, type: 'ground' },
    // Large gap — must use float
    { x: 1600, y: 400, w: 180, h: 80, type: 'ground' },
    { x: 1860, y: 400, w: 150, h: 80, type: 'ground' },
    { x: 2100, y: 400, w: 200, h: 80, type: 'ground' },
    // Section with steps
    { x: 2400, y: 400, w: 500, h: 80, type: 'ground' },
    // Checkpoint area
    { x: 2980, y: 400, w: 600, h: 80, type: 'ground' },
    // Post-checkpoint
    { x: 3660, y: 400, w: 200, h: 80, type: 'ground' },
    { x: 3940, y: 400, w: 160, h: 80, type: 'ground' },
    { x: 4180, y: 400, w: 160, h: 80, type: 'ground' },
    { x: 4420, y: 400, w: 160, h: 80, type: 'ground' },
    { x: 4660, y: 400, w: 200, h: 80, type: 'ground' },
    // Long gap section
    { x: 4940, y: 400, w: 120, h: 80, type: 'ground' },
    { x: 5140, y: 400, w: 120, h: 80, type: 'ground' },
    // Final approach
    { x: 5340, y: 400, w: 660, h: 80, type: 'ground' },

    // ── Floating Platforms ──────────────────────────────────
    // Early section helpers
    { x:  490, y: 320, w: 90,  h: 20, type: 'float' },
    { x:  870, y: 310, w: 90,  h: 20, type: 'float' },
    { x: 1120, y: 300, w: 90,  h: 20, type: 'float' },
    { x: 1240, y: 340, w: 80,  h: 20, type: 'float' },

    // Staircase rise mid
    { x:  700, y: 340, w: 80,  h: 20, type: 'float' },
    { x:  780, y: 290, w: 80,  h: 20, type: 'float' },
    { x:  860, y: 250, w: 80,  h: 20, type: 'float' },

    // Over the gap at 1320-1600
    { x: 1380, y: 330, w: 80,  h: 20, type: 'float' },
    { x: 1470, y: 280, w: 80,  h: 20, type: 'float' },
    { x: 1560, y: 330, w: 80,  h: 20, type: 'float' },

    // Platform chain 1600-2100
    { x: 1740, y: 340, w: 80,  h: 20, type: 'float' },
    { x: 1830, y: 290, w: 80,  h: 20, type: 'float' },
    { x: 1960, y: 340, w: 80,  h: 20, type: 'stone' },
    { x: 2060, y: 300, w: 80,  h: 20, type: 'stone' },

    // High floaters for secret items
    { x:  600, y: 220, w: 70,  h: 20, type: 'float' },
    { x:  920, y: 200, w: 70,  h: 20, type: 'float' },
    { x: 1600, y: 220, w: 70,  h: 20, type: 'float' },

    // Step section 2400-2900
    { x: 2440, y: 360, w: 80,  h: 20, type: 'stone' },
    { x: 2560, y: 310, w: 80,  h: 20, type: 'stone' },
    { x: 2680, y: 260, w: 80,  h: 20, type: 'stone' },
    { x: 2800, y: 310, w: 80,  h: 20, type: 'stone' },
    { x: 2900, y: 360, w: 80,  h: 20, type: 'stone' },

    // Post checkpoint floaters
    { x: 3700, y: 330, w: 70,  h: 20, type: 'float' },
    { x: 3800, y: 280, w: 70,  h: 20, type: 'float' },
    { x: 3890, y: 340, w: 70,  h: 20, type: 'float' },
    { x: 4030, y: 300, w: 70,  h: 20, type: 'float' },
    { x: 4120, y: 250, w: 70,  h: 20, type: 'float' },
    { x: 4320, y: 320, w: 70,  h: 20, type: 'float' },
    { x: 4580, y: 290, w: 70,  h: 20, type: 'float' },
    { x: 4760, y: 330, w: 70,  h: 20, type: 'float' },
    { x: 4860, y: 280, w: 70,  h: 20, type: 'float' },

    // Long gap helpers
    { x: 5060, y: 330, w: 70,  h: 20, type: 'float' },
    { x: 5160, y: 280, w: 70,  h: 20, type: 'float' },
    { x: 5260, y: 340, w: 70,  h: 20, type: 'float' },

    // Final approach elevated
    { x: 5400, y: 320, w: 90,  h: 20, type: 'stone' },
    { x: 5550, y: 270, w: 90,  h: 20, type: 'stone' },
    { x: 5700, y: 220, w: 90,  h: 20, type: 'stone' },
    { x: 5850, y: 270, w: 90,  h: 20, type: 'stone' },
  ];

  // ── Seeds (Normal Collectibles) ───────────────────────────
  seeds = [
    { x:  120, y: 370, collected: false },
    { x:  200, y: 370, collected: false },
    { x:  280, y: 370, collected: false },
    { x:  360, y: 370, collected: false },
    { x:  500, y: 290, collected: false },
    { x:  560, y: 370, collected: false },
    { x:  617, y: 188, collected: false },
    { x:  650, y: 188, collected: false },
    { x:  720, y: 308, collected: false },
    { x:  800, y: 258, collected: false },
    { x:  880, y: 218, collected: false },
    { x:  940, y: 168, collected: false },
    { x:  970, y: 168, collected: false },
    { x: 1000, y: 370, collected: false },
    { x: 1070, y: 370, collected: false },
    { x: 1130, y: 268, collected: false },
    { x: 1260, y: 308, collected: false },
    // Gap crossing 1320-1600
    { x: 1400, y: 298, collected: false },
    { x: 1490, y: 248, collected: false },
    { x: 1580, y: 298, collected: false },
    { x: 1620, y: 188, collected: false },
    // Mid section
    { x: 1650, y: 370, collected: false },
    { x: 1760, y: 308, collected: false },
    { x: 1850, y: 258, collected: false },
    { x: 1980, y: 308, collected: false },
    { x: 2080, y: 268, collected: false },
    { x: 2150, y: 370, collected: false },
    { x: 2220, y: 370, collected: false },
    // Step section
    { x: 2460, y: 328, collected: false },
    { x: 2580, y: 278, collected: false },
    { x: 2700, y: 228, collected: false },
    { x: 2820, y: 278, collected: false },
    { x: 2920, y: 328, collected: false },
    // Checkpoint area
    { x: 3050, y: 370, collected: false },
    { x: 3150, y: 370, collected: false },
    { x: 3250, y: 370, collected: false },
    { x: 3350, y: 370, collected: false },
    { x: 3450, y: 370, collected: false },
    // Post checkpoint
    { x: 3720, y: 298, collected: false },
    { x: 3820, y: 248, collected: false },
    { x: 3910, y: 308, collected: false },
    { x: 4050, y: 268, collected: false },
    { x: 4140, y: 218, collected: false },
    { x: 4340, y: 288, collected: false },
    { x: 4600, y: 258, collected: false },
    { x: 4780, y: 298, collected: false },
    { x: 4880, y: 248, collected: false },
    // Long gap
    { x: 5000, y: 370, collected: false },
    { x: 5080, y: 298, collected: false },
    { x: 5180, y: 248, collected: false },
    { x: 5280, y: 308, collected: false },
    // Final approach
    { x: 5420, y: 288, collected: false },
    { x: 5570, y: 238, collected: false },
    { x: 5720, y: 188, collected: false },
    { x: 5870, y: 238, collected: false },
    { x: 5950, y: 370, collected: false },
    { x: 5990, y: 370, collected: false },
  ];

  // ── Revive Diamonds (Special Rare Collectibles) ───────────
  // Placed at 7 strategic, challenging, and meaningful spots
  diamonds = [
    // 1. High secret floater in early sector (requires skillful jumping)
    { x:  930, y: 140, collected: false },
    // 2. High reward over the long gap floats
    { x: 1600, y: 160, collected: false },
    // 3. Peak of the stone mountain staircase
    { x: 2680, y: 200, collected: false },
    // 4. Secret grove just past the kingdom checkpoint
    { x: 3480, y: 340, collected: false },
    // 5. Perilous floater after post-checkpoint slimes
    { x: 4120, y: 190, collected: false },
    // 6. High risk floater above the spike hazards
    { x: 4860, y: 220, collected: false },
    // 7. High palace approach platform near the kingdom gate
    { x: 5700, y: 150, collected: false },
  ];

  // ── Enemies (Slimes) ──────────────────────────────────────
  enemies = [
    { x:  420, y: 372, w: 28, h: 28, vx: 1.2, minX:  350, maxX:  450, alive: true, type: 'slime' },
    { x:  630, y: 372, w: 28, h: 28, vx: 1.0, minX:  580, maxX:  860, alive: true, type: 'slime' },
    { x: 1000, y: 372, w: 28, h: 28, vx: 1.4, minX:  970, maxX: 1230, alive: true, type: 'slime' },
    { x: 1350, y: 372, w: 28, h: 28, vx: 1.2, minX: 1320, maxX: 1510, alive: true, type: 'slime' },
    { x: 1680, y: 372, w: 28, h: 28, vx: 1.6, minX: 1600, maxX: 1840, alive: true, type: 'slime' },
    { x: 2150, y: 372, w: 28, h: 28, vx: 1.8, minX: 2100, maxX: 2290, alive: true, type: 'slime' },
    { x: 2480, y: 372, w: 28, h: 28, vx: 1.5, minX: 2400, maxX: 2890, alive: true, type: 'slime' },
    { x: 3020, y: 372, w: 28, h: 28, vx: 2.0, minX: 2980, maxX: 3560, alive: true, type: 'slime' },
    { x: 3700, y: 372, w: 28, h: 28, vx: 1.8, minX: 3660, maxX: 3850, alive: true, type: 'slime' },
    { x: 4200, y: 372, w: 28, h: 28, vx: 2.0, minX: 4180, maxX: 4370, alive: true, type: 'slime' },
    { x: 4480, y: 372, w: 28, h: 28, vx: 2.2, minX: 4420, maxX: 4610, alive: true, type: 'slime' },
    { x: 4700, y: 372, w: 28, h: 28, vx: 2.0, minX: 4660, maxX: 4850, alive: true, type: 'slime' },
    { x: 5400, y: 372, w: 28, h: 28, vx: 2.5, minX: 5340, maxX: 5900, alive: true, type: 'slime' },
    { x: 5700, y: 372, w: 28, h: 28, vx: 2.5, minX: 5340, maxX: 5900, alive: true, type: 'slime' },
  ];

  // ── Spikes ────────────────────────────────────────────────
  spikes = [
    { x:  480, y: 390, w: 80, h: 10 },
    { x:  880, y: 390, w: 80, h: 10 },
    { x: 1240, y: 390, w: 80, h: 10 },
    { x: 1550, y: 390, w: 50, h: 10 },
    { x: 2110, y: 390, w: 50, h: 10 },
    { x: 2300, y: 390, w: 100, h: 10 },
    { x: 2560, y: 390, w: 60, h: 10 },
    { x: 3870, y: 390, w: 60, h: 10 },
    { x: 4060, y: 390, w: 80, h: 10 },
    { x: 4250, y: 390, w: 60, h: 10 },
    { x: 4750, y: 390, w: 80, h: 10 },
    { x: 4930, y: 390, w: 80, h: 10 },
    { x: 5130, y: 390, w: 80, h: 10 },
    { x: 5320, y: 390, w: 80, h: 10 },
  ];

  // ── Checkpoint ────────────────────────────────────────────
  checkpoint = { x: 3100, y: 340, w: 30, h: 60, triggered: false };

  // ── Gate (Goal) ────────────────────────────────────────────
  gate = { x: 5920, y: 300, w: 48, h: 100 };
}

// ── Utilities ─────────────────────────────────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function showCheckpointMsg() {
  if (!checkpointMsg) return;
  checkpointMsg.classList.add('show');
  setTimeout(() => checkpointMsg.classList.remove('show'), 2200);
}

// ── Camera ────────────────────────────────────────────────────
function updateCamera() {
  let targetX = player.x - CANVAS_W / 3;
  targetX = Math.max(0, Math.min(targetX, levelWidth - CANVAS_W));
  camera.x += (targetX - camera.x) * 0.08;
}

// ── Drawing Helpers ───────────────────────────────────────────
function drawPixelRect(x, y, w, h, fill, stroke, lineW = 2) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineW;
    ctx.strokeRect(x + lineW/2, y + lineW/2, w - lineW, h - lineW);
  }
}

// ── Background & Parallax ─────────────────────────────────────
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#1a0a4a');
  grad.addColorStop(0.45, '#2a1a7a');
  grad.addColorStop(0.75, '#1a3a5a');
  grad.addColorStop(1, '#0a1a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const cam = camera.x;
  drawMountains(cam * BG_LAYERS[0].speed, 0.55);
  drawCastle(cam * BG_LAYERS[1].speed);
  drawTrees(cam * BG_LAYERS[2].speed);
  drawStars();
}

function drawStars() {
  ctx.fillStyle = 'rgba(255,255,200,0.7)';
  const starData = [
    [50, 30], [130, 15], [210, 50], [300, 20], [380, 40],
    [460, 10], [540, 55], [620, 25], [700, 45], [780, 15],
    [85, 80], [175, 65], [255, 90], [340, 70], [430, 85],
    [510, 60], [600, 75], [670, 90], [750, 60],
  ];
  for (const [sx, sy] of starData) {
    ctx.fillRect(sx, sy, 2, 2);
  }
}

function drawMountains(offset, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const peaks = [
    { x: 80,  y: 220, w: 180 },
    { x: 240, y: 180, w: 220 },
    { x: 420, y: 240, w: 160 },
    { x: 560, y: 200, w: 200 },
    { x: 730, y: 230, w: 160 },
  ];
  const off = offset % CANVAS_W;
  for (let rep = -1; rep <= 1; rep++) {
    for (const p of peaks) {
      ctx.beginPath();
      ctx.moveTo(p.x - p.w/2 - off + rep * CANVAS_W, CANVAS_H * 0.72);
      ctx.lineTo(p.x - off + rep * CANVAS_W, p.y);
      ctx.lineTo(p.x + p.w/2 - off + rep * CANVAS_W, CANVAS_H * 0.72);
      ctx.closePath();
      ctx.fillStyle = '#2a1a4a';
      ctx.fill();

      // Snow cap
      ctx.beginPath();
      ctx.moveTo(p.x - 18 - off + rep * CANVAS_W, p.y + 30);
      ctx.lineTo(p.x - off + rep * CANVAS_W, p.y);
      ctx.lineTo(p.x + 18 - off + rep * CANVAS_W, p.y + 30);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,180,255,0.4)';
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCastle(offset) {
  const cx = 680 - (offset * 0.15) % CANVAS_W;
  const cy = 150;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#3a1a6a';
  ctx.fillRect(cx, cy + 60, 100, 120);
  ctx.fillRect(cx - 20, cy + 20, 40, 160);
  ctx.fillRect(cx - 24, cy + 10, 48, 20);
  ctx.fillRect(cx + 80, cy + 20, 40, 160);
  ctx.fillRect(cx + 76, cy + 10, 48, 20);
  ctx.fillRect(cx + 30, cy, 40, 180);
  ctx.fillRect(cx + 26, cy - 10, 48, 20);

  ctx.fillStyle = '#4a2a7a';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(cx + 30 + i*14, cy - 10, 10, 12);
  }

  ctx.fillStyle = '#ffd700';
  ctx.fillRect(cx + 48, cy - 30, 2, 22);
  ctx.fillRect(cx + 50, cy - 30, 14, 10);
  ctx.restore();
}

function drawTrees(offset) {
  const treePositions = [50, 160, 290, 410, 520, 640, 755];
  const off = offset % CANVAS_W;
  ctx.save();
  ctx.globalAlpha = 0.45;
  for (let rep = -1; rep <= 1; rep++) {
    for (const tx of treePositions) {
      const rx = tx - off + rep * CANVAS_W;
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(rx - 5, CANVAS_H * 0.6, 10, 40);
      ctx.fillStyle = '#1a4a10';
      ctx.fillRect(rx - 22, CANVAS_H * 0.6 - 38, 44, 28);
      ctx.fillStyle = '#2a6a20';
      ctx.fillRect(rx - 17, CANVAS_H * 0.6 - 60, 34, 24);
      ctx.fillStyle = '#38884a';
      ctx.fillRect(rx - 12, CANVAS_H * 0.6 - 78, 24, 20);
    }
  }
  ctx.restore();
}

// ── Draw Platforms ─────────────────────────────────────────────
function drawPlatforms() {
  for (const p of platforms) {
    const sx = p.x - camera.x;
    if (sx + p.w < 0 || sx > CANVAS_W) continue;

    if (p.type === 'ground') {
      drawPixelRect(sx, p.y, p.w, p.h, '#5a3810', '#3a2a08');
      ctx.fillStyle = '#2ecc40';
      ctx.fillRect(sx, p.y, p.w, 10);
      ctx.fillStyle = '#22aa30';
      ctx.fillRect(sx, p.y + 10, p.w, 4);

      ctx.fillStyle = '#7a5020';
      for (let tx = sx + 8; tx < sx + p.w - 8; tx += 20) {
        ctx.fillRect(tx, p.y + 20, 4, 4);
        ctx.fillRect(tx + 10, p.y + 34, 4, 4);
      }
    } else if (p.type === 'float') {
      drawPixelRect(sx, p.y, p.w, p.h, '#8B5A2B', '#5a3810');
      ctx.fillStyle = '#a06030';
      ctx.fillRect(sx + 2, p.y + 2, p.w - 4, 8);
      ctx.fillStyle = '#2ecc40';
      ctx.fillRect(sx, p.y, p.w, 5);
    } else if (p.type === 'stone') {
      drawPixelRect(sx, p.y, p.w, p.h, '#7a7a8a', '#4a4a5a');
      ctx.fillStyle = '#9a9aaa';
      ctx.fillRect(sx + 2, p.y + 2, p.w - 4, 6);

      ctx.strokeStyle = '#5a5a6a';
      ctx.lineWidth = 1;
      for (let bx = sx + 16; bx < sx + p.w; bx += 16) {
        ctx.beginPath(); ctx.moveTo(bx, p.y); ctx.lineTo(bx, p.y + p.h); ctx.stroke();
      }
    }
  }
}

// ── Draw Spikes ────────────────────────────────────────────────
function drawSpikes() {
  for (const s of spikes) {
    const sx = s.x - camera.x;
    if (sx + s.w < 0 || sx > CANVAS_W) continue;
    const tipCount = Math.floor(s.w / 12);
    const tipW = s.w / tipCount;
    ctx.fillStyle = '#cc2222';
    for (let i = 0; i < tipCount; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * tipW, s.y + s.h);
      ctx.lineTo(sx + i * tipW + tipW / 2, s.y);
      ctx.lineTo(sx + i * tipW + tipW, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ff4444';
    for (let i = 0; i < tipCount; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * tipW + tipW/2 - 2, s.y + 6);
      ctx.lineTo(sx + i * tipW + tipW/2, s.y);
      ctx.lineTo(sx + i * tipW + tipW/2 + 2, s.y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ── Draw Seeds ─────────────────────────────────────────────────
function drawSeeds() {
  const bob = Math.sin(gameTime * 0.07) * 3;
  for (const s of seeds) {
    if (s.collected) continue;
    const sx = s.x - camera.x - 8;
    const sy = s.y - 8 + bob;
    if (sx + 20 < 0 || sx > CANVAS_W) continue;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#88ff88';

    ctx.fillStyle = 'rgba(100,255,100,0.25)';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 8, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2ecc40';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 8, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#88ff88';
    ctx.beginPath();
    ctx.arc(sx + 5, sy + 5, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx + 5, sy + 5, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Draw Revive Diamonds (Special Collectible) ─────────────────
function drawDiamonds() {
  const bob = Math.sin(gameTime * 0.08) * 4;
  const pulse = 0.85 + 0.15 * Math.sin(gameTime * 0.12);
  const spinFactor = Math.cos(gameTime * 0.06); // Simulates 3D rotation

  for (const d of diamonds) {
    if (d.collected) continue;
    const sx = d.x - camera.x;
    const sy = d.y + bob;
    if (sx + 30 < 0 || sx > CANVAS_W + 30) continue;

    ctx.save();
    ctx.translate(sx, sy);

    // Glowing aura
    ctx.shadowBlur = 18 * pulse;
    ctx.shadowColor = '#00ffff';

    const dw = 12 * Math.abs(spinFactor) + 3;
    const dh = 16 * pulse;

    // Outer glow halo
    ctx.fillStyle = 'rgba(0, 230, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Diamond polygon top
    ctx.fillStyle = '#80deea';
    ctx.beginPath();
    ctx.moveTo(0, -dh);
    ctx.lineTo(dw, -dh * 0.2);
    ctx.lineTo(0, -dh * 0.05);
    ctx.lineTo(-dw, -dh * 0.2);
    ctx.closePath();
    ctx.fill();

    // Diamond bottom facet
    ctx.fillStyle = '#00acc1';
    ctx.beginPath();
    ctx.moveTo(0, dh);
    ctx.lineTo(dw, -dh * 0.2);
    ctx.lineTo(0, -dh * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#26c6da';
    ctx.beginPath();
    ctx.moveTo(0, dh);
    ctx.lineTo(-dw, -dh * 0.2);
    ctx.lineTo(0, -dh * 0.05);
    ctx.closePath();
    ctx.fill();

    // Center bright highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -dh * 0.25, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Small sparkle stars around diamond
    const spX = Math.cos(gameTime * 0.1 + d.x) * 16;
    const spY = Math.sin(gameTime * 0.1 + d.x) * 16;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(spX - 1, spY - 1, 2, 2);

    ctx.restore();
  }
}

// ── Draw Enemies ───────────────────────────────────────────────
function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = e.x - camera.x;
    if (sx + e.w < 0 || sx > CANVAS_W) continue;
    const bounce = Math.abs(Math.sin(gameTime * 0.15)) * 3;

    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#aa00aa';

    ctx.fillStyle = '#8822cc';
    ctx.beginPath();
    ctx.ellipse(sx + e.w/2, e.y + e.h/2 + bounce, e.w/2, e.h/2 - bounce/2, 0, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#aa55ee';
    ctx.beginPath();
    ctx.ellipse(sx + e.w/2 - 4, e.y + e.h/2 - 4 + bounce, 5, 4, -0.3, 0, Math.PI*2);
    ctx.fill();

    const eyeDir = e.vx > 0 ? 1 : -1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + e.w/2 + eyeDir*3 - 4, e.y + e.h/3 + bounce - 2, 5, 5);
    ctx.fillRect(sx + e.w/2 + eyeDir*3 + 3, e.y + e.h/3 + bounce - 2, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + e.w/2 + eyeDir*3 - 3, e.y + e.h/3 + bounce - 1, 3, 3);
    ctx.fillRect(sx + e.w/2 + eyeDir*3 + 4, e.y + e.h/3 + bounce - 1, 3, 3);
    ctx.restore();
  }
}

// ── Draw Checkpoint ─────────────────────────────────────────────
function drawCheckpoint() {
  const sx = checkpoint.x - camera.x;
  if (sx + checkpoint.w < 0 || sx > CANVAS_W) return;

  const flagWave = Math.sin(gameTime * 0.1) * 4;
  const active = checkpoint.triggered;

  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(sx + 12, checkpoint.y, 4, checkpoint.h);

  ctx.fillStyle = active ? '#ffd700' : '#dddddd';
  ctx.beginPath();
  ctx.moveTo(sx + 16, checkpoint.y + 2);
  ctx.lineTo(sx + 16, checkpoint.y + 22);
  ctx.lineTo(sx + 38 + flagWave, checkpoint.y + 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = active ? '#7a3700' : '#555';
  ctx.font = 'bold 8px Courier New';
  ctx.fillText('CP', sx + 18, checkpoint.y + 15);

  if (active) {
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(gameTime * 0.1);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx + 14, checkpoint.y + 30, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Draw Gate (Goal) ────────────────────────────────────────────
function drawGate() {
  const sx = gate.x - camera.x;
  if (sx + gate.w + 40 < 0 || sx > CANVAS_W) return;

  const glow = 0.5 + 0.5 * Math.sin(gameTime * 0.08);

  ctx.fillStyle = '#8B6914';
  ctx.fillRect(sx, gate.y, 14, gate.h);
  ctx.fillRect(sx + gate.w - 14, gate.y, 14, gate.h);

  ctx.strokeStyle = '#5a4408';
  ctx.lineWidth = 1;
  for (let gy = gate.y + 8; gy < gate.y + gate.h; gy += 14) {
    ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx + 14, gy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + gate.w - 14, gy); ctx.lineTo(sx + gate.w, gy); ctx.stroke();
  }

  ctx.fillStyle = `rgba(255,215,0,${0.15 + 0.1 * glow})`;
  ctx.beginPath();
  ctx.arc(sx + gate.w/2, gate.y + 10, gate.w/2 - 14, Math.PI, 0);
  ctx.rect(sx + 14, gate.y + 10, gate.w - 28, gate.h - 10);
  ctx.fill();

  ctx.save();
  ctx.shadowBlur = 30 * glow;
  ctx.shadowColor = '#ffd700';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(sx + gate.w/2, gate.y + 10, gate.w/2 - 14, Math.PI, 0);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px serif';
  ctx.fillText('♛', sx + gate.w/2 - 11, gate.y - 4);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px Courier New';
  ctx.fillText('KINGDOM', sx + gate.w/2 - 21, gate.y + gate.h + 12);
}

// ── Draw Player ─────────────────────────────────────────────────
function drawPlayer() {
  if (player.dead) return;

  const sx = Math.round(player.x - camera.x);
  const sy = Math.round(player.y);

  // Flicker when invincible
  if (invincibleTimer > 0 && Math.floor(invincibleTimer / 4) % 2 === 0) return;

  ctx.save();
  ctx.translate(sx + player.w / 2, sy);

  if (!player.facingRight) ctx.scale(-1, 1);

  const w = player.w;
  const h = player.h;

  // Body (green tunic)
  ctx.fillStyle = '#2ecc40';
  ctx.fillRect(-w/2 + 2, h * 0.38, w - 4, h * 0.44);

  ctx.strokeStyle = '#1a7a20';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w/2 + 2, h * 0.38, w - 4, h * 0.44);

  // Legs
  const legOffset = player.onGround && !player.jumping
    ? Math.sin(gameTime * 0.22) * 4
    : 0;
  ctx.fillStyle = '#1a5a20';
  ctx.fillRect(-w/2 + 4, h * 0.82, 8, h * 0.18 + Math.abs(legOffset));
  ctx.fillRect(w/2 - 12, h * 0.82, 8, h * 0.18 - Math.abs(legOffset));

  // Arm & Sword
  ctx.fillStyle = '#2ecc40';
  if (player.onGround) {
    const armSwing = Math.sin(gameTime * 0.22) * 6;
    ctx.fillRect(w/2 - 4, h * 0.40 + armSwing, 6, 12);
    ctx.fillStyle = '#ccccdd';
    ctx.fillRect(w/2 + 2, h * 0.38 + armSwing, 3, 16);
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(w/2, h * 0.44 + armSwing, 7, 4);
  } else {
    ctx.fillRect(w/2 - 2, h * 0.38, 8, 10);
    ctx.fillStyle = '#ccccdd';
    ctx.fillRect(w/2 + 6, h * 0.34, 3, 14);
  }

  // Helmet
  ctx.fillStyle = '#888888';
  ctx.fillRect(-w/2 + 1, 0, w - 2, h * 0.36);
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(-w/2 + 3, 2, w - 10, h * 0.16);
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 2;
  ctx.strokeRect(-w/2 + 1, 0, w - 2, h * 0.36);

  ctx.fillStyle = '#333344';
  ctx.fillRect(-w/2 + 4, h * 0.22, w - 8, 4);
  ctx.fillStyle = '#88ff88';
  ctx.fillRect(-w/2 + 6, h * 0.22 + 1, 4, 2);

  // Sprout leaf
  ctx.fillStyle = '#22cc40';
  ctx.beginPath();
  ctx.ellipse(2, -2, 7, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#44ee60';
  ctx.beginPath();
  ctx.ellipse(2, -2, 4, 2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a7a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(4, -10, 6, -14);
  ctx.stroke();

  ctx.restore();
}

// ── Physics & Collisions ───────────────────────────────────────
function updatePlayer() {
  if (player.dead) return;

  // Combine keyboard and touch input
  const movingLeft  = keys['ArrowLeft']  || keys['KeyA'] || touchState.left;
  const movingRight = keys['ArrowRight'] || keys['KeyD'] || touchState.right;
  const wantJump    = keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touchState.jump;

  if (movingLeft) {
    player.vx = -MOVE_SPEED;
    player.facingRight = false;
  } else if (movingRight) {
    player.vx = MOVE_SPEED;
    player.facingRight = true;
  } else {
    player.vx *= 0.75;
  }

  // Jump
  if (wantJump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    player.jumping = true;
  }

  // Gravity
  player.vy += GRAVITY;
  if (player.vy > MAX_FALL) player.vy = MAX_FALL;

  // Horizontal Movement
  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > levelWidth) player.x = levelWidth - player.w;

  // Vertical Movement & Platform Collision
  player.y += player.vy;
  player.onGround = false;

  for (const p of platforms) {
    const px = { x: player.x, y: player.y, w: player.w, h: player.h };
    const pp = { x: p.x, y: p.y, w: p.w, h: p.h };

    if (!rectOverlap(px, pp)) continue;

    // Landing on top
    if (player.vy >= 0 && player.y + player.h - player.vy <= p.y + 4) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumping = false;

      // Update safe grounded position if not near hazards
      if (!isHazardAt(player.x, player.y)) {
        lastSafeGroundedPos = { x: player.x, y: player.y };
      }
    }
    // Hitting ceiling
    else if (player.vy < 0 && player.y - player.vy >= p.y + p.h - 4) {
      player.y = p.y + p.h;
      player.vy = 0;
    }
    // Side collisions
    else {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  // Fall into void (bottom of screen)
  if (player.y > CANVAS_H + 80) {
    handleFailure(true);
  }

  // Walk animation
  if (player.onGround && Math.abs(player.vx) > 0.5) {
    player.frameTimer++;
    if (player.frameTimer > 8) {
      player.walkFrame = 1 - player.walkFrame;
      player.frameTimer = 0;
    }
  }

  // Invincibility cooldown
  if (invincibleTimer > 0) invincibleTimer--;
}

// Check if position is directly on spikes or inside an enemy
function isHazardAt(x, y) {
  const pBox = { x: x + 4, y: y + 4, w: player.w - 8, h: player.h - 4 };
  for (const s of spikes) {
    if (rectOverlap(pBox, s)) return true;
  }
  for (const e of enemies) {
    if (e.alive && rectOverlap(pBox, e)) return true;
  }
  return false;
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx;
    if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
    if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); }
  }
}

function checkCollisions() {
  if (player.dead || state !== 'playing') return;

  const px = { x: player.x + 4, y: player.y + 4, w: player.w - 8, h: player.h - 4 };

  // 1. Seeds Collection
  for (const s of seeds) {
    if (s.collected) continue;
    const sb = { x: s.x - 8, y: s.y - 8, w: 16, h: 16 };
    if (rectOverlap(px, sb)) {
      s.collected = true;
      seedsCollected++;
      score += 100;
      updateHUD();
      spawnCollectEffect(s.x, s.y, '#2ecc40');
    }
  }

  // 2. Revive Diamonds Collection
  for (const d of diamonds) {
    if (d.collected) continue;
    const db = { x: d.x - 12, y: d.y - 12, w: 24, h: 24 };
    if (rectOverlap(px, db)) {
      d.collected = true;
      diamondsCollected++;
      score += 250;
      updateHUD();
      spawnCollectEffect(d.x, d.y, '#00ffff');
    }
  }

  // Check damage & hazard collisions if not invincible
  if (invincibleTimer <= 0) {
    // 3. Enemies Collision
    for (const e of enemies) {
      if (!e.alive) continue;
      const eb = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (!rectOverlap(px, eb)) continue;

      // Stomp enemy
      if (player.vy > 1 && player.y + player.h < e.y + e.h * 0.6) {
        e.alive = false;
        player.vy = -8; // bounce
        score += 200;
        updateHUD();
        spawnCollectEffect(e.x + e.w/2, e.y + e.h/2, '#aa55ee');
      } else {
        takeDamage(1);
      }
    }

    // 4. Spikes Collision
    for (const s of spikes) {
      const sb = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (rectOverlap({ x: player.x + 4, y: player.y + 10, w: player.w - 8, h: player.h - 10 }, sb)) {
        takeDamage(1);
      }
    }
  }

  // 5. Checkpoint Activation
  if (!checkpoint.triggered) {
    const cb = { x: checkpoint.x, y: checkpoint.y, w: checkpoint.w, h: checkpoint.h };
    if (rectOverlap(px, cb)) {
      checkpoint.triggered = true;
      checkpointSaved = true;
      checkpointPos = { x: checkpoint.x - 50, y: 364 };
      showCheckpointMsg();
      score += 500;
      updateHUD();
    }
  }

  // 6. Gate (Win condition)
  const gb = { x: gate.x, y: gate.y, w: gate.w, h: gate.h };
  if (rectOverlap(px, gb)) {
    winGame();
  }
}

// ── Particle Effects ───────────────────────────────────────────
let particles = [];

function spawnCollectEffect(x, y, primaryColor = '#2ecc40') {
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 / 10) * i;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (2.5 + Math.random() * 2),
      vy: Math.sin(angle) * (2.5 + Math.random() * 2),
      life: 35,
      color: i % 2 === 0 ? primaryColor : '#ffffff',
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    return p.life > 0;
  });
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x - camera.x;
    ctx.globalAlpha = p.life / 35;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

// ── Damage & Health ────────────────────────────────────────────
function takeDamage(amount) {
  if (invincibleTimer > 0 || player.dead || state !== 'playing') return;

  player.health -= amount;
  updateHUD();

  if (player.health <= 0) {
    handleFailure(false);
  } else {
    invincibleTimer = 80;
    // Knockback
    player.vy = -7;
    player.vx = player.facingRight ? -5 : 5;
  }
}

// ── Smart Safe Revive Calculation ──────────────────────────────
function calculateSafeRevivePosition(failX, failY) {
  // 1. Search for the nearest safe platform near failX (search up to 450px left/right)
  let bestCandidate = null;
  let minDistance = Infinity;

  for (const p of platforms) {
    // Check points along this platform with step of 25px
    for (let checkX = p.x + 10; checkX <= p.x + p.w - player.w - 10; checkX += 25) {
      const checkY = p.y - player.h;
      const testBox = { x: checkX, y: checkY, w: player.w, h: player.h };

      // Ensure not overlapping spikes
      const onSpike = spikes.some(s => rectOverlap(testBox, s));
      if (onSpike) continue;

      // Ensure not too close to active enemies
      const nearEnemy = enemies.some(e => e.alive && Math.hypot((e.x + e.w/2) - (checkX + player.w/2), (e.y + e.h/2) - (checkY + player.h/2)) < 60);
      if (nearEnemy) continue;

      const dist = Math.abs(checkX - failX);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = { x: checkX, y: checkY };
      }
    }
  }

  if (bestCandidate && minDistance < 450) {
    return bestCandidate;
  }

  // 2. Fall back to lastSafeGroundedPos
  if (lastSafeGroundedPos && !isHazardAt(lastSafeGroundedPos.x, lastSafeGroundedPos.y)) {
    return { x: lastSafeGroundedPos.x, y: lastSafeGroundedPos.y };
  }

  // 3. Fall back to checkpoint or start
  if (checkpointSaved) {
    return { x: checkpointPos.x, y: checkpointPos.y };
  }

  return { x: 50, y: 364 };
}

// ── Failure Handling & Revive Prompt ───────────────────────────
function handleFailure(isFall) {
  if (player.dead) return;
  player.dead = true;

  // Record failure location
  failPos = { x: player.x, y: player.y };
  safeReviveTarget = calculateSafeRevivePosition(player.x, player.y);

  setTimeout(() => {
    // If player has 2 or more diamonds, prompt revive overlay
    showReviveScreen();
  }, 400);
}

function showReviveScreen() {
  state = 'revive';
  loopRunning = false;

  reviveCurrentDiamondsEl.textContent = `${diamondsCollected} 💎`;

  if (diamondsCollected >= REVIVE_COST) {
    reviveContinueBtn.disabled = false;
    reviveContinueBtn.textContent = `✦ CONTINUE (${REVIVE_COST} 💎)`;
    reviveMsgEl.textContent = `You have enough diamonds! Revive near where you fell?`;
    reviveMsgEl.style.color = '#80deea';
  } else {
    reviveContinueBtn.disabled = true;
    reviveContinueBtn.textContent = `✦ NOT ENOUGH (Need ${REVIVE_COST} 💎)`;
    reviveMsgEl.textContent = `Need ${REVIVE_COST} Revive Diamonds to continue (${diamondsCollected}/${REVIVE_COST}).`;
    reviveMsgEl.style.color = '#ff80ab';
  }

  gameScreen.classList.remove('active');
  reviveScreen.classList.add('active');
}

// Apply Revive
function applyRevive() {
  if (diamondsCollected < REVIVE_COST) return;

  // Deduct diamonds
  diamondsCollected -= REVIVE_COST;
  player.health = 3;
  player.dead = false;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.jumping = false;

  // Place player at calculated safe revive spot
  player.x = safeReviveTarget.x;
  player.y = safeReviveTarget.y;

  // 2 seconds invulnerability
  invincibleTimer = 120;

  // Re-center camera immediately
  let targetCamX = player.x - CANVAS_W / 3;
  camera.x = Math.max(0, Math.min(targetCamX, levelWidth - CANVAS_W));

  updateHUD();

  // Hide Revive screen and return to game
  reviveScreen.classList.remove('active');
  gameScreen.classList.add('active');
  state = 'playing';

  if (!loopRunning) {
    loopRunning = true;
    requestAnimationFrame(gameLoop);
  }
}

// ── HUD Update ─────────────────────────────────────────────────
function updateHUD() {
  seedCountEl.textContent    = seedsCollected;
  scoreCountEl.textContent   = score;
  diamondCountEl.textContent = diamondsCollected;
  hearts.forEach((h, i) => {
    h.classList.toggle('empty', i >= (player ? player.health : 3));
  });
}

// ── Game Flow (Start / Win / Game Over) ─────────────────────────
function startGame() {
  score             = 0;
  seedsCollected    = 0;
  diamondsCollected = 0;
  invincibleTimer   = 0;
  checkpointSaved   = false;
  gameTime          = 0;
  particles         = [];
  camera            = { x: 0 };
  lastSafeGroundedPos = { x: 50, y: 364 };

  buildLevel();
  player = createPlayer(50, 364);

  updateHUD();

  titleScreen.classList.remove('active');
  winScreen.classList.remove('active');
  gameOverScreen.classList.remove('active');
  reviveScreen.classList.remove('active');
  gameScreen.classList.add('active');

  state = 'playing';
  if (!loopRunning) {
    loopRunning = true;
    requestAnimationFrame(gameLoop);
  }
}

function winGame() {
  state = 'win';
  loopRunning = false;
  score += 1000; // Finish bonus

  document.getElementById('winDiamonds').textContent = diamondsCollected;
  document.getElementById('winSeeds').textContent    = seedsCollected;
  document.getElementById('winScore').textContent    = score;

  gameScreen.classList.remove('active');
  winScreen.classList.add('active');
}

function gameOver() {
  state = 'gameover';
  loopRunning = false;

  document.getElementById('goDiamonds').textContent = diamondsCollected;
  document.getElementById('goSeeds').textContent    = seedsCollected;
  document.getElementById('goScore').textContent    = score;

  reviveScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  gameOverScreen.classList.add('active');
}

// ── Draw Bottom Void Gradient ──────────────────────────────────
function drawVoid() {
  const voidGrad = ctx.createLinearGradient(0, CANVAS_H - 40, 0, CANVAS_H);
  voidGrad.addColorStop(0, 'rgba(0,0,0,0)');
  voidGrad.addColorStop(1, 'rgba(0,0,30,0.9)');
  ctx.fillStyle = voidGrad;
  ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 40);
}

// ── Main Game Loop ─────────────────────────────────────────────
let loopRunning = false;

function gameLoop() {
  if (state !== 'playing') {
    loopRunning = false;
    return;
  }

  requestAnimationFrame(gameLoop);

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  gameTime++;

  // 1. Update
  updatePlayer();
  updateEnemies();
  updateParticles();
  checkCollisions();
  updateCamera();

  // 2. Render
  drawBackground();
  drawPlatforms();
  drawSpikes();
  drawCheckpoint();
  drawGate();
  drawSeeds();
  drawDiamonds();
  drawEnemies();
  drawParticles();
  drawPlayer();
  drawVoid();
}

// ── Button Bindings ────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('winRestartBtn').addEventListener('click', startGame);
document.getElementById('goRestartBtn').addEventListener('click', startGame);

reviveContinueBtn.addEventListener('click', applyRevive);
reviveGameOverBtn.addEventListener('click', gameOver);
