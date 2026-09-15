/* ============================================================
   HIGHWAY RUSH: DRIVE TO THE FINISH  (3D Edition)
   Real 3D WebGL/Three.js car driving game.
   Reuses the original game logic (audio, garage, coins, missions,
   screens, input) while replacing all 2D Canvas rendering with a
   Three.js scene: 3D road, 3D cars, traffic, environment, lighting,
   follow camera, steering tilt and an endless scrolling highway.
   ============================================================ */

'use strict';

// ── Audio Engine (Web Audio API Synthesizer - Zero External Files) ──
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineEnabled = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Audio not supported:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  playClick() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playCoin() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now);
    osc1.frequency.setValueAtTime(1318.51, now + 0.08);
    osc2.frequency.setValueAtTime(1975.53, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  playCrash() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(100, now + 0.35);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.4);
  }

  playBrake() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.linearRampToValueAtTime(500, now + 0.15);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playWin() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  playGameOver() {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const notes = [440, 370, 311, 261];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.15;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  startEngine() {
    if (!this.engineEnabled || !this.ctx) return;
    if (this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) {}
  }

  updateEnginePitch(speedRatio) {
    if (!this.engineOsc || !this.ctx || !this.engineEnabled) return;
    const targetFreq = 50 + speedRatio * 160;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
  }
}

const audio = new SoundFX();

// ── Cars Catalog (Original Fictional Designs & Brands) ──
const CAR_DATABASE = [
  {
    id: 'city_fox', name: 'CITY FOX', brand: 'Apex Motors', price: 0,
    topSpeed: 150, handling: 85, braking: 85, acceleration: 75,
    length: 3.2, width: 1.7,
    roofColor: '#1a1a24', bodyStyle: 'hatchback',
    desc: 'Agile and compact city runner. Perfect for threading through busy traffic.'
  },
  {
    id: 'thunder_gt', name: 'THUNDER GT', brand: 'Vortex Racing', price: 600,
    topSpeed: 180, handling: 78, braking: 80, acceleration: 88,
    length: 3.6, width: 1.8,
    roofColor: '#151520', bodyStyle: 'muscle',
    desc: 'Pure raw American power with a roar that clears the fast lane.'
  },
  {
    id: 'phantom_r', name: 'PHANTOM R', brand: 'Hyperion Dynamics', price: 1500,
    topSpeed: 210, handling: 92, braking: 90, acceleration: 94,
    length: 3.8, width: 1.8,
    roofColor: '#10141f', bodyStyle: 'supercar',
    desc: 'Aerodynamic carbon fiber hypercar engineered for extreme highway speeds.'
  },
  {
    id: 'cyber_pulsar', name: 'CYBER PULSAR', brand: 'Nova CyberCraft', price: 3500,
    topSpeed: 245, handling: 96, braking: 95, acceleration: 98,
    length: 3.9, width: 1.85,
    roofColor: '#0a0d18', bodyStyle: 'futuristic',
    desc: 'Futuristic electric hyper-speeder with active aero wings and neon accents.'
  },
  {
    id: 'titan_spec', name: 'TITAN SPEC-9', brand: 'Phantom Tech', price: 7000,
    topSpeed: 280, handling: 100, braking: 98, acceleration: 100,
    length: 4.0, width: 1.9,
    roofColor: '#090a12', bodyStyle: 'prototype',
    desc: 'Unmatched racing prototype built to dominate endless highway distances.'
  }
];

// ── Game Storage Manager (localStorage) ──
const STORAGE_KEY = 'highway_rush_save_v1';

class StorageManager {
  static load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) { console.warn('Storage read failed:', e); }
    return {
      coins: 200, ownedCars: ['city_fox'], selectedCar: 'city_fox',
      selectedColor: '#ff3344', bestDistance: 0, bestScore: 0,
      soundEnabled: true, engineEnabled: true, controlSize: 'normal'
    };
  }
  static save(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
}

let userSave = StorageManager.load();

// ── UI Screen Elements ──
const screens = {
  mainMenu: document.getElementById('mainMenuScreen'),
  raceSetup: document.getElementById('raceSetupScreen'),
  garage: document.getElementById('garageScreen'),
  howTo: document.getElementById('howToScreen'),
  settings: document.getElementById('settingsScreen'),
  game: document.getElementById('gameScreen'),
  win: document.getElementById('winScreen'),
  gameOver: document.getElementById('gameOverScreen')
};

const pauseModal = document.getElementById('pauseModal');
const gameCanvas = document.getElementById('gameCanvas');

// HUD Elements
const hudDistance = document.getElementById('hudDistance');
const distFill = document.getElementById('distFill');
const hudTime = document.getElementById('hudTime');
const hudSpeed = document.getElementById('hudSpeed');
const hudCoins = document.getElementById('hudCoins');
const heartEls = [
  document.getElementById('heart1'),
  document.getElementById('heart2'),
  document.getElementById('heart3')
];
const damageFlashOverlay = document.getElementById('damageFlashOverlay');
const gameBanner = document.getElementById('gameBanner');

// ── Three.js World Constants ──
const ROAD_WIDTH = 16;            // world units (X)
const LANES = 4;
const LANE_W = ROAD_WIDTH / LANES; // 4 units per lane
const ROAD_HALF = ROAD_WIDTH / 2;  // 8
const PLAYER_Z = 0;                // player stays near origin along Z
const SPAWN_Z = -170;              // where traffic/coins spawn ahead (-Z = forward)
const BEHIND_Z = 24;               // objects behind camera get recycled
const WORLD_SPAN = 210;            // scenery recycle range
const MAX_LATERAL = ROAD_HALF - 0.6; // max player |WorldX|
const CURB_X = ROAD_HALF + 0.25;
const DASH_SPACING = 12;
const DASH_COUNT = 26;
const DASH_SPAN = DASH_SPACING * DASH_COUNT;

function laneCenterX(i) {
  return -ROAD_HALF + LANE_W * i + LANE_W / 2; // -6, -2, 2, 6
}

// ── Three.js Game Scene (initialised lazily) ──
let scene, camera, renderer, clock;
let sunLight, ambientLight;
let groundPlane, roadMesh;
let playerCarGroup = null, playerWheels = [];
let playerCar; // current config
let dashMeshes = [];    // {x, mesh}
let modulesLights = []; // curb/other recycled
let worldDelta = 0;     // how much the world moved this frame (+ = player moves forward)
let trafficMeshes = [];

const skyTop = new THREE.Color('#2b6fff');
const skyHorizon = new THREE.Color('#9fd8ff');
const envFog = new THREE.Color('#b7dcff');

// ── Shared low-poly geometries / materials cache ──
const GEO = {};
function geo(key, factory) {
  if (!GEO[key]) GEO[key] = factory();
  return GEO[key];
}
function mat(color, opts) {
  return new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(color) }, opts || {}));
}

// ── Build a low-poly car (faces -Z = forward) ──
function buildCarMesh(config, color, opts) {
  const group = new THREE.Group();
  const w = config.width, l = config.length;
  const bodyH = 0.55;
  const bodyY = 0.42;

  const bodyMat = mat(color, {});
  const darkMat = mat('#15171f', {});
  const glassMat = mat('#1c2838', {});

  // Main body
  const body = new THREE.Mesh(
    geo('carBody', () => new THREE.BoxGeometry(w, bodyH, l)),
    bodyMat
  );
  body.position.y = bodyY;
  group.add(body);

  // Cabin / roof
  const cabL = Math.max(1.3, l * 0.55);
  const cabW = w * 0.72;
  const cabH = 0.42;
  const cab = new THREE.Mesh(
    geo('carCab', () => new THREE.BoxGeometry(cabW, cabH, cabL)),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(config.roofColor || '#15171f') })
  );
  cab.position.set(0, bodyY + bodyH / 2 + cabH / 2, l * 0.06);
  group.add(cab);

  // Windshield + rear window (slightly tinted, front faces -Z)
  const windshield = new THREE.Mesh(
    geo('windshield', () => new THREE.BoxGeometry(cabW * 0.9, cabH * 0.9, 0.06)),
    glassMat
  );
  windshield.position.set(0, bodyY + bodyH / 2 + cabH * 0.45, -l * 0.16);
  group.add(windshield);
  const rearGlass = new THREE.Mesh(
    geo('rearGlass', () => new THREE.BoxGeometry(cabW * 0.9, cabH * 0.9, 0.06)),
    glassMat
  );
  rearGlass.position.set(0, bodyY + bodyH / 2 + cabH * 0.45, l * 0.28);
  group.add(rearGlass);

  // Headlights (front = -Z)
  const hlGeo = geo('headlight', () => new THREE.BoxGeometry(0.18, 0.12, 0.05));
  const hlMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#fff7e0'), emissive: new THREE.Color('#d8f0ff') });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(w * 0.3 * s, bodyY + 0.1, -l / 2 - 0.02);
    group.add(hl);
  }

  // Taillights (rear = +Z), stored for brake light glow
  const tailGeo = geo('taillight', () => new THREE.BoxGeometry(0.26, 0.12, 0.04));
  const tailMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#ff2244'), emissive: new THREE.Color('#990011') });
  for (const s of [-1, 1]) {
    const tl = new THREE.Mesh(tailGeo, tailMat);
    tl.position.set(w * 0.3 * s, bodyY + 0.12, l / 2 + 0.02);
    group.add(tl);
  }

  // Wheels (rolling cylinders, axis along X)
  const wheelGeo = geo('wheel', () => new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10));
  const tireMat = mat('#14161c', {});
  const hubMat = mat('#8b93a3', {});
  const wheelOffsets = [
    [-w * 0.42, -l * 0.30],
    [ w * 0.42, -l * 0.30],
    [-w * 0.42,  l * 0.30],
    [ w * 0.42,  l * 0.30]
  ];
  const wheels = wheelOffsets.map(([wx, wz]) => {
    const spinGroup = new THREE.Group();
    spinGroup.position.set(wx, 0.36, wz);
    const rim = new THREE.Mesh(wheelGeo, tireMat);
    rim.rotation.z = Math.PI / 2;
    spinGroup.add(rim);
    const hub = new THREE.Mesh(
      geo('hubcap', () => new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8)),
      hubMat
    );
    hub.rotation.z = Math.PI / 2;
    spinGroup.add(hub);
    group.add(spinGroup);
    return spinGroup; // store for rolling rotation about X
  });

  // Spoiler for fast body styles
  if (opts.spoiler !== false && ['supercar', 'futuristic', 'prototype', 'muscle'].includes(config.bodyStyle)) {
    const wing = new THREE.Mesh(
      geo('spoiler', () => new THREE.BoxGeometry(w * 0.86, 0.08, 0.5)),
      darkMat
    );
    wing.position.set(0, bodyY + bodyH + 0.28, -l * 0.12);
    group.add(wing);
    const stalk1 = new THREE.Mesh(geo('spoilerStalk', () => new THREE.BoxGeometry(0.1, 0.28, 0.1)), darkMat);
    stalk1.position.set(-w * 0.3, bodyY + bodyH / 2 + 0.14, -l * 0.12);
    group.add(stalk1);
    const stalk2 = stalk1.clone();
    stalk2.position.x = w * 0.3;
    group.add(stalk2);
  }

  // Neon underglow for high-end cars
  if (opts.glow && config.price >= 3500) {
    const glow = new THREE.Mesh(
      geo('underglow', () => new THREE.BoxGeometry(w * 0.7, 0.05, l * 0.8)),
      new THREE.MeshLambertMaterial({ color: new THREE.Color('#00e5ff'), emissive: new THREE.Color('#0088bb') })
    );
    glow.position.y = 0.06;
    group.add(glow);
  }

  group.userData.wheels = wheels;
  group.userData.tailMat = tailMat;
  return group;
}

// ── Build flat-shaded scenery meshes ──
function buildTree(size) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    geo('trunk', () => new THREE.CylinderGeometry(0.22, 0.3, 1.4, 7)),
    mat('#5a3a24', {})
  );
  trunk.position.y = 0.7;
  g.add(trunk);
  const leafMat = mat(Math.random() < 0.5 ? '#2f7a3c' : '#3f9148', {});
  const leaf1 = new THREE.Mesh(geo('leaf1', () => new THREE.ConeGeometry(size * 0.55, size * 1.2, 7)), leafMat);
  leaf1.position.y = 1.8;
  g.add(leaf1);
  const leaf2 = new THREE.Mesh(geo('leaf2', () => new THREE.ConeGeometry(size * 0.4, size * 0.9, 7)), leafMat);
  leaf2.position.y = 2.5;
  g.add(leaf2);
  return g;
}

function buildLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    geo('lampPole', () => new THREE.CylinderGeometry(0.09, 0.09, 5.2, 6)),
    mat('#5a6472', {})
  );
  pole.position.y = 2.6;
  g.add(pole);
  const bulb = new THREE.Mesh(
    geo('lampBulb', () => new THREE.SphereGeometry(0.35, 8, 6)),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#bcdcff'), emissive: new THREE.Color('#8fc8ff') })
  );
  bulb.position.y = 5.4;
  g.add(bulb);
  return g;
}

function buildSign(x) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    geo('signPost', () => new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6)),
    mat('#6a7280', {})
  );
  post.position.y = 1.3;
  g.add(post);
  const board = new THREE.Mesh(
    geo('signBoard', () => new THREE.BoxGeometry(1.6, 0.9, 0.12)),
    mat('#125a9e', {})
  );
  board.position.set(0, 2.6, 0);
  g.add(board);
  const strip1 = new THREE.Mesh(geo('signStrip', () => new THREE.BoxGeometry(1.6, 0.2, 0.13)), mat('#ffffff', {}));
  strip1.position.set(0, 3.0, 0);
  g.add(strip1);
  return g;
}

function buildBuilding(height) {
  const g = new THREE.Group();
  const w = 4 + Math.random() * 3;
  const d = 4 + Math.random() * 3;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, height, d),
    mat('#5b6a85', {})
  );
  body.position.y = height / 2;
  g.add(body);
  // Windows (simple emissive strips)
  const winMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffd980'), emissive: new THREE.Color('#997022') });
  const win = new THREE.Mesh(geo('window', () => new THREE.BoxGeometry(w * 0.8, height * 0.7, 0.06)), winMat);
  win.position.set(0, height / 2, d / 2 + 0.03);
  g.add(win);
  return g;
}

function buildRock(size) {
  return new THREE.Mesh(
    geo('rock', () => new THREE.DodecahedronGeometry(size, 0)),
    mat('#6b7280', {})
  );
}

function buildCoinMesh() {
  const g = new THREE.Group();
  const coin = new THREE.Mesh(
    geo('coin', () => new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10)),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffd200'), emissive: new THREE.Color('#9a7a00') })
  );
  coin.rotation.x = Math.PI / 2; // face up rotation spinning about Y handled in group
  g.add(coin);
  return g;
}

function buildFinishLine() {
  const tiles = new THREE.Group();
  const s = 0.8;
  const cols = Math.ceil(ROAD_WIDTH / s);
  let idx = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(s - 0.05, 0.05, s - 0.05),
        mat(((idx++) & 1) ? '#ffffff' : '#0b0b0b', {})
      );
      tile.position.set(-ROAD_HALF + c * s + s / 2, 0.03, r * s);
      tiles.add(tile);
    }
  }
  return tiles;
}

// ── Helper: gradient sky texture ──
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, skyTop.getStyle());
  grad.addColorStop(0.7, skyHorizon.getStyle());
  grad.addColorStop(1, '#dff2ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

// ── Preview renderers for Menu + Garage (rotating 3D car) ──
const previews = []; // {renderer, scene, camera, group, canvas}

function createPreview(canvas) {
  if (!canvas) return null;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, canvas.width / canvas.height, 0.1, 60);
  cam.position.set(0, 1.1, 4.4);
  cam.lookAt(0, 0.4, 0);

  sc.add(new THREE.AmbientLight(0xffffff, 0.7));
  const d = new THREE.DirectionalLight(0xffffff, 0.9);
  d.position.set(2, 4, 3);
  sc.add(d);
  const rim = new THREE.DirectionalLight(0x88c0ff, 0.35);
  rim.position.set(-3, 2, -2);
  sc.add(rim);

  const pv = { renderer, scene: sc, camera: cam, group: null, canvas };
  previews.push(pv);
  return pv;
}

function setPreviewCar(pv, config, color) {
  if (!pv) return;
  if (pv.group) { pv.scene.remove(pv.group); disposeGroup(pv.group); }
  pv.group = buildCarMesh(config, color, { glow: true });
  pv.group.scale.set(1, 1, 1);
  pv.scene.add(pv.group);
}

function disposeGroup(g) {
  g.traverse((obj) => {
    if (obj.geometry && obj.geometry === undefined) return;
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

// ── Initialize the main 3D game world ──
function initGameScene() {
  scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(envFog, 50, 290);
  scene.fog.color = envFog;

  camera = new THREE.PerspectiveCamera(65, 1, 0.1, 500);
  camera.position.set(0, 5.5, PLAYER_Z + 9.5);
  camera.lookAt(0, 1.2, PLAYER_Z - 20);

  renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  resizeGameCanvas();

  clock = new THREE.Clock(false);

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  sunLight = new THREE.DirectionalLight(0xfff2dd, 1.0);
  sunLight.position.set(20, 40, 10);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a5a33, 0.5);
  scene.add(ambientLight, sunLight, hemi);

  // Ground grass plane (stationary, huge)
  const grassMat = mat('#2f6b3a', {});
  groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), grassMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.05;
  scene.add(groundPlane);

  // Distant background mountains (static, far away)
  const mountainMat = mat('#4b78a8', {});
  for (let i = 0; i < 12; i++) {
    const h = 24 + Math.random() * 30;
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(22 + Math.random() * 14, h, 6),
      mat(Math.random() < 0.5 ? '#3f6d9c' : '#5789b8', {})
    );
    const side = Math.random() < 0.5 ? -1 : 1;
    const mx = side * (30 + Math.random() * 120);
    m.position.set(mx, h / 2 - 6, -20 - Math.random() * 120);
    scene.add(m);
  }

  // Road surface (stationary, long enough to cover travel range)
  const roadMat = mat('#2a2f3a', {});
  roadMesh = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH, 0.22, 380), roadMat);
  roadMesh.position.set(0, 0.02, -150);
  scene.add(roadMesh);

  // Road shoulder / curb strips either side (dark accent)
  const curbMat = mat('#20242e', {});
  for (const s of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 380), curbMat);
    curb.position.set(s * CURB_X, 0.12, -150);
    scene.add(curb);
  }

  // Lane divider dashes (recycled by phase)
  const dashGeo = geo('dash', () => new THREE.BoxGeometry(0.28, 0.03, 6.5));
  const dashMatSide = mat('#ffffff', {});
  const dashMatMid = mat('#ffd200', {});
  buildDashLine(-4, dashMatMid);
  buildDashLine(0, dashMatSide);
  buildDashLine(4, dashMatSide);
  // Outer edge lines
  buildDashLine(-ROAD_HALF + 0.2, dashMatSide);
  buildDashLine(ROAD_HALF - 0.2, dashMatSide);

  // Red/white curb blocks
  buildCurbBlocks();

  // Seed initial scenery & traffic so the road isn't empty
  for (let i = 0; i < 26; i++) spawnScenery(-SPAWN_Z * (i / 26));
}

function buildDashLine(x, m) {
  for (let k = 0; k < DASH_COUNT; k++) {
    const dash = new THREE.Mesh(geo('dash' + x + '_' + k, () => new THREE.BoxGeometry(0.28, 0.03, 6.5)), m);
    dash.position.set(x, 0.04, -SPAWN_Z + k * DASH_SPACING);
    scene.add(dash);
    dashMeshes.push({ x, mesh: dash, k });
  }
}

const curbsPerSide = Math.ceil(WORLD_SPAN / 4);
function buildCurbBlocks() {
  const redMat = mat('#c4283a', {});
  const creamMat = mat('#dfe6ee', {});
  for (const s of [-1, 1]) {
    for (let k = 0; k < curbsPerSide; k++) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.34, 3.6),
        (k & 1) ? redMat : creamMat
      );
      block.position.set(s * (CURB_X), 0.15, -SPAWN_Z + k * 4);
      scene.add(block);
      dashMeshes.push({ x: s * CURB_X, mesh: block, curb: true, k });
    }
  }
}

function resizeGameCanvas() {
  if (!renderer || !gameCanvas) return;
  const w = gameCanvas.clientWidth || window.innerWidth;
  const h = gameCanvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resizeGameCanvas);

// ── Game State Variables ──
let activeScreen = 'mainMenu';
let selectedDistanceGoal = 1000;
let selectedDifficulty = 'medium';
let previewCarId = userSave.selectedCar;
let previewColor = userSave.selectedColor;

const DIFFICULTY_CONFIG = {
  easy:   { trafficSpeedMin: 40, trafficSpeedMax: 85, spawnInterval: 1300, timePerKm: 110, coinRewardMultiplier: 1.0, laneChangeChance: 0.05 },
  medium: { trafficSpeedMin: 55, trafficSpeedMax: 110, spawnInterval: 950, timePerKm: 85, coinRewardMultiplier: 1.25, laneChangeChance: 0.15 },
  hard:   { trafficSpeedMin: 70, trafficSpeedMax: 135, spawnInterval: 700, timePerKm: 65, coinRewardMultiplier: 1.6, laneChangeChance: 0.35 }
};

const input = { left: false, right: false, accelerate: false, brake: false };

const game = {
  running: false, paused: false, lastTime: 0,
  distance: 0, targetDistance: 1000, timeRemaining: 90, totalTime: 90,
  speed: 0, health: 3, coinsCollected: 0, score: 0, nearMissCombo: 0, bannerTimer: 0,
  playerX: 0, playerVX: 0,
  traffic: [], coins: [], particles: [], scenery: [],
  trafficSpawnTimer: 0, coinSpawnTimer: 0, scenerySpawnTimer: 0,
  invulnerabilityTimer: 0, phase: 0,
  crashFlash: 0
};

// playerWorld helpers
function playerWorldX() {
  return game.playerX * MAX_LATERAL;
}

// ── Screen Management ──
function showScreen(screenKey) {
  Object.values(screens).forEach(s => {
    if (s) { s.classList.remove('active'); s.style.display = 'none'; }
  });
  if (screens[screenKey]) {
    screens[screenKey].style.display = 'flex';
    void screens[screenKey].offsetWidth;
    screens[screenKey].classList.add('active');
  }
  activeScreen = screenKey;
  if (screenKey === 'mainMenu') {
    updateMainMenuUI();
    setPreviewCar(mainMenuPreview, currentCarConfig(), userSave.selectedColor);
  } else if (screenKey === 'garage') {
    updateGarageUI();
  } else if (screenKey === 'raceSetup') {
    updateRaceSetupUI();
  } else if (screenKey === 'game') {
    if (!scene) initGameScene();
    resizeGameCanvas();
  }
}

function currentCarConfig() {
  return CAR_DATABASE.find(c => c.id === userSave.selectedCar) || CAR_DATABASE[0];
}

// ── Main Menu UI Update ──
function updateMainMenuUI() {
  const coinsEl = document.getElementById('menuCoins');
  const carNameEl = document.getElementById('menuCarName');
  const bestDistEl = document.getElementById('menuBestDist');
  const bestScoreEl = document.getElementById('menuBestScore');
  const curCar = currentCarConfig();
  if (coinsEl) coinsEl.textContent = userSave.coins.toLocaleString();
  if (carNameEl) carNameEl.textContent = curCar.name;
  if (bestDistEl) bestDistEl.textContent = `${Math.floor(userSave.bestDistance)} m`;
  if (bestScoreEl) bestScoreEl.textContent = userSave.bestScore.toLocaleString();
}

// ── Race Setup Screen UI Update ──
function updateRaceSetupUI() {
  const targetDisplay = document.getElementById('setupTargetDisplay');
  const timeDisplay = document.getElementById('setupTimeDisplay');
  const rewardDisplay = document.getElementById('setupRewardDisplay');
  const conf = DIFFICULTY_CONFIG[selectedDifficulty];
  const timeLimit = Math.round((selectedDistanceGoal / 1000) * conf.timePerKm);
  const baseReward = Math.round((selectedDistanceGoal / 2) * conf.coinRewardMultiplier);
  if (targetDisplay) targetDisplay.textContent = `${selectedDistanceGoal >= 1000 ? (selectedDistanceGoal / 1000) + ' km' : selectedDistanceGoal + ' m'}`;
  if (timeDisplay) timeDisplay.textContent = `${timeLimit}s`;
  if (rewardDisplay) rewardDisplay.textContent = `🟡 ${baseReward} Coins`;
}

// ── Garage UI Management ──
function updateGarageUI() {
  const coinsEl = document.getElementById('garageCoins');
  if (coinsEl) coinsEl.textContent = userSave.coins.toLocaleString();
  const container = document.getElementById('carCardsContainer');
  if (!container) return;
  container.innerHTML = '';
  CAR_DATABASE.forEach(car => {
    const isOwned = userSave.ownedCars.includes(car.id);
    const isSelected = userSave.selectedCar === car.id;
    const isFocused = previewCarId === car.id;
    const card = document.createElement('div');
    card.className = `car-card ${isFocused ? 'active' : ''}`;
    card.innerHTML = `
      <div class="car-card-name">${car.name}</div>
      <div class="car-card-brand">${car.brand}</div>
      <div class="car-card-price">${isOwned ? (isSelected ? 'EQUIPPED' : 'OWNED') : `🟡 ${car.price.toLocaleString()}`}</div>
    `;
    card.addEventListener('click', () => {
      audio.playClick();
      previewCarId = car.id;
      updateGarageShowcase();
      updateGarageUI();
    });
    container.appendChild(card);
  });
  updateGarageShowcase();
}

function updateGarageShowcase() {
  const car = CAR_DATABASE.find(c => c.id === previewCarId) || CAR_DATABASE[0];
  const isOwned = userSave.ownedCars.includes(car.id);
  const isSelected = userSave.selectedCar === car.id;

  const nameEl = document.getElementById('showcaseName');
  const brandEl = document.getElementById('showcaseBrand');
  const priceTagEl = document.getElementById('showcasePriceTag');
  const actionBtn = document.getElementById('garageActionBtn');
  const speedVal = document.getElementById('statSpeedVal');
  const speedBar = document.getElementById('statSpeedBar');
  const handlingVal = document.getElementById('statHandlingVal');
  const handlingBar = document.getElementById('statHandlingBar');
  const brakingVal = document.getElementById('statBrakingVal');
  const brakingBar = document.getElementById('statBrakingBar');

  if (nameEl) nameEl.textContent = car.name;
  if (brandEl) brandEl.textContent = car.brand;
  if (priceTagEl) {
    if (isOwned) { priceTagEl.textContent = isSelected ? 'CURRENTLY SELECTED' : 'OWNED IN GARAGE'; priceTagEl.style.color = '#00ff88'; }
    else { priceTagEl.textContent = `🟡 ${car.price.toLocaleString()} COINS`; priceTagEl.style.color = '#ffd000'; }
  }
  const speedPct = Math.round((car.topSpeed / 280) * 100);
  if (speedVal) speedVal.textContent = `${car.topSpeed} km/h`;
  if (speedBar) speedBar.style.width = `${speedPct}%`;
  if (handlingVal) handlingVal.textContent = `${car.handling}%`;
  if (handlingBar) handlingBar.style.width = `${car.handling}%`;
  if (brakingVal) brakingVal.textContent = `${car.braking}%`;
  if (brakingBar) brakingBar.style.width = `${car.braking}%`;

  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(sw => {
    if (sw.getAttribute('data-color') === previewColor) sw.classList.add('active');
    else sw.classList.remove('active');
  });

  // Refresh the 3D garage preview
  setPreviewCar(garagePreview, car, previewColor);

  if (actionBtn) {
    if (isSelected) {
      actionBtn.textContent = 'EQUIPPED';
      actionBtn.className = 'btn btn-dark';
      actionBtn.disabled = true;
    } else if (isOwned) {
      actionBtn.textContent = 'SELECT CAR';
      actionBtn.className = 'btn btn-primary pulse-btn';
      actionBtn.disabled = false;
      actionBtn.onclick = () => {
        audio.playClick();
        userSave.selectedCar = car.id;
        StorageManager.save(userSave);
        updateGarageShowcase();
        updateGarageUI();
        setPreviewCar(garagePreview, car, previewColor);
      };
    } else {
      const canAfford = userSave.coins >= car.price;
      actionBtn.textContent = canAfford ? `BUY CAR (🟡 ${car.price})` : `NEED 🟡 ${(car.price - userSave.coins)} MORE`;
      actionBtn.className = canAfford ? 'btn btn-primary pulse-btn' : 'btn btn-dark';
      actionBtn.disabled = !canAfford;
      actionBtn.onclick = () => {
        if (userSave.coins >= car.price) {
          audio.playCoin();
          userSave.coins -= car.price;
          userSave.ownedCars.push(car.id);
          userSave.selectedCar = car.id;
          StorageManager.save(userSave);
          updateGarageShowcase();
          updateGarageUI();
          setPreviewCar(garagePreview, car, previewColor);
        }
      };
    }
  }
}

// ── Spawn: Traffic ──
function spawnTrafficVehicle(conf) {
  const lane = Math.floor(Math.random() * LANES);
  const x = laneCenterX(lane);
  const carType = CAR_DATABASE[Math.floor(Math.random() * CAR_DATABASE.length)];
  const colors = ['#2266dd', '#dd3333', '#22bb55', '#eeaa11', '#8844cc', '#334455', '#e0e0e0'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const speed = conf.trafficSpeedMin + Math.random() * (conf.trafficSpeedMax - conf.trafficSpeedMin);

  const mesh = buildCarMesh(carType, color, { spoiler: false, glow: false });
  const z = SPAWN_Z + (Math.random() * 30 - 15);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = 0;
  scene.add(mesh);

  game.traffic.push({ x, z, y: 0, mesh, carType, color, speed, passed: false, lane, targetX: null });
}

// ── Spawn: Coins ──
function spawnCoinCluster() {
  const lane = Math.floor(Math.random() * LANES);
  const x = laneCenterX(lane);
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const mesh = buildCoinMesh();
    mesh.position.set(x, 0.7, SPAWN_Z - i * 5);
    scene.add(mesh);
    game.coins.push({ x, z: SPAWN_Z - i * 5, mesh, val: 5, rot: Math.random() * Math.PI * 2, taken: false });
  }
}

// ── Spawn: Scenery (recycled endlessly) ──
function spawnScenery(zPos) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = side * (ROAD_HALF + 3 + Math.random() * 40);
  const roll = Math.random();
  let mesh;
  if (roll < 0.34) mesh = buildTree(1 + Math.random());
  else if (roll < 0.56) mesh = buildLamp();
  else if (roll < 0.72) mesh = buildSign(x);
  else if (roll < 0.82) mesh = buildBuilding(8 + Math.random() * 18);
  else mesh = buildRock(0.8 + Math.random());

  const z = (zPos !== undefined ? zPos : SPAWN_Z + Math.random() * WORLD_SPAN);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  game.scenery.push({ x, z, mesh, side });
}

// ── Particles: 3D sparks ──
function spawnParticleBurst(x, z, color) {
  for (let i = 0; i < 20; i++) {
    const mesh = new THREE.Mesh(
      geo('particleBox', () => new THREE.BoxGeometry(0.12, 0.12, 0.12)),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.9
      })
    );
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 6;
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);
    game.particles.push({
      mesh,
      vx: Math.cos(ang) * spd,
      vz: Math.sin(ang) * spd,
      vy: 1 + Math.random() * 4,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9
    });
  }
}

function spawnSmoke(x, z) {
  const mesh = new THREE.Mesh(
    geo('smokeBox', () => new THREE.BoxGeometry(0.4, 0.2, 0.4)),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#d8d8d8'), transparent: true, opacity: 0.5 })
  );
  mesh.position.set(x, 0.2, z);
  scene.add(mesh);
  game.particles.push({ mesh, vx: (Math.random() - 0.5), vz: Math.random() * 2 + 1, vy: 0.6, life: 0.35, maxLife: 0.35 });
}

// ── Show floating banner ──
function showBanner(text) {
  if (!gameBanner) return;
  gameBanner.textContent = text;
  gameBanner.classList.add('show');
  game.bannerTimer = 1.4;
}

// ── Game Start ──
function startNewRace() {
  audio.init();
  if (!scene) initGameScene();
  resizeGameCanvas();

  const conf = DIFFICULTY_CONFIG[selectedDifficulty];
  const timeLimit = Math.round((selectedDistanceGoal / 1000) * conf.timePerKm);

  game.running = true;
  game.paused = false;
  game.distance = 0;
  game.targetDistance = selectedDistanceGoal;
  game.timeRemaining = timeLimit;
  game.totalTime = timeLimit;
  game.speed = 30;
  game.health = 3;
  game.coinsCollected = 0;
  game.score = 0;
  game.nearMissCombo = 0;
  game.bannerTimer = 0;
  game.playerX = 0;
  game.playerVX = 0;
  game.invulnerabilityTimer = 0;
  game.phase = 0;
  game.crashFlash = 0;

  // Reset moving scene parts
  clearDynamicScene();

  // Player car
  playerCar = currentCarConfig();
  if (playerCarGroup) { scene.remove(playerCarGroup); disposeGroup(playerCarGroup); }
  playerCarGroup = buildCarMesh(playerCar, userSave.selectedColor, { glow: true });
  scene.add(playerCarGroup);

  // Seed initial traffic and coins
  spawnTrafficVehicle(conf);
  spawnTrafficVehicle(conf);
  spawnTrafficVehicle(conf);
  for (let i = 0; i < 2; i++) spawnCoinCluster();

  // Preload scenery across the whole visible span
  for (let i = 0; i < 30; i++) spawnScenery(SPAWN_Z + Math.random() * WORLD_SPAN);

  // Reset camera
  camera.position.set(0, 5.5, PLAYER_Z + 9.5);
  camera.lookAt(0, 1.2, PLAYER_Z - 20);

  updateHUD();
  showScreen('game');

  audio.startEngine();
  clock.start();
  game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function clearDynamicScene() {
  // remove all dynamic entities + scene they reference that is not static
  game.traffic.forEach(t => { if (t.mesh) { scene.remove(t.mesh); disposeGroup(t.mesh); } });
  game.coins.forEach(c => { if (c.mesh) { scene.remove(c.mesh); disposeGroup(c.mesh); } });
  game.particles.forEach(p => { if (p.mesh) scene.remove(p.mesh); });
  game.scenery.forEach(s => { if (s.mesh) { scene.remove(s.mesh); disposeGroup(s.mesh); } });
  game.traffic = [];
  game.coins = [];
  game.particles = [];
  game.scenery = [];

  // Refresh the dash phase to 0 and repopulate curb/scenery static backdrop once
  dashMeshes.forEach(d => {
    d.phase = 0;
  });
}

// ── Main Game Loop ──
function gameLoop() {
  if (!game.running) return;
  requestAnimationFrame(gameLoop);
  const currentTime = performance.now();
  const dt = Math.min((currentTime - game.lastTime) / 1000, 0.1);
  game.lastTime = currentTime;
  if (!game.paused) {
    updateGame(dt);
  }
  renderGame();
}

// ── Gameplay Logic & Updates ──
function updateGame(dt) {
  const curCar = currentCarConfig();
  const conf = DIFFICULTY_CONFIG[selectedDifficulty];

  // Timer countdown
  game.timeRemaining -= dt;
  if (game.timeRemaining <= 0) { game.timeRemaining = 0; triggerGameOver('Time expired before reaching the target finish line!'); return; }

  // Acceleration & Braking
  const maxSpeed = curCar.topSpeed;
  const accelRate = (curCar.acceleration / 100) * 85;
  const brakeRate = (curCar.braking / 100) * 160;
  const dragRate = 22;

  if (input.accelerate) {
    game.speed = Math.min(maxSpeed, game.speed + accelRate * dt);
  } else if (input.brake) {
    game.speed = Math.max(0, game.speed - brakeRate * dt);
    audio.playBrake();
    if (game.speed > 50 && Math.random() < 0.3) spawnSmoke(playerWorldX(), PLAYER_Z + 1);
  } else {
    if (game.speed > 45) game.speed = Math.max(45, game.speed - dragRate * dt);
    else if (game.speed < 45) game.speed = Math.min(45, game.speed + accelRate * 0.5 * dt);
  }
  audio.updateEnginePitch(game.speed / maxSpeed);

  // Distance & world scroll
  const speedMPS = game.speed * 0.2778;
  const distTraveled = speedMPS * dt;
  game.distance += distTraveled;
  game.score += Math.round(distTraveled * 1.5);
  // Visual scroll scale: 1 km/h = 1 world unit/sec (tuned for good feel at typical speeds)
  worldDelta = game.speed * dt;

  // Win condition
  if (game.distance >= game.targetDistance) { triggerWin(); return; }

  // Steering
  const steerAgility = (curCar.handling / 100) * 2.8;
  if (input.left) game.playerVX = Math.max(-steerAgility, game.playerVX - steerAgility * 5 * dt);
  else if (input.right) game.playerVX = Math.min(steerAgility, game.playerVX + steerAgility * 5 * dt);
  else game.playerVX *= 0.82;
  game.playerX += game.playerVX * dt * (game.speed > 10 ? 1 : 0.2);

  const maxOffset = 0.94;
  if (game.playerX < -maxOffset) { game.playerX = -maxOffset; game.playerVX = 0; game.speed = Math.max(25, game.speed - 80 * dt); }
  else if (game.playerX > maxOffset) { game.playerX = maxOffset; game.playerVX = 0; game.speed = Math.max(25, game.speed - 80 * dt); }

  // Invulnerability
  if (game.invulnerabilityTimer > 0) game.invulnerabilityTimer -= dt;
  if (game.crashFlash > 0) game.crashFlash -= dt;

  // Spawning
  game.trafficSpawnTimer += dt * 1000;
  if (game.trafficSpawnTimer >= conf.spawnInterval) { game.trafficSpawnTimer = 0; spawnTrafficVehicle(conf); }
  game.coinSpawnTimer += dt * 1000;
  if (game.coinSpawnTimer >= 1400) { game.coinSpawnTimer = 0; spawnCoinCluster(); }
  game.scenerySpawnTimer += dt * 1000;
  if (game.scenerySpawnTimer >= 900) { game.scenerySpawnTimer = 0; spawnScenery(SPAWN_Z - 20); }

  // World scroll: all moving entities move +Z (toward / past camera)
  scrollWorld(dt, conf);

  // Player mesh transform (steering yaw + roll tilt + wheel spin)
  const pwX = playerWorldX();
  const steer = game.playerVX / 2.8;
  if (playerCarGroup) {
    playerCarGroup.position.x = pwX;
    playerCarGroup.position.y = 0;
    playerCarGroup.position.z = PLAYER_Z;
    playerCarGroup.rotation.y = -steer * 0.22;
    playerCarGroup.rotation.z = -steer * 0.06;
    // Invulnerability flicker
    if (game.invulnerabilityTimer > 0) {
      const blinkRate = 8; // blinks per second
      playerCarGroup.visible = Math.floor(game.invulnerabilityTimer * blinkRate) % 2 === 0;
    } else {
      playerCarGroup.visible = true;
    }
    if (playerCarGroup.userData.wheels) {
      const spin = game.speed * 12 * dt;
      playerCarGroup.userData.wheels.forEach(w => w.rotation.x -= spin);
    }
    // Brake lights brighten
    if (playerCarGroup.userData.tailMat) {
      playerCarGroup.userData.tailMat.emissive.setHex(input.brake ? 0xff2200 : 0x990011);
    }
  }

  // Traffic update + collisions
  const pwXabs = Math.abs(pwX);
  for (let i = game.traffic.length - 1; i >= 0; i--) {
    const t = game.traffic[i];
    // AI lane change
    if (t.targetX === null && Math.random() < conf.laneChangeChance * dt) {
      const targetLane = Math.floor(Math.random() * LANES);
      t.targetX = laneCenterX(targetLane);
    }
    if (t.targetX !== null) {
      const dx = t.targetX - t.x;
      t.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.2 * dt);
      if (Math.abs(t.x - t.targetX) < 0.05) t.targetX = null;
    }

    // Overtake / near-miss bonus (passed player plane)
    if (!t.passed && t.z > PLAYER_Z + 1 && Math.abs(t.x - pwX) < 2.2) {
      t.passed = true;
      game.nearMissCombo++;
      const bonus = game.nearMissCombo * 20;
      game.score += bonus;
      showBanner(`⚡ CLOSE OVERTAKE +${bonus}`);
    }

    // Collision (AABB on road plane)
    if (game.invulnerabilityTimer <= 0) {
      const hitX = Math.abs(t.x - pwX) < (playerCar.width / 2 + t.carType.width / 2 - 0.1);
      const hitZ = Math.abs(t.z - PLAYER_Z) < (playerCar.length / 2 + t.carType.length / 2 - 0.2);
      if (hitX && hitZ) handlePlayerCrash(t);
    }

    // Remove far away
    if (t.z > BEHIND_Z + 120) { scene.remove(t.mesh); disposeGroup(t.mesh); game.traffic.splice(i, 1); }
  }

  // Coins update
  for (let i = game.coins.length - 1; i >= 0; i--) {
    const c = game.coins[i];
    c.rot += dt * 4;
    c.mesh.rotation.y = c.rot;
    const dx = Math.abs(c.x - pwX);
    const dz = Math.abs(c.z - PLAYER_Z);
    if (!c.taken && dx < 1.3 && dz < 1.6) {
      c.taken = true;
      audio.playCoin();
      game.coinsCollected += c.val;
      game.score += c.val * 50;
      spawnParticleBurst(c.x, c.z, '#ffd200');
      scene.remove(c.mesh);
      disposeGroup(c.mesh);
      game.coins.splice(i, 1);
    } else if (c.z > BEHIND_Z + 40) {
      scene.remove(c.mesh);
      disposeGroup(c.mesh);
      game.coins.splice(i, 1);
    }
  }

  // Particle life/positions handled inside scrollWorld (single source of truth)

  // Banner timer
  if (game.bannerTimer > 0) {
    game.bannerTimer -= dt;
    if (game.bannerTimer <= 0 && gameBanner) gameBanner.classList.remove('show');
  }

  // Camera follow (smooth)
  const targetCamX = pwX * 0.6;
  camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 5);
  camera.position.y = 5.5;
  camera.position.z = PLAYER_Z + 9.5;
  camera.lookAt(pwX * 0.8, 1.4, PLAYER_Z - 24);

  updateHUD();
}

// ── Scroll the world forward (+Z) and recycle ──
function scrollWorld(dt, conf) {
  if (worldDelta === 0) return;

  // Advance dash phase and position all dash/curb meshes
  game.phase = (game.phase + worldDelta) % DASH_SPAN;
  dashMeshes.forEach(d => {
    if (d.curb) {
      // Curb blocks: each gets an index k; move with phase
      const seg = 4;
      const total = seg * curbsPerSide;
      const ph = ((game.phase + d.k * seg) % total + total) % total;
      d.mesh.position.z = -SPAWN_Z + ph;
      // Keep blocks within the spawn range; blocks that pass the rear wrap to front
      if (d.mesh.position.z > BEHIND_Z) {
        d.mesh.position.z -= total;
      }
      if (d.mesh.position.z < -SPAWN_Z - total) {
        d.mesh.position.z += total;
      }
    } else {
      // Dashes: each dash moves with the phase
      d.mesh.position.z = -SPAWN_Z + ((game.phase + d.k * DASH_SPACING) % (DASH_SPACING * DASH_COUNT));
      if (d.mesh.position.z > BEHIND_Z) d.mesh.position.z -= DASH_SPACING * DASH_COUNT;
      if (d.mesh.position.z < -SPAWN_Z) d.mesh.position.z += DASH_SPACING * DASH_COUNT;
    }
  });

  // Traffic scroll: each traffic object moves at its own speed relative to world
  const worldSpeedFactor = 1.0; // world scroll speed factor (worldDelta units per second)
  for (const t of game.traffic) {
    // Traffic speed in world units per second (tuned so typical 60-120 km/h traffic moves slowly relative)
    const trafficWorldSpeed = t.speed * 0.35;
    // Relative motion: world scrolls forward at worldSpeedFactor, traffic moves backward at its speed
    t.z += worldDelta * worldSpeedFactor - trafficWorldSpeed * dt;
    t.mesh.position.x = t.x;
    t.mesh.position.z = t.z;
    // Smooth lane changing
    if (t.targetX !== null) {
      const dx = t.targetX - t.x;
      if (Math.abs(dx) > 0.01) {
        t.x += Math.sign(dx) * Math.min(Math.abs(dx), 3 * dt);
        t.mesh.position.x = t.x;
      } else {
        t.targetX = null; // reached target lane
      }
    }
  }

  // Coins scroll with world
  for (const c of game.coins) {
    c.z += worldDelta;
    c.mesh.position.z = c.z;
    c.mesh.position.x = c.x;
    // Recycle coins that go too far behind
    if (c.z > BEHIND_Z + 80) {
      scene.remove(c.mesh);
      disposeGroup(c.mesh);
      const idx = game.coins.indexOf(c);
      if (idx !== -1) game.coins.splice(idx, 1);
    }
  }

  // Particles: fly outward with gravity (stay in world space, no world scroll)
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
      game.particles.splice(i, 1);
      continue;
    }
    // Simple outward flight in local world coords (particles not affected by world scroll)
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.position.y += p.vy * dt;
    p.vy -= dt * (8 + Math.random() * 4); // gravity pull
    p.vx *= 0.98; // drag
    p.vz *= 0.98;
    // Fade and shrink
    const t = p.life / p.maxLife;
    p.mesh.scale.setScalar(Math.max(0.01, t));
    if (p.mesh.material) p.mesh.material.opacity = t;
  }

  // Scenery scroll + recycle (objects behind player get respawned ahead)
  for (let i = game.scenery.length - 1; i >= 0; i--) {
    const s = game.scenery[i];
    s.z += worldDelta;
    if (s.z > BEHIND_Z + 60) { // behind camera enough to recycle
      // recycle ahead with new random side/type
      scene.remove(s.mesh);
      disposeGroup(s.mesh);
      game.scenery.splice(i, 1);
      // Spawn new scenery well ahead of player
      spawnScenery(SPAWN_Z - 30 + Math.random() * 20);
      continue;
    }
    s.mesh.position.z = s.z;
    s.mesh.position.x = s.x;
  }
}

// ── Crash handling ──
function handlePlayerCrash(t) {
  audio.playCrash();
  game.health--;
  game.speed = Math.max(20, game.speed * 0.35);
  game.invulnerabilityTimer = 1.8;
  game.nearMissCombo = 0;
  game.crashFlash = 0.25;
  if (damageFlashOverlay) {
    damageFlashOverlay.classList.add('active');
    setTimeout(() => damageFlashOverlay.classList.remove('active'), 250);
  }
  spawnParticleBurst(playerWorldX(), PLAYER_Z, '#ff3344');
  showBanner('💥 COLLISION!');
  if (game.health <= 0) triggerGameOver('Your car was totaled in traffic collisions!');
}

// ── Rendering (Three.js) ──
function renderGame() {
  if (!renderer) return;
  // Crash screen shake
  if (game.crashFlash > 0) {
    camera.position.x += (Math.random() - 0.5) * 0.4;
    camera.position.y += (Math.random() - 0.5) * 0.3;
  }
  if (damageFlashOverlay && game.crashFlash > 0 && Math.floor(game.crashFlash * 30) % 2 === 0) {
    if (!damageFlashOverlay.classList.contains('active')) damageFlashOverlay.classList.add('active');
  } else if (damageFlashOverlay && game.crashFlash <= 0) {
    damageFlashOverlay.classList.remove('active');
  }
  renderer.render(scene, camera);
}

// ── Preview render loop (menu + garage) ──
function previewLoop() {
  previews.forEach(pv => {
    if (pv.group) {
      pv.group.rotation.y += 0.018;
      if (pv.group.userData.wheels) pv.group.userData.wheels.forEach(w => w.rotation.x += 0.1);
      pv.renderer.render(pv.scene, pv.camera);
    }
  });
  requestAnimationFrame(previewLoop);
}

// ── HUD Updates ──
function updateHUD() {
  if (hudDistance) {
    const distText = game.targetDistance >= 1000
      ? `${Math.floor(game.distance)} m / ${(game.targetDistance / 1000)} km`
      : `${Math.floor(game.distance)} m / ${game.targetDistance} m`;
    hudDistance.textContent = distText;
  }
  if (distFill) {
    const pct = Math.min(100, Math.max(0, (game.distance / game.targetDistance) * 100));
    distFill.style.width = `${pct}%`;
  }
  if (hudTime) {
    const mins = Math.floor(game.timeRemaining / 60);
    const secs = Math.floor(game.timeRemaining % 60);
    hudTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    hudTime.style.color = game.timeRemaining < 15 ? '#ff3344' : '#fff';
  }
  if (hudSpeed) hudSpeed.textContent = `${Math.round(game.speed)} km/h`;
  if (hudCoins) hudCoins.textContent = game.coinsCollected;
  for (let i = 0; i < 3; i++) {
    if (heartEls[i]) {
      if (i < game.health) heartEls[i].classList.remove('empty');
      else heartEls[i].classList.add('empty');
    }
  }
}

// ── Win / Game Over Sequences ──
function triggerWin() {
  game.running = false;
  audio.stopEngine();
  audio.playWin();
  const conf = DIFFICULTY_CONFIG[selectedDifficulty];
  const finishBonus = Math.round((selectedDistanceGoal / 2) * conf.coinRewardMultiplier);
  const totalCoinsEarned = game.coinsCollected + finishBonus;
  userSave.coins += totalCoinsEarned;
  if (game.distance > userSave.bestDistance) userSave.bestDistance = game.distance;
  if (game.score > userSave.bestScore) userSave.bestScore = game.score;
  StorageManager.save(userSave);

  const winDistVal = document.getElementById('winDistVal');
  const winTimeVal = document.getElementById('winTimeVal');
  const winCoinsVal = document.getElementById('winCoinsVal');
  const winBonusVal = document.getElementById('winBonusVal');
  const winScoreVal = document.getElementById('winScoreVal');
  const mins = Math.floor(game.timeRemaining / 60);
  const secs = Math.floor(game.timeRemaining % 60);
  if (winDistVal) winDistVal.textContent = `${Math.floor(game.distance)} m`;
  if (winTimeVal) winTimeVal.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  if (winCoinsVal) winCoinsVal.textContent = `🟡 +${game.coinsCollected}`;
  if (winBonusVal) winBonusVal.textContent = `🟡 +${finishBonus}`;
  if (winScoreVal) winScoreVal.textContent = game.score.toLocaleString();
  showScreen('win');
}

function triggerGameOver(reason) {
  game.running = false;
  audio.stopEngine();
  audio.playGameOver();
  userSave.coins += game.coinsCollected;
  if (game.distance > userSave.bestDistance) userSave.bestDistance = game.distance;
  if (game.score > userSave.bestScore) userSave.bestScore = game.score;
  StorageManager.save(userSave);

  const lossReasonEl = document.getElementById('lossReason');
  const lossDistVal = document.getElementById('lossDistVal');
  const lossCoinsVal = document.getElementById('lossCoinsVal');
  const lossScoreVal = document.getElementById('lossScoreVal');
  if (lossReasonEl) lossReasonEl.textContent = reason;
  if (lossDistVal) lossDistVal.textContent = `${Math.floor(game.distance)} m / ${game.targetDistance} m`;
  if (lossCoinsVal) lossCoinsVal.textContent = `🟡 +${game.coinsCollected}`;
  if (lossScoreVal) lossScoreVal.textContent = game.score.toLocaleString();
  showScreen('gameOver');
}

// ── Touch Controls Binding (Continuous Press Support) ──
function bindContinuousTouch(btnId, actionKey) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const startAction = (e) => {
    e.preventDefault(); audio.init();
    btn.classList.add('pressed');
    input[actionKey] = true;
  };
  const endAction = (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    input[actionKey] = false;
  };
  btn.addEventListener('pointerdown', startAction);
  btn.addEventListener('pointerup', endAction);
  btn.addEventListener('pointercancel', endAction);
  btn.addEventListener('pointerleave', endAction);
  btn.addEventListener('touchstart', startAction, { passive: false });
  btn.addEventListener('touchend', endAction, { passive: false });
  btn.addEventListener('touchcancel', endAction, { passive: false });
}

// ── Keyboard Controls Binding ──
function setupKeyboardControls() {
  window.addEventListener('keydown', (e) => {
    audio.init();
    const code = e.code;
    if (['ArrowLeft', 'KeyA'].includes(code)) { input.left = true; e.preventDefault(); }
    else if (['ArrowRight', 'KeyD'].includes(code)) { input.right = true; e.preventDefault(); }
    else if (['ArrowUp', 'KeyW'].includes(code)) { input.accelerate = true; e.preventDefault(); }
    else if (['ArrowDown', 'KeyS', 'Space'].includes(code)) { input.brake = true; e.preventDefault(); }
    else if (['KeyP', 'Escape'].includes(code)) { togglePause(); e.preventDefault(); }
    else if (code === 'KeyR') { if (activeScreen === 'gameOver' || activeScreen === 'win') startNewRace(); }
  });
  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (['ArrowLeft', 'KeyA'].includes(code)) input.left = false;
    else if (['ArrowRight', 'KeyD'].includes(code)) input.right = false;
    else if (['ArrowUp', 'KeyW'].includes(code)) input.accelerate = false;
    else if (['ArrowDown', 'KeyS', 'Space'].includes(code)) input.brake = false;
  });
}

function togglePause() {
  if (activeScreen !== 'game') return;
  game.paused = !game.paused;
  if (game.paused) { audio.stopEngine(); if (pauseModal) pauseModal.classList.add('active'); }
  else { audio.startEngine(); if (pauseModal) pauseModal.classList.remove('active'); game.lastTime = performance.now(); }
}

// ── DOM Event Listeners & Button Bindings ──
function setupButtonListeners() {
  const menuPlayBtn = document.getElementById('menuPlayBtn');
  if (menuPlayBtn) menuPlayBtn.addEventListener('click', () => { audio.playClick(); showScreen('raceSetup'); });

  const menuGarageBtn = document.getElementById('menuGarageBtn');
  if (menuGarageBtn) menuGarageBtn.addEventListener('click', () => { audio.playClick(); previewCarId = userSave.selectedCar; previewColor = userSave.selectedColor; showScreen('garage'); });

  const menuHowToBtn = document.getElementById('menuHowToBtn');
  if (menuHowToBtn) menuHowToBtn.addEventListener('click', () => { audio.playClick(); showScreen('howTo'); });

  const menuSettingsBtn = document.getElementById('menuSettingsBtn');
  if (menuSettingsBtn) menuSettingsBtn.addEventListener('click', () => { audio.playClick(); showScreen('settings'); });

  const distBtns = document.querySelectorAll('.dist-btn');
  distBtns.forEach(btn => btn.addEventListener('click', () => {
    audio.playClick();
    distBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDistanceGoal = parseInt(btn.getAttribute('data-dist'), 10);
    updateRaceSetupUI();
  }));

  const diffBtns = document.querySelectorAll('.diff-btn');
  diffBtns.forEach(btn => btn.addEventListener('click', () => {
    audio.playClick();
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.getAttribute('data-diff');
    updateRaceSetupUI();
  }));

  const startRaceBtn = document.getElementById('startRaceBtn');
  if (startRaceBtn) startRaceBtn.addEventListener('click', () => { audio.playClick(); startNewRace(); });

  const backFromSetupBtn = document.getElementById('backFromSetupBtn');
  if (backFromSetupBtn) backFromSetupBtn.addEventListener('click', () => { audio.playClick(); showScreen('mainMenu'); });

  const garageBackBtn = document.getElementById('garageBackBtn');
  if (garageBackBtn) garageBackBtn.addEventListener('click', () => { audio.playClick(); showScreen('mainMenu'); });

  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(sw => sw.addEventListener('click', () => {
    audio.playClick();
    const col = sw.getAttribute('data-color');
    previewColor = col;
    userSave.selectedColor = col;
    StorageManager.save(userSave);
    swatches.forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    setPreviewCar(garagePreview, CAR_DATABASE.find(c => c.id === previewCarId) || CAR_DATABASE[0], previewColor);
  }));

  const backFromHowToBtn = document.getElementById('backFromHowToBtn');
  if (backFromHowToBtn) backFromHowToBtn.addEventListener('click', () => { audio.playClick(); showScreen('mainMenu'); });

  const soundToggle = document.getElementById('settingSoundToggle');
  const engineToggle = document.getElementById('settingEngineToggle');
  const controlSizeSelect = document.getElementById('settingControlSize');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  if (soundToggle) {
    soundToggle.checked = userSave.soundEnabled;
    soundToggle.addEventListener('change', () => { userSave.soundEnabled = soundToggle.checked; audio.enabled = soundToggle.checked; });
  }
  if (engineToggle) {
    engineToggle.checked = userSave.engineEnabled;
    engineToggle.addEventListener('change', () => { userSave.engineEnabled = engineToggle.checked; audio.engineEnabled = engineToggle.checked; });
  }
  if (controlSizeSelect) {
    controlSizeSelect.value = userSave.controlSize;
    if (userSave.controlSize === 'large') document.body.classList.add('controls-large');
    controlSizeSelect.addEventListener('change', () => {
      userSave.controlSize = controlSizeSelect.value;
      if (userSave.controlSize === 'large') document.body.classList.add('controls-large');
      else document.body.classList.remove('controls-large');
    });
  }
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => { audio.playClick(); StorageManager.save(userSave); showScreen('mainMenu'); });

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', () => { audio.playClick(); togglePause(); });

  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => { audio.playClick(); togglePause(); });

  const restartPausedBtn = document.getElementById('restartPausedBtn');
  if (restartPausedBtn) restartPausedBtn.addEventListener('click', () => { audio.playClick(); if (pauseModal) pauseModal.classList.remove('active'); startNewRace(); });

  const quitToMenuBtn = document.getElementById('quitToMenuBtn');
  if (quitToMenuBtn) quitToMenuBtn.addEventListener('click', () => {
    audio.playClick(); game.running = false; audio.stopEngine();
    if (pauseModal) pauseModal.classList.remove('active');
    showScreen('mainMenu');
  });

  const winPlayAgainBtn = document.getElementById('winPlayAgainBtn');
  if (winPlayAgainBtn) winPlayAgainBtn.addEventListener('click', () => { audio.playClick(); startNewRace(); });
  const winGarageBtn = document.getElementById('winGarageBtn');
  if (winGarageBtn) winGarageBtn.addEventListener('click', () => { audio.playClick(); showScreen('garage'); });
  const winMenuBtn = document.getElementById('winMenuBtn');
  if (winMenuBtn) winMenuBtn.addEventListener('click', () => { audio.playClick(); showScreen('mainMenu'); });

  const lossRetryBtn = document.getElementById('lossRetryBtn');
  if (lossRetryBtn) lossRetryBtn.addEventListener('click', () => { audio.playClick(); startNewRace(); });
  const lossGarageBtn = document.getElementById('lossGarageBtn');
  if (lossGarageBtn) lossGarageBtn.addEventListener('click', () => { audio.playClick(); showScreen('garage'); });
  const lossMenuBtn = document.getElementById('lossMenuBtn');
  if (lossMenuBtn) lossMenuBtn.addEventListener('click', () => { audio.playClick(); showScreen('mainMenu'); });
}

// ── Application Startup ──
let mainMenuPreview = null;
let garagePreview = null;

window.addEventListener('DOMContentLoaded', () => {
  audio.enabled = userSave.soundEnabled;
  audio.engineEnabled = userSave.engineEnabled;
  if (userSave.controlSize === 'large') document.body.classList.add('controls-large');

  // Enable 3D car previews on the menu & garage canvases
  const menuCanvas = document.getElementById('menuCarCanvas');
  const garageCanvas = document.getElementById('garageCarCanvas');
  if (menuCanvas) { mainMenuPreview = createPreview(menuCanvas); setPreviewCar(mainMenuPreview, currentCarConfig(), userSave.selectedColor); }
  if (garageCanvas) { garagePreview = createPreview(garageCanvas); setPreviewCar(garagePreview, CAR_DATABASE.find(c => c.id === previewCarId) || CAR_DATABASE[0], previewColor); }

  previewLoop();

  bindContinuousTouch('btnTouchLeft', 'left');
  bindContinuousTouch('btnTouchRight', 'right');
  bindContinuousTouch('btnTouchGas', 'accelerate');
  bindContinuousTouch('btnTouchBrake', 'brake');
  setupKeyboardControls();
  setupButtonListeners();
  showScreen('mainMenu');
});