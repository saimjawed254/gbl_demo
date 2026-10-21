import * as THREE from 'three';
window.THREE = THREE;
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

// =============================================================================
// LENIS LUXURY SMOOTH SCROLLING (AWWWARDS-GRADE INTEGRATION)
// =============================================================================
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

let currentStage = 0;
let isGliding = false;
let wheelAccum = 0;
let wheelTimer = null;
let scrollDirection = 1;

function getScrollMax() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

function goToStage(targetStage, duration = 2.8) {
  targetStage = Math.max(0, Math.min(2, targetStage));
  currentStage = targetStage;
  isGliding = true;

  const scrollMax = getScrollMax();
  const targetY = (targetStage / 2) * scrollMax;

  if (targetStage < 2 && typeof isWalkthroughMode !== 'undefined' && isWalkthroughMode) {
    exitWalkthroughMode(false);
  }

  if (typeof topFloorModel !== 'undefined' && topFloorModel) {
    topFloorModel.visible = true;
  }

  // Slower, majestic human-speed glide with smooth quadratic deceleration (never rushed or overwhelming)
  lenis.scrollTo(targetY, {
    duration: duration,
    easing: (t) => 1 - Math.pow(1 - t, 2.2), // Low initial velocity, calm and gradual deceleration
    lock: true,
    force: true,
    onComplete: () => {
      isGliding = false;
      wheelAccum = 0;
    }
  });

  // Safety fallback
  setTimeout(() => {
    isGliding = false;
    wheelAccum = 0;
  }, (duration * 1000) + 150);
}

window.goToStage = goToStage;

function handleVirtualScrollIntent({ deltaY, event }) {
  // Let walkthrough dock or sidebar content scroll natively if targeted
  if (event && event.target && event.target.closest && event.target.closest('#walkthrough-dock, .sidebar-content')) {
    return true;
  }

  // Suppress browser default jerky wheel stepping
  if (event && event.cancelable) {
    event.preventDefault();
  }

  // If already in motion, ignore additional inputs to preserve fluid glide
  if (isGliding) {
    return false;
  }

  wheelAccum += deltaY;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => {
    wheelAccum = 0;
  }, 260);

  // Deliberate scroll intent threshold so movements feel spacious and measured
  const THRESHOLD = 36;

  if (wheelAccum > THRESHOLD) {
    wheelAccum = 0;
    if (currentStage < 2) {
      goToStage(currentStage + 1);
    }
    return false;
  } else if (wheelAccum < -THRESHOLD) {
    wheelAccum = 0;
    if (currentStage > 0) {
      goToStage(currentStage - 1);
    }
    return false;
  }

  return false;
}

const lenis = new Lenis({
  duration: 2.2,
  easing: (t) => 1 - Math.pow(1 - t, 2.2),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1.0,
  touchMultiplier: 2.0,
  virtualScroll: (data) => handleVirtualScrollIntent(data)
});

lenis.on('scroll', (e) => {
  ScrollTrigger.update();
  if (e.direction !== undefined && e.direction !== 0) {
    scrollDirection = e.direction;
  } else if (e.velocity !== undefined && e.velocity !== 0) {
    scrollDirection = e.velocity > 0 ? 1 : -1;
  }
});

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);
window.lenis = lenis;

// Keyboard navigation (ArrowDown / ArrowUp / Space / PageDown / PageUp)
window.addEventListener('keydown', (e) => {
  if (typeof isWalkthroughMode !== 'undefined' && isWalkthroughMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) {
    return;
  }
  if (['ArrowDown', 'PageDown', 'Space'].includes(e.code)) {
    e.preventDefault();
    if (!isGliding && currentStage < 2) {
      goToStage(currentStage + 1);
    }
  } else if (['ArrowUp', 'PageUp'].includes(e.code)) {
    e.preventDefault();
    if (!isGliding && currentStage > 0) {
      goToStage(currentStage - 1);
    }
  }
});

// Scrollbar drag settling fallback (only when user manually drags scrollbar)
let scrollbarSettleTimer = null;
window.addEventListener('scroll', () => {
  if (isGliding) return;
  clearTimeout(scrollbarSettleTimer);
  scrollbarSettleTimer = setTimeout(() => {
    if (isGliding) return;
    const scrollMax = getScrollMax();
    if (scrollMax <= 0) return;
    const progress = window.scrollY / scrollMax;
    let target = 0;
    if (progress > 0.72) target = 2;
    else if (progress > 0.28) target = 1;
    else target = 0;

    const targetY = (target / 2) * scrollMax;
    if (Math.abs(window.scrollY - targetY) > 25) {
      goToStage(target, 1.4);
    }
  }, 160);
}, { passive: true });

// =============================================================================
// 1. SETUP CANVAS, RENDERER, CAMERA & ORBIT CONTROLS
// =============================================================================
const canvas = document.getElementById('webgl-canvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  logarithmicDepthBuffer: false, // Standard depth buffer enables GPU Early-Z hardware culling
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.environmentIntensity = 0.45;
// Atmospheric aerial fog matching dynamic sky horizon (sunset default)
scene.fog = new THREE.FogExp2('#523242', 0.0012);

// Camera starts at heroic architectural perspective for Stage 01 Monolith
// High-precision near/far ratio (0.3m to 4000m = 13,333 ratio vs previous 200,000) eliminates all Revit wall Z-fighting
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.3,
  4000
);
camera.position.set(48, 65, 85);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2 + 0.02;
controls.minDistance = 2;
controls.maxDistance = 450;
// Disable mouse-wheel zoom so native page scrolling smoothly drives GSAP scrub & snapping
controls.enableZoom = false;
controls.target.set(0, 22, 0);

// Building Hierarchy Groups

// Building Hierarchy Groups
const buildingGroup = new THREE.Group();
scene.add(buildingGroup);

let buildingModel = null;
let topFloorModel = null;
const roofCapGroup = new THREE.Group();
buildingGroup.add(roofCapGroup);

const exteriorWalls = [];

// Exact mathematical alignment offset calculated from pillar & wall geometry
const PENTHOUSE_ALIGNMENT_OFFSET = new THREE.Vector3(-19.896, 0.0, 6.5943);

// Roof / Top Cap Node Names in New Apartment almost.glb (Tier 3)
const ROOF_NODE_NAMES = [
  '[569010]50x50mm_Rectangular',
  '[568795]Railing',
  '[568725]Door Lg',
  '[568166]Floor',
  '[567747]ExWall',
  '[567670]ExWall',
  '[567339]ExWall',
  '[567229]ExWall',
  '[566343]Floor'
];

// =============================================================================
// 2. REALISTIC ATMOSPHERIC SKY, PROCEDURAL CLOUDS & ARCHITECTURAL GROUND
// =============================================================================
let sky = null;
let sunVector = new THREE.Vector3();

const ambientLight = new THREE.AmbientLight('#fa9b70', 0.25);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight('#f7a474', '#4a443a', 0.38);
hemiLight.position.set(0, 80, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#ff8a42', 1.8);
sunLight.position.set(75, 95, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 400;
const shadowDist = 95;
sunLight.shadow.camera.left = -shadowDist;
sunLight.shadow.camera.right = shadowDist;
sunLight.shadow.camera.top = shadowDist;
sunLight.shadow.camera.bottom = -shadowDist;
sunLight.shadow.bias = -0.0001;
sunLight.shadow.normalBias = 0.025;
scene.add(sunLight);
scene.add(sunLight.target);
sunLight.target.position.set(0, 18, 0);

// =============================================================================
// 2. LUXURY ARCHITECTURAL MATERIALS & PROCEDURAL PBR TEXTURE PIPELINE
// =============================================================================
const modelBase = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';
const textureLoader = new THREE.TextureLoader();

// 1. Luxury Parquet European Oak Floor (Penthouse Living & Private Quarters)
const woodFloorDiff = textureLoader.load(`${modelBase}textures/wood_floor/wood_floor_diff_2k.jpg`);
woodFloorDiff.colorSpace = THREE.SRGBColorSpace;
woodFloorDiff.wrapS = woodFloorDiff.wrapT = THREE.RepeatWrapping;
woodFloorDiff.repeat.set(10, 10);
const woodFloorRough = textureLoader.load(`${modelBase}textures/wood_floor/wood_floor_rough_2k.jpg`);
woodFloorRough.wrapS = woodFloorRough.wrapT = THREE.RepeatWrapping;
woodFloorRough.repeat.set(10, 10);
const woodFloorNor = textureLoader.load(`${modelBase}textures/wood_floor/wood_floor_nor_gl_2k.jpg`);
woodFloorNor.wrapS = woodFloorNor.wrapT = THREE.RepeatWrapping;
woodFloorNor.repeat.set(10, 10);

const interiorWoodFloorMat = new THREE.MeshStandardMaterial({
  map: woodFloorDiff,
  normalMap: woodFloorNor,
  normalScale: new THREE.Vector2(0.5, 0.5),
  roughnessMap: woodFloorRough,
  roughness: 0.38,
  metalness: 0.02,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

// 2. Italian Calacatta Honed Marble (Penthouse Bathrooms & Kitchen Counters)
const marbleDiff = textureLoader.load(`${modelBase}textures/marble/marble_diff_2k.jpg`);
marbleDiff.colorSpace = THREE.SRGBColorSpace;
marbleDiff.wrapS = marbleDiff.wrapT = THREE.RepeatWrapping;
marbleDiff.repeat.set(4, 4);
const marbleRough = textureLoader.load(`${modelBase}textures/marble/marble_rough_2k.jpg`);
marbleRough.wrapS = marbleRough.wrapT = THREE.RepeatWrapping;
marbleRough.repeat.set(4, 4);

const interiorMarbleMat = new THREE.MeshStandardMaterial({
  map: marbleDiff,
  roughnessMap: marbleRough,
  roughness: 0.22,
  metalness: 0.04,
  envMapIntensity: 0.22,
  side: THREE.DoubleSide
});

// Procedural Luxury Architectural Honed Limestone Cladding Generator (Diffuse, Normal & Roughness)
// Precision large-format masonry panels with soft organic tone variation and microscopic honed stone tooth
function createLuxuryLimestoneTextures() {
  const w = 1024, h = 1024;
  const dCanvas = document.createElement('canvas'); dCanvas.width = w; dCanvas.height = h;
  const nCanvas = document.createElement('canvas'); nCanvas.width = w; nCanvas.height = h;
  const rCanvas = document.createElement('canvas'); rCanvas.width = w; rCanvas.height = h;

  const dCtx = dCanvas.getContext('2d');
  const nCtx = nCanvas.getContext('2d');
  const rCtx = rCanvas.getContext('2d');

  const dImg = dCtx.createImageData(w, h);
  const nImg = nCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  let seed = 73291;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Pre-generate subtle tone offsets for architectural stone blocks (4 horizontal x 4 vertical panels)
  const blockOffsets = [];
  for (let by = 0; by < 4; by++) {
    blockOffsets[by] = [];
    for (let bx = 0; bx < 4; bx++) {
      blockOffsets[by][bx] = (rand() - 0.5) * 4.5;
    }
  }

  for (let y = 0; y < h; y++) {
    const by = Math.min(3, Math.floor(y / 256));
    const localY = y % 256;
    const isHorizJoint = localY < 2 || localY > 254;

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const bx = Math.min(3, Math.floor(x / 256));
      const localX = x % 256;
      const isVertJoint = localX < 2 || localX > 254;

      // Natural sediment tooth & subtle travertine clouding
      const grain = (rand() - 0.5) * 2.2;
      const cloud = (Math.sin(x * 0.006) + Math.cos(y * 0.006)) * 1.5;
      const blockLuma = blockOffsets[by][bx];

      // Base: Warm French Moleanos / Travertine Romano limestone (#ede8df)
      let r = 237 + cloud + grain + blockLuma;
      let g = 232 + cloud + grain + blockLuma;
      let b = 223 + cloud + grain + blockLuma;

      // Soft architectural panel shadow reveal at joints (gentle, anti-aliased gradient, never harsh black)
      if (isHorizJoint || isVertJoint) {
        const shadow = 9.0;
        r -= shadow;
        g -= shadow;
        b -= shadow;
      }

      // Smooth microscopic stone tooth normal map
      const normX = 128 + (rand() - 0.5) * 1.5;
      const normY = 128 + (rand() - 0.5) * 1.5;
      const normZ = 254;
      const rough = 114 + (rand() - 0.5) * 4; // ~0.44 natural silky honed tooth

      dImg.data[idx] = Math.max(0, Math.min(255, r));
      dImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      dImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      dImg.data[idx + 3] = 255;

      nImg.data[idx] = Math.max(0, Math.min(255, normX));
      nImg.data[idx + 1] = Math.max(0, Math.min(255, normY));
      nImg.data[idx + 2] = Math.max(0, Math.min(255, normZ));
      nImg.data[idx + 3] = 255;

      rImg.data[idx] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 1] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 2] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const diffTex = new THREE.CanvasTexture(dCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.wrapS = diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.repeat.set(1, 1);
  diffTex.generateMipmaps = true;
  diffTex.anisotropy = 4;

  const norTex = new THREE.CanvasTexture(nCanvas);
  norTex.wrapS = norTex.wrapT = THREE.RepeatWrapping;
  norTex.repeat.set(1, 1);
  norTex.generateMipmaps = true;
  norTex.anisotropy = 4;

  const roughTex = new THREE.CanvasTexture(rCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(1, 1);
  roughTex.generateMipmaps = true;
  roughTex.anisotropy = 4;

  return { diffTex, norTex, roughTex };
}

// Procedural Architectural Precast Spandrel Panel Generator (Spandrels & Parapets)
// Refined champagne stone with broad, gentle architectural relief catching raking sunlight smoothly
function createLuxuryFlutedPanelTextures() {
  const w = 512, h = 512;
  const dCanvas = document.createElement('canvas'); dCanvas.width = w; dCanvas.height = h;
  const nCanvas = document.createElement('canvas'); nCanvas.width = w; nCanvas.height = h;
  const rCanvas = document.createElement('canvas'); rCanvas.width = w; rCanvas.height = h;

  const dCtx = dCanvas.getContext('2d');
  const nCtx = nCanvas.getContext('2d');
  const rCtx = rCanvas.getContext('2d');

  const dImg = dCtx.createImageData(w, h);
  const nImg = nCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  let seed = 88321;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const grain = (rand() - 0.5) * 2;

      // Subtle warm architectural travertine tone (#d8d2c6)
      const r = 216 + grain;
      const g = 210 + grain;
      const b = 198 + grain;

      const normX = 128 + (rand() - 0.5) * 2;
      const normY = 128 + (rand() - 0.5) * 2;
      const normZ = 252;

      const rough = 125 + (rand() - 0.5) * 6; // ~0.49 honed finish

      dImg.data[idx] = Math.max(0, Math.min(255, r));
      dImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      dImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      dImg.data[idx + 3] = 255;

      nImg.data[idx] = Math.max(0, Math.min(255, normX));
      nImg.data[idx + 1] = Math.max(0, Math.min(255, normY));
      nImg.data[idx + 2] = Math.max(0, Math.min(255, normZ));
      nImg.data[idx + 3] = 255;

      rImg.data[idx] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 1] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 2] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const diffTex = new THREE.CanvasTexture(dCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.wrapS = diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.repeat.set(1, 1);
  diffTex.generateMipmaps = true;

  const norTex = new THREE.CanvasTexture(nCanvas);
  norTex.wrapS = norTex.wrapT = THREE.RepeatWrapping;
  norTex.repeat.set(1, 1);
  norTex.generateMipmaps = true;

  const roughTex = new THREE.CanvasTexture(rCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(1, 1);
  roughTex.generateMipmaps = true;

  return { diffTex, norTex, roughTex };
}

// Procedural Honed Architectural Basalt Column / Pillar PBR Textures
function createColumnPBRTextures() {
  const w = 512, h = 512;
  const dCanvas = document.createElement('canvas'); dCanvas.width = w; dCanvas.height = h;
  const nCanvas = document.createElement('canvas'); nCanvas.width = w; nCanvas.height = h;
  const rCanvas = document.createElement('canvas'); rCanvas.width = w; rCanvas.height = h;

  const dCtx = dCanvas.getContext('2d');
  const nCtx = nCanvas.getContext('2d');
  const rCtx = rCanvas.getContext('2d');

  const dImg = dCtx.createImageData(w, h);
  const nImg = nCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);

  let seed = 67890;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const grain = (rand() - 0.5) * 3;

      // Structural Column: Warm Honed Basalt Architectural Concrete (#45413c)
      let r = 69 + grain;
      let g = 65 + grain;
      let b = 60 + grain;

      let normX = 128 + (rand() - 0.5) * 1.5;
      let normY = 128 + (rand() - 0.5) * 1.5;
      let normZ = 254;

      let rough = 122 + (rand() - 0.5) * 6; // ~0.48 honed structural stone

      dImg.data[idx] = Math.max(0, Math.min(255, r));
      dImg.data[idx + 1] = Math.max(0, Math.min(255, g));
      dImg.data[idx + 2] = Math.max(0, Math.min(255, b));
      dImg.data[idx + 3] = 255;

      nImg.data[idx] = Math.max(0, Math.min(255, normX));
      nImg.data[idx + 1] = Math.max(0, Math.min(255, normY));
      nImg.data[idx + 2] = Math.max(0, Math.min(255, normZ));
      nImg.data[idx + 3] = 255;

      rImg.data[idx] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 1] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 2] = Math.max(0, Math.min(255, rough));
      rImg.data[idx + 3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const diffTex = new THREE.CanvasTexture(dCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.wrapS = diffTex.wrapT = THREE.RepeatWrapping;
  diffTex.repeat.set(1, 1);

  const norTex = new THREE.CanvasTexture(nCanvas);
  norTex.wrapS = norTex.wrapT = THREE.RepeatWrapping;
  norTex.repeat.set(1, 1);

  const roughTex = new THREE.CanvasTexture(rCanvas);
  roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(1, 1);

  return { diffTex, norTex, roughTex };
}

// Procedural Architectural Granite Paver Texture for Central Podium Plaza
function createPlazaPaverTexture() {
  const w = 512, h = 512;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3733'; // Warm dark mortar joint (NOT pitch black)
  ctx.fillRect(0, 0, w, h);

  const pw = 64, ph = 32;
  for (let y = 0; y < h; y += ph) {
    const row = Math.floor(y / ph);
    const xOff = (row % 2) * (pw / 2);
    for (let x = -pw; x < w + pw; x += pw) {
      const px = x + xOff;
      // Warm architectural granite pavers (~#625d56 to #726c64)
      const tone = 100 + ((row * 13 + Math.floor(px / pw) * 17) % 18) - 9;
      ctx.fillStyle = `rgb(${tone + 3}, ${tone - 1}, ${tone - 8})`;
      ctx.fillRect(px + 2, y + 2, pw - 4, ph - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

const { diffTex: limestoneDiff, norTex: limestoneNor, roughTex: limestoneRough } = createLuxuryLimestoneTextures();
const { diffTex: spandrelDiff, norTex: spandrelNor, roughTex: spandrelRough } = createLuxuryFlutedPanelTextures();
const { diffTex: columnDiff, norTex: columnNor, roughTex: columnRough } = createColumnPBRTextures();
const plazaPaverTex = createPlazaPaverTexture();

// 3. Monolithic Luxury Honed Limestone Stone Facade (Exterior Walls)
const facadeLimestoneMat = new THREE.MeshStandardMaterial({
  map: limestoneDiff,
  normalMap: limestoneNor,
  normalScale: new THREE.Vector2(0.04, 0.04),
  roughnessMap: limestoneRough,
  roughness: 0.44,
  metalness: 0.02,
  envMapIntensity: 0.40,
  side: THREE.FrontSide
});

// 4. Luxury Architectural Precast Panels (Spandrels & Parapets)
const facadeSpandrelMat = new THREE.MeshStandardMaterial({
  map: spandrelDiff,
  normalMap: spandrelNor,
  normalScale: new THREE.Vector2(0.12, 0.12),
  roughnessMap: spandrelRough,
  roughness: 0.46,
  metalness: 0.03,
  envMapIntensity: 0.35,
  side: THREE.FrontSide
});

// 5. Structural Columns & Pillars (Honed Architectural Basalt Concrete)
const structuralColumnMat = new THREE.MeshStandardMaterial({
  map: columnDiff,
  normalMap: columnNor,
  normalScale: new THREE.Vector2(0.04, 0.04),
  roughnessMap: columnRough,
  roughness: 0.48,
  metalness: 0.04,
  envMapIntensity: 0.30,
  side: THREE.FrontSide
});

// 6. Penthouse Interior Walls - Velvet Italian Cashmere Venetian Plaster
const interiorWallMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#b5ab9d'),
  roughness: 0.62,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide
});

// 7. Architectural Precast Floor Slabs & Balcony Decks
const floorSlabMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#7a7469'),
  roughness: 0.54,
  metalness: 0.03,
  envMapIntensity: 0.32,
  side: THREE.FrontSide
});

// Dedicated Luxury Architectural Roof & Penthouse Ceiling Material (Exact match to interior walls, Double-Sided)
const roofCeilingSlabMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#b5ab9d'), // Exact same color as interior walls (#b5ab9d)
  roughness: 0.62,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide // 100% visible from above (roof terrace) and below (room interior ceiling)
});

// 8. Warm Architectural Champagne Bronze (Window Frames, Mullions, Railings, Pergola)
const metalFrameMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#38342e'),
  roughness: 0.32,
  metalness: 0.72,
  envMapIntensity: 0.65,
  side: THREE.FrontSide
});

// 9. Ultra-Luxury Physical Curtain Wall Glazing (MeshPhysicalMaterial with Optical Depth & Reflections)
const sharedGlassMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#2a4054'),
  transparent: true,
  opacity: 0.42,
  roughness: 0.03,
  metalness: 0.10,
  transmission: 0.68,
  ior: 1.52,
  reflectivity: 0.98,
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  envMapIntensity: 1.60,
  side: THREE.FrontSide
});

// 10. Penthouse Furniture - Woods:
const woodWalnutMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#3d2314'), // Warm American walnut (dining chairs, tables, desks)
  roughness: 0.32,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide
});

const woodMahoganyMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#421d12'), // Rich Brazilian mahogany (wardrobes, credenzas)
  roughness: 0.28,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide
});

const woodCherryMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#6e3319'), // Warm cherry wood
  roughness: 0.34,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide
});

const tableSurfaceTaupeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#9c9386'), // Warm matte architectural taupe table surface
  roughness: 0.38,
  metalness: 0.04,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

// 11. Penthouse Furniture - Fabrics & Leathers:
const fabricGreenMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#124438'), // Luxury deep emerald/teal velvet sofa
  roughness: 0.82,
  metalness: 0.03,
  envMapIntensity: 0.08,
  side: THREE.DoubleSide
});

const leatherTanMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#854d24'), // Warm cognac / saddle leather
  roughness: 0.42,
  metalness: 0.02,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

const leatherEspressoMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#2c1c14'), // Dark espresso leather
  roughness: 0.45,
  metalness: 0.02,
  envMapIntensity: 0.12,
  side: THREE.DoubleSide
});

const linenBeigeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#a89f91'), // Natural textured oatmeal linen upholstery
  roughness: 0.85,
  metalness: 0.01,
  envMapIntensity: 0.08,
  side: THREE.DoubleSide
});

const linenWhiteMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#d2cbbe'), // Soft warm ivory bed linen
  roughness: 0.85,
  metalness: 0.01,
  envMapIntensity: 0.08,
  side: THREE.DoubleSide
});

const carpetMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#6e6458'), // Woven wool loop luxury carpet
  roughness: 0.88,
  metalness: 0.02,
  envMapIntensity: 0.08,
  side: THREE.DoubleSide
});

// 12. Plants & Landscaping:
const plantLeafMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1e4718'), // Lush rich chlorophyll green foliage
  roughness: 0.65,
  metalness: 0.02,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

const soilMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#22160d'), // Dark rich potting soil
  roughness: 0.95,
  metalness: 0.0,
  side: THREE.DoubleSide
});

const concretePlanterMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#48443e'), // Cast concrete planter
  roughness: 0.68,
  metalness: 0.05,
  side: THREE.DoubleSide
});

// 13. Interior Doors & Hardware:
const doorPanelMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#5e3c22'), // Warm architectural oak door
  roughness: 0.35,
  metalness: 0.02,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

const doorArchitraveMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#4a321f'), // Warm architectural smoked walnut door frame (NO harsh black line)
  roughness: 0.38,
  metalness: 0.02,
  envMapIntensity: 0.15,
  side: THREE.DoubleSide
});

const doorHandleMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#121212'), // Matte black hardware
  roughness: 0.35,
  metalness: 0.85,
  side: THREE.DoubleSide
});

// 14. Metals, Chrome & Ceramics:
const polishedChromeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#dedede'), // Mirror chrome
  roughness: 0.08,
  metalness: 0.96,
  envMapIntensity: 0.5,
  side: THREE.DoubleSide
});

const satinSteelMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#6a6d73'), // Satin architectural steel
  roughness: 0.32,
  metalness: 0.85,
  envMapIntensity: 0.35,
  side: THREE.DoubleSide
});

const ceramicMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#d8d6d2'), // Glazed vitreous china
  roughness: 0.16,
  metalness: 0.02,
  envMapIntensity: 0.25,
  side: THREE.DoubleSide
});

const matteBlackMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#141414'), // Matte obsidian
  roughness: 0.42,
  metalness: 0.35,
  side: THREE.DoubleSide
});

const kitchenApplianceMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#5a5c60'), // Brushed titanium kitchen appliance finish
  roughness: 0.28,
  metalness: 0.85,
  envMapIntensity: 0.4,
  side: THREE.DoubleSide
});

const artworkCanvasMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#4a443a'), // Gallery framed wall art canvas
  roughness: 0.75,
  metalness: 0.02,
  side: THREE.DoubleSide
});

// 15. Driveway Vehicles (Ford Raptor):
const carPaintMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#1c212a'), // Deep metallic gunmetal navy
  metalness: 0.45,
  roughness: 0.28,
  envMapIntensity: 0.5,
  side: THREE.DoubleSide
});

const carTireMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#111111'), // Vulcanized matte tire rubber
  roughness: 0.92,
  metalness: 0.02,
  side: THREE.DoubleSide
});

const carTaillightMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#990808'), // Deep ruby taillight glass
  roughness: 0.12,
  transmission: 0.65,
  transparent: true,
  side: THREE.DoubleSide
});

const carWheelMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#30333a'), // Graphite alloy wheel
  metalness: 0.82,
  roughness: 0.28,
  envMapIntensity: 0.5,
  side: THREE.DoubleSide
});

const carTrimMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#151515'), // Matte black bumper & grille
  roughness: 0.45,
  metalness: 0.2,
  side: THREE.DoubleSide
});

// 16. Site & Street Materials:
const siteAsphaltMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#2c2e34'), // Realistic weathered urban bitumen asphalt
  roughness: 0.86,
  metalness: 0.04,
  envMapIntensity: 0.20,
  side: THREE.DoubleSide
});

const siteGravelMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#2b2824'), // Coarse crushed granite gravel
  roughness: 0.92,
  metalness: 0.02,
  side: THREE.DoubleSide
});

const siteEarthMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#241a12'), // Rich landscaping earth
  roughness: 0.95,
  metalness: 0.0,
  side: THREE.DoubleSide
});

// =============================================================================
// 2B. TOWER & PENTHOUSE MULTI-FLOOR INTERIOR NIGHT RADIANCE
// =============================================================================
const towerInteriorLights = [];

// Penthouse Suite Warm Illumination Points (3000K Warm Neutral Architectural Light)
const interiorGlow = new THREE.PointLight('#fff2e4', 0, 36);
interiorGlow.position.set(1.5, 36.8, -8.0);
buildingGroup.add(interiorGlow);
towerInteriorLights.push(interiorGlow);

const ptLightMaster = new THREE.PointLight('#fff2e4', 0, 30);
ptLightMaster.position.set(6.8, 36.8, -10.5);
buildingGroup.add(ptLightMaster);
towerInteriorLights.push(ptLightMaster);

const ptLightKitchen = new THREE.PointLight('#fff5eb', 0, 26);
ptLightKitchen.position.set(-0.6, 36.8, -11.8);
buildingGroup.add(ptLightKitchen);
towerInteriorLights.push(ptLightKitchen);

const ptLightTerrace = new THREE.PointLight('#ffeedd', 0, 22);
ptLightTerrace.position.set(2.5, 37.0, -13.5);
buildingGroup.add(ptLightTerrace);
towerInteriorLights.push(ptLightTerrace);

// Multi-Tier Building Core Radiance (Floors 2, 5, 8)
[10, 19, 28].forEach((elev) => {
  const coreLight = new THREE.PointLight('#ffad52', 0, 48);
  coreLight.position.set(0, elev, 0);
  buildingGroup.add(coreLight);
  towerInteriorLights.push(coreLight);
});

// Street Ground Entrance & Driveway Warm Accent
const groundPool1 = new THREE.PointLight('#ffba66', 0, 32);
groundPool1.position.set(18, 4.0, 22);
buildingGroup.add(groundPool1);
towerInteriorLights.push(groundPool1);

const groundPool2 = new THREE.PointLight('#ffba66', 0, 32);
groundPool2.position.set(-18, 4.0, 22);
buildingGroup.add(groundPool2);
towerInteriorLights.push(groundPool2);

// =============================================================================
// 2C. REALISTIC ATMOSPHERIC SKY & ILLUMINATED SURROUNDING CITY DISTRICT
// =============================================================================
let currentLightingMode = 'sunset';

function setupAtmosphericSky() {
  sky = new Sky();
  sky.scale.setScalar(3500);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 8.5;
  skyUniforms['rayleigh'].value = 3.6;
  skyUniforms['mieCoefficient'].value = 0.008;
  skyUniforms['mieDirectionalG'].value = 0.82;

  const elevation = 10.5;
  const azimuth = 64;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunVector.setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunVector);

  sunLight.position.copy(sunVector).multiplyScalar(130);
  sunLight.color.setRGB(1.0, 0.54, 0.26);
  sunLight.intensity = 1.8;

  ambientLight.color.setRGB(0.98, 0.70, 0.54);
  ambientLight.intensity = 0.25;

  hemiLight.intensity = 0.38;
  interiorGlow.intensity = 32;

  scene.fog.color.setRGB(82/255, 50/255, 66/255);
  scene.fog.density = 0.0012;

  towerInteriorLights.forEach((lt) => {
    lt.intensity = 20;
  });

  renderer.toneMappingExposure = 1.0;
}

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

function updateEnvironmentMap() {
  if (!sky) return;
  const envScene = new THREE.Scene();
  const skyClone = new Sky();
  skyClone.scale.setScalar(3500);
  skyClone.material.uniforms['turbidity'].value = sky.material.uniforms['turbidity'].value;
  skyClone.material.uniforms['rayleigh'].value = sky.material.uniforms['rayleigh'].value;
  skyClone.material.uniforms['mieCoefficient'].value = sky.material.uniforms['mieCoefficient'].value;
  skyClone.material.uniforms['mieDirectionalG'].value = sky.material.uniforms['mieDirectionalG'].value;
  skyClone.material.uniforms['sunPosition'].value.copy(sunVector);
  envScene.add(skyClone);

  const bounceColor = currentLightingMode === 'day' ? '#263328' : (currentLightingMode === 'sunset' ? '#32181a' : '#080d16');
  const bounceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3500, 3500),
    new THREE.MeshBasicMaterial({ color: bounceColor })
  );
  bounceMesh.rotation.x = -Math.PI / 2;
  bounceMesh.position.y = -10;
  envScene.add(bounceMesh);

  const renderTarget = pmremGenerator.fromScene(envScene);
  scene.environment = renderTarget.texture;
  scene.environmentIntensity = 0.45;
}

setupAtmosphericSky();
updateEnvironmentMap();

// Procedural Realistic Architectural Facade Grid Generator for Surrounding Skyline
function createCityFacadeTextures() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const eCanvas = document.createElement('canvas');
  eCanvas.width = 512;
  eCanvas.height = 512;
  const eCtx = eCanvas.getContext('2d');

  ctx.fillStyle = '#222934';
  ctx.fillRect(0, 0, 512, 512);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 512, 512);

  // 10 floors x 8 window bays per texture tile (scaled realistically to building dimensions)
  const rows = 10;
  const cols = 8;
  const padX = 6;
  const padY = 8;
  const w = (512 / cols) - padX;
  const h = (512 / rows) - padY;

  let seed = 42;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * (w + padX) + padX / 2;
      const y = r * (h + padY) + padY / 2;
      const rn = rand();

      // Tinted reflective curtain wall glass
      ctx.fillStyle = rn > 0.5 ? '#2d4054' : '#384d64';
      ctx.fillRect(x, y, w, h);

      // Night lighting: tasteful scattered occupied suites (~28%)
      if (rn > 0.72) {
        if (rn > 0.88) {
          eCtx.fillStyle = '#ffe29e'; // warm amber incandescent
        } else if (rn > 0.78) {
          eCtx.fillStyle = '#ffd175'; // soft gold
        } else {
          eCtx.fillStyle = '#e2efff'; // clean 4000K neutral
        }
        eCtx.fillRect(x + 1, y + 1, w - 2, h - 2);
      }
    }
  }

  const diffuseTex = new THREE.CanvasTexture(canvas);
  diffuseTex.colorSpace = THREE.SRGBColorSpace;
  diffuseTex.wrapS = diffuseTex.wrapT = THREE.RepeatWrapping;
  diffuseTex.repeat.set(1, 1);

  const emissiveTex = new THREE.CanvasTexture(eCanvas);
  emissiveTex.wrapS = emissiveTex.wrapT = THREE.RepeatWrapping;
  emissiveTex.repeat.set(1, 1);

  return { diffuseTex, emissiveTex };
}

const { diffuseTex: cityWinDiff, emissiveTex: cityWinEmiss } = createCityFacadeTextures();

// Matte architectural roof slab (eliminates TV-static glowing roofs)
const cityRoofMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#505560'),
  roughness: 0.85,
  metalness: 0.08,
  side: THREE.FrontSide
});

const cityGlassTowerMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#41586e'),
  map: cityWinDiff,
  roughness: 0.16,
  metalness: 0.75,
  emissive: new THREE.Color('#ffffff'),
  emissiveMap: cityWinEmiss,
  emissiveIntensity: 0.35,
  envMapIntensity: 0.95
});

const cityLimestoneTowerMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#8e877c'),
  map: cityWinDiff,
  roughness: 0.52,
  metalness: 0.04,
  emissive: new THREE.Color('#ffffff'),
  emissiveMap: cityWinEmiss,
  emissiveIntensity: 0.30,
  envMapIntensity: 0.40
});

const streetLampLensMat = new THREE.MeshBasicMaterial({
  color: '#ffe5a0',
  transparent: true,
  opacity: 0.75
});

const rooftopBeaconMat = new THREE.MeshBasicMaterial({
  color: '#ff2222',
  transparent: true,
  opacity: 0.0
});

// Comprehensive City District with Instanced Skyline, Road Network, Crosswalks & Landscaping
function createCityEnvironment() {
  const cityGroup = new THREE.Group();

  // 1. Base Infinite Metropolitan Ground Plane
  const groundGeo = new THREE.PlaneGeometry(1600, 1600);
  const groundMat = new THREE.MeshStandardMaterial({
    color: '#22252b',
    roughness: 0.90,
    metalness: 0.06
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.08;
  groundMesh.receiveShadow = true;
  cityGroup.add(groundMesh);

  // 2. Central Building Podium Plaza
  const plazaGeo = new THREE.PlaneGeometry(110, 110);
  const plazaMat = new THREE.MeshStandardMaterial({
    map: plazaPaverTex,
    roughness: 0.58,
    metalness: 0.04
  });
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(0, 0.01, 0);
  plazaMesh.receiveShadow = true;
  cityGroup.add(plazaMesh);

  // Plaza Curb Frame
  const curbGeo = new THREE.BoxGeometry(112, 0.18, 112);
  const curbMat = new THREE.MeshStandardMaterial({ color: '#423f39', roughness: 0.65 });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.position.set(0, 0.08, 0);
  curbMesh.castShadow = true;
  curbMesh.receiveShadow = true;
  cityGroup.add(curbMesh);

  // 3. Four Major Metropolitan 4-Lane Boulevards Surrounding the Site
  const roadMat = new THREE.MeshStandardMaterial({ color: '#2a2c32', roughness: 0.84 });
  const roadMarkYellowMat = new THREE.MeshStandardMaterial({ color: '#d4a13e', roughness: 0.65, metalness: 0.02 });
  const roadMarkWhiteMat = new THREE.MeshStandardMaterial({ color: '#dedbd3', roughness: 0.65, metalness: 0.02 });

  const avenues = [
    { x: 0, z: -60, w: 1400, d: 20, isEW: true },  // North Avenue
    { x: 0, z: 60,  w: 1400, d: 20, isEW: true },  // South Avenue
    { x: -60, z: 0, w: 20, d: 1400, isEW: false }, // West Boulevard
    { x: 60,  z: 0, w: 20, d: 1400, isEW: false }  // East Boulevard
  ];

  avenues.forEach((road) => {
    const rGeo = new THREE.PlaneGeometry(road.w, road.d);
    const rMesh = new THREE.Mesh(rGeo, roadMat);
    rMesh.rotation.x = -Math.PI / 2;
    rMesh.position.set(road.x, 0.02, road.z);
    cityGroup.add(rMesh);

    // Continuous Double Yellow Center Line
    const yGeo = road.isEW ? new THREE.PlaneGeometry(road.w, 0.28) : new THREE.PlaneGeometry(0.28, road.d);
    const yMesh = new THREE.Mesh(yGeo, roadMarkYellowMat);
    yMesh.rotation.x = -Math.PI / 2;
    yMesh.position.set(road.x, 0.025, road.z);
    cityGroup.add(yMesh);

    // Dashed White Lane Lines (Inner and Outer Lanes)
    [-5.0, 5.0].forEach((offset) => {
      const wGeo = road.isEW ? new THREE.PlaneGeometry(road.w, 0.18) : new THREE.PlaneGeometry(0.18, road.d);
      const wMesh = new THREE.Mesh(wGeo, roadMarkWhiteMat);
      wMesh.rotation.x = -Math.PI / 2;
      if (road.isEW) {
        wMesh.position.set(road.x, 0.025, road.z + offset);
      } else {
        wMesh.position.set(road.x + offset, 0.025, road.z);
      }
      cityGroup.add(wMesh);
    });
  });

  // Pedestrian Crosswalk Zebra Stripes at Major Intersections
  const crosswalkPositions = [
    { x: -60, z: -48, isEW: true },
    { x: -60, z: 48,  isEW: true },
    { x: 60,  z: -48, isEW: true },
    { x: 60,  z: 48,  isEW: true },
    { x: -48, z: -60, isEW: false },
    { x: 48,  z: -60, isEW: false },
    { x: -48, z: 60,  isEW: false },
    { x: 48,  z: 60,  isEW: false }
  ];

  crosswalkPositions.forEach((cw) => {
    for (let s = -7; s <= 7; s += 1.4) {
      const stripeGeo = cw.isEW ? new THREE.PlaneGeometry(3.6, 0.65) : new THREE.PlaneGeometry(0.65, 3.6);
      const stripeMesh = new THREE.Mesh(stripeGeo, roadMarkWhiteMat);
      stripeMesh.rotation.x = -Math.PI / 2;
      if (cw.isEW) {
        stripeMesh.position.set(cw.x + s, 0.028, cw.z);
      } else {
        stripeMesh.position.set(cw.x, 0.028, cw.z + s);
      }
      cityGroup.add(stripeMesh);
    }
  });

  // Sidewalks Framing Boulevards
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#6e727a', roughness: 0.70 });
  const sidewalks = [
    { x: 0, z: -72, w: 1400, d: 4 },
    { x: 0, z: -48, w: 1400, d: 4 },
    { x: 0, z: 48,  w: 1400, d: 4 },
    { x: 0, z: 72,  w: 1400, d: 4 },
    { x: -72, z: 0, w: 4, d: 1400 },
    { x: -48, z: 0, w: 4, d: 1400 },
    { x: 48,  z: 0, w: 4, d: 1400 },
    { x: 72,  z: 0, w: 4, d: 1400 }
  ];

  sidewalks.forEach((sw) => {
    const swGeo = new THREE.BoxGeometry(sw.w, 0.16, sw.d);
    const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
    swMesh.position.set(sw.x, 0.08, sw.z);
    cityGroup.add(swMesh);
  });

  // Landscaped Green Verges & City Parks in Adjacent Blocks
  const parkMat = new THREE.MeshStandardMaterial({ color: '#223825', roughness: 0.94 });
  const parks = [
    { x: -140, z: -140, s: 75 },
    { x: 140,  z: -140, s: 75 },
    { x: -140, z: 140,  s: 75 },
    { x: 140,  z: 140,  s: 75 }
  ];

  parks.forEach((p) => {
    const pGeo = new THREE.PlaneGeometry(p.s, p.s);
    const pMesh = new THREE.Mesh(pGeo, parkMat);
    pMesh.rotation.x = -Math.PI / 2;
    pMesh.position.set(p.x, 0.03, p.z);
    cityGroup.add(pMesh);
  });

  // 4. Procedural Instanced City Skyline (52 Surrounding Skyscrapers & Mid-Rises)
  const cityBuildings = [
    // BLOCK 1: NORTH-EAST
    { x: 95, z: -95, w: 32, d: 28, h: 85, type: 'glass' },
    { x: 145, z: -90, w: 36, d: 32, h: 110, type: 'limestone', beacon: true },
    { x: 195, z: -95, w: 28, d: 28, h: 70, type: 'glass' },
    { x: 90, z: -145, w: 30, d: 34, h: 95, type: 'limestone' },
    { x: 150, z: -155, w: 42, d: 36, h: 135, type: 'glass', beacon: true },
    { x: 200, z: -150, w: 32, d: 30, h: 65, type: 'limestone' },
    { x: 110, z: -205, w: 34, d: 28, h: 75, type: 'glass' },
    { x: 165, z: -210, w: 38, d: 34, h: 90, type: 'limestone' },

    // BLOCK 2: NORTH
    { x: -35, z: -105, w: 34, d: 26, h: 60, type: 'limestone' },
    { x: 25, z: -105, w: 32, d: 28, h: 75, type: 'glass' },
    { x: -38, z: -165, w: 36, d: 32, h: 115, type: 'glass', beacon: true },
    { x: 30, z: -160, w: 38, d: 30, h: 98, type: 'limestone' },
    { x: -20, z: -225, w: 44, d: 34, h: 80, type: 'limestone' },
    { x: 35, z: -220, w: 30, d: 32, h: 65, type: 'glass' },

    // BLOCK 3: NORTH-WEST
    { x: -95, z: -95, w: 30, d: 32, h: 78, type: 'glass' },
    { x: -150, z: -90, w: 35, d: 35, h: 105, type: 'limestone', beacon: true },
    { x: -200, z: -95, w: 28, d: 26, h: 65, type: 'glass' },
    { x: -95, z: -150, w: 34, d: 30, h: 92, type: 'limestone' },
    { x: -155, z: -155, w: 40, d: 38, h: 128, type: 'glass', beacon: true },
    { x: -205, z: -150, w: 30, d: 32, h: 72, type: 'limestone' },
    { x: -115, z: -210, w: 32, d: 28, h: 68, type: 'glass' },
    { x: -170, z: -215, w: 36, d: 32, h: 84, type: 'limestone' },

    // BLOCK 4: WEST
    { x: -105, z: -30, w: 28, d: 36, h: 70, type: 'limestone' },
    { x: -105, z: 28, w: 32, d: 34, h: 85, type: 'glass' },
    { x: -165, z: -35, w: 38, d: 38, h: 122, type: 'glass', beacon: true },
    { x: -165, z: 30, w: 34, d: 36, h: 100, type: 'limestone' },
    { x: -225, z: -20, w: 32, d: 34, h: 76, type: 'limestone' },
    { x: -225, z: 35, w: 30, d: 30, h: 60, type: 'glass' },

    // BLOCK 5: SOUTH-WEST
    { x: -95, z: 95, w: 30, d: 28, h: 82, type: 'glass' },
    { x: -145, z: 90, w: 36, d: 34, h: 112, type: 'limestone', beacon: true },
    { x: -195, z: 95, w: 26, d: 28, h: 68, type: 'glass' },
    { x: -90, z: 150, w: 32, d: 32, h: 90, type: 'limestone' },
    { x: -150, z: 155, w: 40, d: 36, h: 130, type: 'glass', beacon: true },
    { x: -200, z: 150, w: 32, d: 30, h: 70, type: 'limestone' },
    { x: -105, z: 210, w: 30, d: 32, h: 74, type: 'glass' },
    { x: -165, z: 210, w: 36, d: 32, h: 88, type: 'limestone' },

    // BLOCK 6: SOUTH
    { x: -30, z: 105, w: 32, d: 28, h: 65, type: 'limestone' },
    { x: 30, z: 105, w: 30, d: 30, h: 80, type: 'glass' },
    { x: -35, z: 165, w: 38, d: 34, h: 118, type: 'glass', beacon: true },
    { x: 32, z: 160, w: 36, d: 32, h: 95, type: 'limestone' },
    { x: -25, z: 225, w: 42, d: 30, h: 75, type: 'limestone' },
    { x: 35, z: 220, w: 30, d: 32, h: 62, type: 'glass' },

    // BLOCK 7: SOUTH-EAST
    { x: 95, z: 95, w: 32, d: 30, h: 80, type: 'glass' },
    { x: 150, z: 90, w: 38, d: 34, h: 108, type: 'limestone', beacon: true },
    { x: 200, z: 95, w: 28, d: 28, h: 66, type: 'glass' },
    { x: 95, z: 150, w: 30, d: 32, h: 88, type: 'limestone' },
    { x: 155, z: 155, w: 42, d: 38, h: 132, type: 'glass', beacon: true },
    { x: 205, z: 150, w: 32, d: 30, h: 72, type: 'limestone' },
    { x: 110, z: 210, w: 32, d: 30, h: 70, type: 'glass' },
    { x: 170, z: 215, w: 36, d: 34, h: 86, type: 'limestone' },

    // BLOCK 8: EAST
    { x: 105, z: -30, w: 30, d: 34, h: 72, type: 'limestone' },
    { x: 105, z: 30, w: 32, d: 32, h: 88, type: 'glass' },
    { x: 165, z: -32, w: 36, d: 36, h: 120, type: 'glass', beacon: true },
    { x: 165, z: 32, w: 36, d: 34, h: 96, type: 'limestone' },
    { x: 225, z: -20, w: 32, d: 30, h: 78, type: 'limestone' },
    { x: 225, z: 35, w: 30, d: 32, h: 64, type: 'glass' }
  ];

  const glassTowers = cityBuildings.filter(b => b.type === 'glass');
  const limestoneTowers = cityBuildings.filter(b => b.type === 'limestone');

  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();

  // Glass Towers Instanced Mesh (Multi-material: walls get facade texture, roof gets matte gravel)
  const glassTowerMaterials = [cityGlassTowerMat, cityGlassTowerMat, cityRoofMat, cityRoofMat, cityGlassTowerMat, cityGlassTowerMat];
  const glassInstanced = new THREE.InstancedMesh(unitBoxGeo, glassTowerMaterials, glassTowers.length);
  glassTowers.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    glassInstanced.setMatrixAt(i, dummy.matrix);

    if (b.beacon) {
      const beaconMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), rooftopBeaconMat);
      beaconMesh.position.set(b.x, b.h + 0.5, b.z);
      cityGroup.add(beaconMesh);
    }
  });
  glassInstanced.instanceMatrix.needsUpdate = true;
  glassInstanced.castShadow = false;
  glassInstanced.receiveShadow = true;
  cityGroup.add(glassInstanced);

  // Limestone Towers Instanced Mesh (Multi-material: walls get stone facade texture, roof gets matte gravel)
  const limestoneTowerMaterials = [cityLimestoneTowerMat, cityLimestoneTowerMat, cityRoofMat, cityRoofMat, cityLimestoneTowerMat, cityLimestoneTowerMat];
  const limestoneInstanced = new THREE.InstancedMesh(unitBoxGeo, limestoneTowerMaterials, limestoneTowers.length);
  limestoneTowers.forEach((b, i) => {
    dummy.position.set(b.x, b.h / 2, b.z);
    dummy.scale.set(b.w, b.h, b.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    limestoneInstanced.setMatrixAt(i, dummy.matrix);

    if (b.beacon) {
      const beaconMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), rooftopBeaconMat);
      beaconMesh.position.set(b.x, b.h + 0.5, b.z);
      cityGroup.add(beaconMesh);
    }
  });
  limestoneInstanced.instanceMatrix.needsUpdate = true;
  limestoneInstanced.castShadow = false;
  limestoneInstanced.receiveShadow = true;
  cityGroup.add(limestoneInstanced);

  // 5. Instanced Street Trees along Sidewalks
  const treeTrunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 3.2, 8);
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#3d3328', roughness: 0.88 });
  const treeCanopyGeo = new THREE.IcosahedronGeometry(2.2, 2);
  const treeCanopyMat = new THREE.MeshStandardMaterial({ color: '#2e4a2a', roughness: 0.75, flatShading: false });

  const treePositions = [];
  [-48, 48].forEach((x) => {
    for (let z = -140; z <= 140; z += 24) {
      if (Math.abs(z) > 18) treePositions.push({ x: x + (x > 0 ? 2 : -2), z });
    }
  });
  [-48, 48].forEach((z) => {
    for (let x = -140; x <= 140; x += 24) {
      if (Math.abs(x) > 18) treePositions.push({ x, z: z + (z > 0 ? 2 : -2) });
    }
  });

  const trunkInstanced = new THREE.InstancedMesh(treeTrunkGeo, treeTrunkMat, treePositions.length);
  const canopyInstanced = new THREE.InstancedMesh(treeCanopyGeo, treeCanopyMat, treePositions.length);

  treePositions.forEach((pos, i) => {
    dummy.position.set(pos.x, 1.6, pos.z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunkInstanced.setMatrixAt(i, dummy.matrix);

    dummy.position.set(pos.x, 4.4, pos.z);
    dummy.scale.set(1, 1.15, 1);
    dummy.updateMatrix();
    canopyInstanced.setMatrixAt(i, dummy.matrix);
  });
  trunkInstanced.instanceMatrix.needsUpdate = true;
  canopyInstanced.instanceMatrix.needsUpdate = true;
  cityGroup.add(trunkInstanced);
  cityGroup.add(canopyInstanced);

  // 6. Instanced Modern Street Lamp Posts with Glowing Lenses
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.8, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#16191f', roughness: 0.4, metalness: 0.8 });
  const lampLensGeo = new THREE.BoxGeometry(0.65, 0.16, 0.4);

  const lampPositions = [];
  [-51, 51].forEach((x) => {
    for (let z = -120; z <= 120; z += 38) {
      if (Math.abs(z) > 20) lampPositions.push({ x, z, rotY: x > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  });
  [-51, 51].forEach((z) => {
    for (let x = -120; x <= 120; x += 38) {
      if (Math.abs(x) > 20) lampPositions.push({ x, z, rotY: z > 0 ? Math.PI : 0 });
    }
  });

  const lampPoleInstanced = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampPositions.length);
  const lampLensInstanced = new THREE.InstancedMesh(lampLensGeo, streetLampLensMat, lampPositions.length);

  lampPositions.forEach((pos, i) => {
    dummy.position.set(pos.x, 3.4, pos.z);
    dummy.rotation.set(0, pos.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoleInstanced.setMatrixAt(i, dummy.matrix);

    dummy.position.set(pos.x, 6.8, pos.z);
    dummy.updateMatrix();
    lampLensInstanced.setMatrixAt(i, dummy.matrix);
  });
  lampPoleInstanced.instanceMatrix.needsUpdate = true;
  lampLensInstanced.instanceMatrix.needsUpdate = true;
  cityGroup.add(lampPoleInstanced);
  cityGroup.add(lampLensInstanced);

  scene.add(cityGroup);
}

createCityEnvironment();

// Procedural 3D Soft Cloud Layer (Rich multi-tier cloudscape: 68 volumetric puffs across 3 altitude decks)
let cloudGroup = null;
const clouds = [];

function createCloudLayer() {
  cloudGroup = new THREE.Group();

  const cCanvas = document.createElement('canvas');
  cCanvas.width = 128;
  cCanvas.height = 128;
  const ctx = cCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.35, 'rgba(242, 248, 255, 0.65)');
  grad.addColorStop(0.68, 'rgba(222, 236, 252, 0.22)');
  grad.addColorStop(1, 'rgba(210, 230, 250, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(cCanvas);
  const cloudMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  const cloudConfigs = [
    { count: 22, minY: 180, maxY: 260, minR: 160, maxR: 380, minS: 85, maxS: 160 },
    { count: 16, minY: 220, maxY: 320, minR: 200, maxR: 440, minS: 110, maxS: 200 }
  ];

  cloudConfigs.forEach((cfg) => {
    for (let i = 0; i < cfg.count; i++) {
      const sprite = new THREE.Sprite(cloudMat.clone());
      const angle = (i / cfg.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
      const r = cfg.minR + Math.random() * (cfg.maxR - cfg.minR);
      const x = Math.cos(angle) * r;
      const y = cfg.minY + Math.random() * (cfg.maxY - cfg.minY);
      const z = Math.sin(angle) * r;
      sprite.position.set(x, y, z);
      const s = cfg.minS + Math.random() * (cfg.maxS - cfg.minS);
      sprite.scale.set(s, s * 0.62, 1);
      sprite.userData = {
        baseAngle: angle,
        radius: r,
        baseY: y,
        driftSpeed: 0.00018 + Math.random() * 0.00028
      };
      cloudGroup.add(sprite);
      clouds.push(sprite);
    }
  });

  scene.add(cloudGroup);
}

createCloudLayer();

// =============================================================================
// 2D. DYNAMIC ATMOSPHERIC LIGHTING PRESETS (DAY // SUNSET // NIGHT)
// =============================================================================
// currentLightingMode already declared above

function setLightingMode(mode) {
  currentLightingMode = mode;
  const duration = 1.4;
  const ease = 'power2.inOut';

  if (!sky) return;
  const skyUniforms = sky.material.uniforms;

  if (mode === 'day') {
    const phi = THREE.MathUtils.degToRad(90 - 38);
    const theta = THREE.MathUtils.degToRad(52);
    sunVector.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunVector);
    skyUniforms['turbidity'].value = 3.2;
    skyUniforms['rayleigh'].value = 1.25;
    skyUniforms['mieCoefficient'].value = 0.003;
    skyUniforms['mieDirectionalG'].value = 0.82;

    gsap.to(scene.fog.color, { r: 210/255, g: 227/255, b: 245/255, duration, ease });
    scene.fog.density = 0.00065;

    gsap.to(sunLight.color, { r: 1.0, g: 0.965, b: 0.91, duration, ease });
    gsap.to(sunLight, { intensity: 1.30, duration, ease });
    sunLight.position.copy(sunVector).multiplyScalar(130);

    gsap.to(ambientLight, { intensity: 0.28, duration, ease });
    gsap.to(ambientLight.color, { r: 229/255, g: 237/255, b: 250/255, duration, ease });
    gsap.to(hemiLight, { intensity: 0.45, duration, ease });
    gsap.to(interiorGlow, { intensity: isWalkthroughMode ? 15 : 0, duration, ease });

    // Surrounding skyline windows unlit in crisp daylight
    gsap.to(cityGlassTowerMat, { emissiveIntensity: 0.0, duration, ease });
    gsap.to(cityLimestoneTowerMat, { emissiveIntensity: 0.0, duration, ease });
    gsap.to(streetLampLensMat, { opacity: 0.15, duration, ease });

    // Interior lights off in bright sun
    towerInteriorLights.forEach((lt) => {
      gsap.to(lt, { intensity: 0, duration, ease });
    });

    renderer.toneMappingExposure = 0.96;

  } else if (mode === 'sunset') {
    const phi = THREE.MathUtils.degToRad(90 - 10.5);
    const theta = THREE.MathUtils.degToRad(64);
    sunVector.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunVector);
    skyUniforms['turbidity'].value = 8.5;
    skyUniforms['rayleigh'].value = 3.6;
    skyUniforms['mieCoefficient'].value = 0.008;

    gsap.to(scene.fog.color, { r: 82/255, g: 50/255, b: 66/255, duration, ease });
    scene.fog.density = 0.0012;

    gsap.to(sunLight.color, { r: 1.0, g: 0.54, b: 0.26, duration, ease });
    gsap.to(sunLight, { intensity: 1.8, duration, ease });
    sunLight.position.copy(sunVector).multiplyScalar(130);

    gsap.to(ambientLight, { intensity: 0.28, duration, ease });
    gsap.to(ambientLight.color, { r: 0.94, g: 0.88, b: 0.82, duration, ease });
    gsap.to(hemiLight, { intensity: 0.38, duration, ease });
    gsap.to(interiorGlow, { intensity: 6, duration, ease });

    // Windows start warming up as evening falls
    gsap.to(cityGlassTowerMat, { emissiveIntensity: 0.35, duration, ease });
    gsap.to(cityLimestoneTowerMat, { emissiveIntensity: 0.30, duration, ease });
    gsap.to(streetLampLensMat, { opacity: 0.75, duration, ease });

    // Tower interior warm glow
    towerInteriorLights.forEach((lt) => {
      gsap.to(lt, { intensity: 6, duration, ease });
    });

    renderer.toneMappingExposure = 1.0;

  } else if (mode === 'night') {
    const phi = THREE.MathUtils.degToRad(90 - (-12));
    const theta = THREE.MathUtils.degToRad(65);
    sunVector.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunVector);
    skyUniforms['turbidity'].value = 12.0;
    skyUniforms['rayleigh'].value = 0.35;
    skyUniforms['mieCoefficient'].value = 0.001;

    gsap.to(scene.fog.color, { r: 10/255, g: 14/255, b: 24/255, duration, ease });
    scene.fog.density = 0.0014;

    gsap.to(sunLight.color, { r: 0.28, g: 0.42, b: 0.68, duration, ease });
    gsap.to(sunLight, { intensity: 0.35, duration, ease });

    gsap.to(ambientLight, { intensity: 0.22, duration, ease });
    gsap.to(ambientLight.color, { r: 0.26, g: 0.36, b: 0.58, duration, ease });
    gsap.to(hemiLight, { intensity: 0.28, duration, ease });
    gsap.to(interiorGlow, { intensity: 75, duration, ease });

    // Night metropolis skyline illumination (tasteful, high-end archviz glow)
    gsap.to(cityGlassTowerMat, { emissiveIntensity: 0.95, duration, ease });
    gsap.to(cityLimestoneTowerMat, { emissiveIntensity: 0.85, duration, ease });
    gsap.to(streetLampLensMat, { opacity: 1.0, duration, ease });

    // Vibrant interior radiance across tower floors and penthouse
    towerInteriorLights.forEach((lt) => {
      gsap.to(lt, { intensity: 55, duration, ease });
    });

    renderer.toneMappingExposure = 1.02;
  }

  renderer.shadowMap.needsUpdate = true;
  setTimeout(() => { renderer.shadowMap.needsUpdate = true; }, 300);
  setTimeout(() => { renderer.shadowMap.needsUpdate = true; }, duration * 1000);
  setTimeout(updateEnvironmentMap, 150);
  setTimeout(updateEnvironmentMap, duration * 1000);
}

window.setLightingMode = setLightingMode;

// =============================================================================
// 3. GLTF LOADER & LUXURY MATERIAL ASSIGNMENT PIPELINE
// =============================================================================
const loaderOverlay = document.getElementById('loader-overlay');
const loaderProgress = document.getElementById('loader-progress');
const loaderStatusText = document.getElementById('loader-status-text');
const loaderPercentage = document.getElementById('loader-percentage');

const gltfLoader = new GLTFLoader();

let buildingLoaded = 0;
let topFloorLoaded = 0;
const totalExpected = 48206288;

function updateProgress() {
  const total = buildingLoaded + topFloorLoaded;
  const pct = Math.min(Math.round((total / totalExpected) * 100), 99);
  loaderProgress.style.width = `${pct}%`;
  loaderPercentage.textContent = `${pct}%`;
}

function getFullHierarchyName(mesh) {
  let combined = (mesh.name || '') + ' ';
  let curr = mesh.parent;
  while (curr && curr !== scene && curr !== buildingGroup) {
    const nm = (curr.name || '').toLowerCase();
    // Do NOT include top-level GLTF root scene names ('exwall', 'scene', 'group')
    if (nm && !nm.startsWith('scene') && !nm.startsWith('group') && nm !== 'exwall') {
      combined += curr.name + ' ';
    }
    curr = curr.parent;
  }
  return combined.toLowerCase();
}

function applyLuxuryMaterial(mat, fullName, isInterior) {
  const matName = (mat.name || '').toLowerCase();
  const hierarchy = fullName.toLowerCase();

  // 1. Driveway Vehicles (Ford Raptor, wheels, tires, lights, badges)
  if (hierarchy.includes('raptor') || hierarchy.includes('car') || matName.includes('material car') || matName.includes('bimshares')) {
    if (matName.includes('caucho')) return carTireMat;
    if (matName.includes('lanterna')) return carTaillightMat;
    if (matName.includes('steel')) return carWheelMat;
    if (matName.includes('preto')) return carTrimMat;
    return carPaintMat;
  }

  // 2. Site Roads, Boulevards, Asphalt, Gravel, Earth
  if (matName.includes('asphalt') || hierarchy.includes('asphalt') || hierarchy.includes('path')) {
    return siteAsphaltMat;
  }
  if (matName.includes('gravel')) return siteGravelMat;
  if (matName.includes('earth') || hierarchy.includes('earth')) return siteEarthMat;

  // 3. Plants & Landscaping (Foliage, potting soil, concrete planters)
  if (
    matName.includes('vegetacion') ||
    matName.includes('vegetacao') ||
    matName.includes('verde') ||
    hierarchy.includes('planta') ||
    hierarchy.includes('veget')
  ) {
    if (matName.includes('terra') || matName.includes('tierra')) return soilMat;
    if (matName.includes('concreto') || matName.includes('vaso')) return concretePlanterMat;
    if (matName.includes('madeira')) return woodMahoganyMat;
    return plantLeafMat;
  }
  if (matName.includes('terra') || matName.includes('tierra')) return soilMat;
  if (matName.includes('concreto aparente')) return concretePlanterMat;

  // 4. Curtain Wall Glazing & Window Glass
  if (matName.includes('glass') || matName.includes('vidro') || (matName === 'material001' && hierarchy.includes('window'))) {
    return sharedGlassMaterial;
  }

  // 5. Window Frames, Mullions, Metalwork, Railings, Pergola
  if (
    matName.includes('window frame') ||
    matName.includes('frame') ||
    matName.includes('mullion') ||
    matName.includes('railing') ||
    matName.includes('support') ||
    matName.includes('top rail') ||
    hierarchy.includes('50x50mm') ||
    hierarchy.includes('railing') ||
    hierarchy.includes('window')
  ) {
    return metalFrameMat;
  }

  // 6. Structural Columns & Pillars ([574019]Column_new) - Fluted Charcoal Concrete
  if (hierarchy.includes('column') || hierarchy.includes('pillar') || hierarchy.includes('pilier') || matName.includes('cast-in-place')) {
    return structuralColumnMat;
  }

  // 7. Interior Furniture - Fabrics & Leathers
  if (matName.includes('fabric - green') || matName.includes('vestido textura') || (hierarchy.includes('sofa') && matName.includes('fabric'))) {
    return fabricGreenMat;
  }
  if (matName.includes('leather - tan') || (hierarchy.includes('tchair') && matName.includes('leather'))) {
    return leatherTanMat;
  }
  if (matName.includes('leather') || matName.includes('tecido calça de couro')) {
    return leatherEspressoMat;
  }
  if (matName.includes('fabric - beige') || matName.includes('grey cloth') || matName.includes('furniture material')) {
    return linenBeigeMat;
  }
  if (matName.includes('textile - white') || matName.includes('textile - linen')) {
    return linenWhiteMat;
  }

  // 8. Interior Furniture - Woods (Dining Table, Coffee Tables, Bed Frames, Wardrobes, Desks)
  if (hierarchy.includes('wardrobe') || matName.includes('wood - mahogany') || matName.includes('madeira cabide') || matName.includes('madeira - vaso')) {
    return woodMahoganyMat;
  }
  if (hierarchy.includes('table') || hierarchy.includes('chair') || hierarchy.includes('bed') || matName.includes('wood - birch')) {
    if (matName.includes('laminate - ivory')) return tableSurfaceTaupeMat;
    if (matName.includes('wood - cherry')) return woodCherryMat;
    return woodWalnutMat;
  }
  if (matName.includes('wood - cherry')) return woodCherryMat;

  // 9. Parquet European Oak Hardwood Flooring & Stairs
  if (matName.includes('oak') || (isInterior && (hierarchy.includes('floor') || hierarchy.includes('stair') || hierarchy.includes('step') || hierarchy.includes('landing')))) {
    return interiorWoodFloorMat;
  }

  // 10. Carpets & Luxury Area Rugs
  if (matName.includes('carpet')) return carpetMat;

  // 11. Italian Calacatta Honed Marble (Kitchen Island & Bathroom Counters)
  if (matName.includes('marble') || matName.includes('marmol')) return interiorMarbleMat;

  // 12. Interior Doors, Architraves & Hardware
  if (matName.includes('door - panel') || (hierarchy.includes('door') && matName.includes('panel'))) return doorPanelMat;
  if (matName.includes('door - architrave') || (hierarchy.includes('door') && matName.includes('architrave'))) return doorArchitraveMat;
  if (matName.includes('door - handle') || (hierarchy.includes('door') && matName.includes('handle'))) return doorHandleMat;

  // 13. Metals, Chrome, Titanium Appliances & Art Canvas
  if (matName.includes('chrome') || matName.includes('cromado')) return polishedChromeMat;
  if (matName.includes('stainless') || matName.includes('steel')) return satinSteelMat;
  if (matName.includes('preto') || matName.includes('black plastic')) return matteBlackMat;
  if (matName.includes('metal - paint finish') || hierarchy.includes('cabinet kit') || hierarchy.includes('595x600x1400mm')) {
    return kitchenApplianceMat;
  }
  if (matName.includes('quadro') || matName.includes('branco')) {
    return artworkCanvasMat;
  }

  // 14. Ceramics & Sanitary
  if (matName.includes('porcelain') || matName.includes('china') || matName.includes('kohler')) return ceramicMat;

  // 15. Interior Walls & Plaster (Plaster on both exterior wall interiors and interior partitions)
  if (matName.includes('plaster') || hierarchy.includes('intwall')) {
    return interiorWallMat;
  }

  // 16. Wall Core Framing & Rough Structure
  if (matName === 'default wall') {
    return interiorWallMat;
  }

  // 17. Exterior Facade Cladding Walls - Smooth Honed French Limestone (True exterior facade)
  if (matName === 'brick, common' || matName.includes('brick') || (!isInterior && hierarchy.includes('exwall'))) {
    return facadeLimestoneMat;
  }

  // 18. Exterior Accent Screens & Parapets - Refined Architectural Travertine Panels
  if (!isInterior && (hierarchy.includes('parapet') || hierarchy.includes('screen') || hierarchy.includes('claustra'))) {
    return facadeSpandrelMat;
  }

  // 19. Roof Slab & Penthouse Interior Ceiling (Identical material to interior walls)
  if (hierarchy.includes('566343') || (hierarchy.includes('roof') && hierarchy.includes('floor'))) {
    return interiorWallMat;
  }

  // 20. Precast Architectural Floor Slabs & Balcony Decks
  if (
    matName.includes('precast') ||
    matName.includes('screed') ||
    matName.includes('stairs') ||
    matName.includes('runs') ||
    (!isInterior && (hierarchy.includes('floor') || hierarchy.includes('landing')))
  ) {
    return floorSlabMat;
  }

  // 20. Preserved Fallback: Apply natural PBR roughness and tone down pure white
  mat.side = THREE.FrontSide;
  if (mat.color) {
    if (mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82) {
      mat.color.setRGB(0.72, 0.69, 0.64);
    }
  }
  mat.roughness = Math.max(mat.roughness || 0.45, 0.42);
  mat.metalness = Math.min(mat.metalness || 0.04, 0.2);
  mat.envMapIntensity = 0.25;
  return mat;
}

// Procedural Vertex Normal & Triplanar Box UV Generator for CAD/BIM Meshes
function ensureMeshNormalsAndUVs(mesh, fullName) {
  if (!mesh || !mesh.geometry) return;
  const geo = mesh.geometry;

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }

  const forceRecalcUV =
    fullName.includes('exwall') ||
    fullName.includes('parapet') ||
    fullName.includes('spandrel') ||
    fullName.includes('exterior') ||
    fullName.includes('precast');

  if ((!geo.attributes.uv || forceRecalcUV) && geo.attributes.position) {
    const pos = geo.attributes.position;
    const count = pos.count;
    const uvs = new Float32Array(count * 2);
    // Real-world meter scale: 1 UV unit per 3.0 meters (standard architectural floor height)
    const uvScale = 1.0 / 3.0;

    // Use geometry bounding box to determine single consistent projection plane for entire mesh
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const dx = bb ? (bb.max.x - bb.min.x) : 10;
    const dy = bb ? (bb.max.y - bb.min.y) : 10;
    const dz = bb ? (bb.max.z - bb.min.z) : 10;

    // If Y is smallest dimension, it's a horizontal slab/floor/roof -> map X and Z
    // If X is smallest dimension, it's an East/West wall -> map Z and Y
    // Otherwise, it's a North/South wall -> map X and Y
    const isHorizontal = dy < dx && dy < dz;
    const isEastWest = !isHorizontal && (dx < dz);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      if (isHorizontal) {
        uvs[i * 2] = x * uvScale;
        uvs[i * 2 + 1] = z * uvScale;
      } else if (isEastWest) {
        uvs[i * 2] = z * uvScale;
        uvs[i * 2 + 1] = y * uvScale;
      } else {
        uvs[i * 2] = x * uvScale;
        uvs[i * 2 + 1] = y * uvScale;
      }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
}

function setupMeshProperties(mesh, isInterior = false) {
  mesh.frustumCulled = true;

  const fullName = getFullHierarchyName(mesh);
  const meshName = (mesh.name || '').toLowerCase();
  const parentName = mesh.parent ? (mesh.parent.name || '').toLowerCase() : '';
  const origMatName = (Array.isArray(mesh.material) ? mesh.material[0]?.name : mesh.material?.name || '').toLowerCase();

  // 1. Occlusion Culling for Lower Floors (Floors 0-9):
  // When not in the interior penthouse, hide all fully-enclosed interior partition walls
  if (!isInterior) {
    if (parentName.includes('intwall') || meshName.includes('intwall')) {
      mesh.visible = false;
      return;
    }
    // Hide lower-floor internal stairs & stringers (floors 0-9)
    if (parentName.includes('stair') || parentName.includes('step') || parentName.includes('stringer') || meshName.includes('step')) {
      mesh.visible = false;
      return;
    }
  }

  ensureMeshNormalsAndUVs(mesh, fullName);

  if (!mesh.material) return;

  if (meshName.includes('exwall') || meshName.includes('exterior')) {
    exteriorWalls.push(mesh);
  }

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map(m => applyLuxuryMaterial(m, fullName, isInterior));
  } else {
    mesh.material = applyLuxuryMaterial(mesh.material, fullName, isInterior);
  }

  // Directional shadows only on major exterior structures to maintain 60 FPS
  const isGlass = mesh.material && (mesh.material.transmission > 0.1 || mesh.material.transparent);
  const isExteriorStructure = !isGlass && !isInterior && (
    meshName.includes('exwall') ||
    meshName.includes('floor') ||
    meshName.includes('column') ||
    fullName.includes('exwall') ||
    fullName.includes('column')
  );
  mesh.castShadow = isExteriorStructure;
  mesh.receiveShadow = !isGlass;
}

async function loadAndAssembleModels() {
  try {
    loaderStatusText.textContent = 'Loading Building Structure & Site (41 MB)...';

    const modelBase = (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/';

    // 1. Load Main Building GLB
    const buildingGltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        `${modelBase}models/building.glb`,
        resolve,
        (xhr) => {
          buildingLoaded = xhr.loaded;
          updateProgress();
        },
        reject
      );
    });

    buildingModel = buildingGltf.scene;
    buildingGroup.add(buildingModel);

    // 2. Load Penthouse GLB (Tier 2 - Luxury Furnished Suite)
    loaderStatusText.textContent = 'Loading Furnished Penthouse Suite (7 MB)...';

    const topFloorGltf = await new Promise((resolve, reject) => {
      gltfLoader.load(
        `${modelBase}models/top_floor.glb`,
        resolve,
        (xhr) => {
          topFloorLoaded = xhr.loaded;
          updateProgress();
        },
        reject
      );
    });

    topFloorModel = topFloorGltf.scene;
    topFloorModel.traverse((child) => {
      if (child.isMesh) {
        setupMeshProperties(child, true); // true = Interior penthouse suite
      }
    });

    topFloorModel.position.copy(PENTHOUSE_ALIGNMENT_OFFSET);
    buildingGroup.add(topFloorModel);

    // 3. Separate Roof Cap and hide ONLY the 306 top-floor duplicate nodes
    const topFloorMeshNames = new Set();
    topFloorModel.traverse((child) => {
      if (child.name) topFloorMeshNames.add(child.name);
    });

    loaderStatusText.textContent = 'Configuring Double-Sided Materials & Separating Roof...';

    window.scene = scene;
    window.renderer = renderer;
    window.camera = camera;
    window.controls = controls;
    window.buildingGroup = buildingGroup;
    window.buildingModel = buildingModel;
    window.topFloorModel = topFloorModel;
    window.roofCapGroup = roofCapGroup;

    // 3. Separate Roof Cap (Tier 3) and hide ONLY duplicate Floor 10 nodes (leaving Floors 0 to 9 100% intact!)
    // Capture real BIM node names in top_floor.glb (ignoring Three.js internal 'mesh_X' names!)
    const realTopNames = new Set();
    topFloorModel.traverse((child) => {
      if (child.name && !child.name.startsWith('mesh_')) {
        realTopNames.add(child.name);
      }
    });

    loaderStatusText.textContent = 'Configuring Double-Sided Materials & Assembling Roof...';

    // Reparent roof elements (Tier 3: roof slab, walls, railings, door, pergola) into roofCapGroup
    const ROOF_IDS = ['566343', '567229', '567339', '567670', '567747', '568166', '568725', '568795', '569010'];
    const nodesToReparentToRoof = [];

    buildingModel.children.forEach((child) => {
      const isRoofPart = ROOF_IDS.some((id) => child.name && child.name.includes(id));
      if (isRoofPart) {
        nodesToReparentToRoof.push(child);
      } else if (child.name && child.name.includes('565')) {
        // Hide ALL 90 Floor 10 duplicate interior elements replaced by topFloorModel
        child.visible = false;
      }
    });

    // Move roof elements into roofCapGroup
    nodesToReparentToRoof.forEach((node) => {
      roofCapGroup.attach(node);
    });

    // Configure materials: buildingModel gets FrontSide (backface culling)
    buildingModel.traverse((child) => {
      if (child.isMesh) {
        setupMeshProperties(child, false);
      }
    });

    roofCapGroup.traverse((child) => {
      if (child.isMesh) {
        setupMeshProperties(child, false);
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.side = THREE.DoubleSide);
          } else {
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });

    // 4. Center Scene on the Building Tower Core
    buildingGroup.position.set(19.896, 5.0, -6.5943);

    // Initial camera starts at heroic architectural perspective
    camera.position.set(48, 65, 85);
    controls.target.set(0, 22, 0);
    controls.update();

    loaderStatusText.textContent = 'Ready for Architectural Exploration!';
    loaderProgress.style.width = '100%';
    loaderPercentage.textContent = '100%';

    renderer.shadowMap.needsUpdate = true;
    setTimeout(() => {
      renderer.shadowMap.needsUpdate = true;
      loaderOverlay.classList.add('fade-out');
      initScrollStorytelling();
      setLightingMode('sunset');
    }, 400);

  } catch (error) {
    console.error('Failed to assemble architectural models:', error);
    loaderStatusText.textContent = 'Error loading models. Check console.';
  }
}

loadAndAssembleModels();

// =============================================================================
// 4. 3-TIER GSAP EXPLODED VIEW CONTROLLER
// =============================================================================
const explodeSlider = document.getElementById('explode-slider');
const liftReadout = document.getElementById('lift-readout');
const btnAssemble = document.getElementById('btn-assemble');
const btnExplode = document.getElementById('btn-explode');

const explodeState = { factor: 0 };

function applyExplodeFactor(factor) {
  if (!topFloorModel || !roofCapGroup) return;

  topFloorModel.visible = true;
  renderer.shadowMap.needsUpdate = true;

  const penthouseLift = factor * 0.65;
  topFloorModel.position.set(
    PENTHOUSE_ALIGNMENT_OFFSET.x,
    PENTHOUSE_ALIGNMENT_OFFSET.y + penthouseLift,
    PENTHOUSE_ALIGNMENT_OFFSET.z
  );

  if (isWalkthroughMode) {
    // When inside the interior walkthrough, keep the roof seated firmly over the suite
    roofCapGroup.rotation.set(0, 0, 0);
    roofCapGroup.position.set(0, penthouseLift, 0);
    roofCapGroup.visible = true;
  } else {
    // 90-DEGREE VERTICAL ROTATION ARCHITECTURAL CLEARANCE:
    // Instead of hovering above, the roof terrace rotates 90° vertically (Math.PI / 2)
    // and slides cleanly to the side of the building (X = -26m)!
    // This completely eliminates any obstruction when viewing from above!
    const progress = Math.min(factor / 20, 1.0);
    roofCapGroup.rotation.z = progress * (Math.PI / 2);
    roofCapGroup.position.set(-progress * 26, factor * 0.85, 0);
    roofCapGroup.visible = true;
  }

  if (liftReadout) liftReadout.textContent = `${factor.toFixed(1)} m`;
  if (explodeSlider) explodeSlider.value = factor;

  if (isWalkthroughMode) {
    updateWalkthroughCameraHeight();
  }
}

function setExplodeLift(targetFactor, animate = false) {
  if (animate) {
    gsap.killTweensOf(explodeState);
    gsap.killTweensOf(roofCapGroup.rotation);
    gsap.killTweensOf(roofCapGroup.position);
    gsap.to(explodeState, {
      factor: targetFactor,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => applyExplodeFactor(explodeState.factor)
    });
  } else {
    explodeState.factor = targetFactor;
    applyExplodeFactor(targetFactor);
  }

  if (btnAssemble && btnExplode) {
    if (targetFactor === 0) {
      btnAssemble.classList.add('active');
      btnExplode.classList.remove('active');
    } else {
      btnAssemble.classList.remove('active');
      btnExplode.classList.add('active');
    }
  }
}

if (explodeSlider) {
  explodeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setExplodeLift(val, false);
  });
}

if (btnAssemble) {
  btnAssemble.addEventListener('click', () => {
    goToStage(0);
  });
}

if (btnExplode) {
  btnExplode.addEventListener('click', () => {
    goToStage(1);
  });
}

// =============================================================================
// 4B. 3D SCENE CHOREOGRAPHY & STORYTELLING TIMELINE
// =============================================================================
let scrollTimeline = null;
const scrollChoreo = {
  camX: 48,
  camY: 65,
  camZ: 85,
  targetX: 0,
  targetY: 22,
  targetZ: 0,
  towerRotationY: 0,
  explodeFactor: 0,
  cloudOpacity: 0.0
};

const storyStepBtns = document.querySelectorAll('.story-step-btn');
const cardClouds = document.querySelector('#sec-clouds .story-card');
const cardExplode = document.querySelector('#sec-explode .story-card');
const cardInterior = document.querySelector('#sec-interior .story-card');

function initScrollStorytelling() {
  ScrollTrigger.refresh();

  // Pure 1:1 timeline scrub directly synchronized with Lenis easing (Zero awkward stop-and-snap delays)
  scrollTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: '#scroll-container',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        if (self.direction !== 0) {
          scrollDirection = self.direction;
        }
        handleScrollChoreoUpdate(self.progress);
      }
    }
  });

  // STEP 1: Architectural Approach & Detail Reveal (0.00 -> 0.20)
  scrollTimeline.to(scrollChoreo, {
    camX: 44,
    camY: 54,
    camZ: 72,
    targetX: 0,
    targetY: 24,
    targetZ: 0,
    towerRotationY: 0.0,
    explodeFactor: 0.0,
    cloudOpacity: 0.0,
    duration: 0.20,
    ease: 'power1.inOut'
  });

  // STEP 2: 20° Architectural Tilt & 3-Tier Exploded View (0.20 -> 0.50)
  // Gradual, majestic 20° tilt and 25m floor lift over a wide 0.30 range (slower, unhurried, calm)
  scrollTimeline.to(scrollChoreo, {
    camX: 42,
    camY: 42,
    camZ: 58,
    targetX: 0,
    targetY: 34,
    targetZ: 0,
    towerRotationY: 0.349, // ~20° to the right!
    explodeFactor: 25,     // Full 3-tier exploded view
    cloudOpacity: 0.0,
    duration: 0.30,
    ease: 'power1.inOut'
  });

  // STEP 3: Re-assemble & Straighten Upright (0.50 -> 0.75)
  // Building smoothly re-assembles and straightens upright as camera approaches penthouse terrace
  scrollTimeline.to(scrollChoreo, {
    camX: 25,
    camY: 39,
    camZ: 10,
    targetX: 1.0,
    targetY: 36.6,
    targetZ: -8.0,
    towerRotationY: 0.0,
    explodeFactor: 0,
    cloudOpacity: 0.0,
    duration: 0.25,
    ease: 'power1.inOut'
  });

  // STEP 4: Swoop inside Penthouse Living Salon (0.75 -> 1.00)
  // Camera glides through the terrace directly into the Grand Living Salon!
  scrollTimeline.to(scrollChoreo, {
    camX: 1.0,
    camY: 36.6,
    camZ: -8.2,
    targetX: 2.5,
    targetY: 36.2,
    targetZ: -9.0,
    towerRotationY: 0.0,
    explodeFactor: 0,
    cloudOpacity: 0.0,
    duration: 0.25,
    ease: 'power1.inOut'
  });

  // Story Nav Step Click Handlers
  storyStepBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step, 10);
      goToStage(step);
    });
  });

  // Story Chapters in Sidebar Click Handlers
  const chapterBtns = document.querySelectorAll('.cam-btn[data-chapter]');
  chapterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const chapter = parseInt(btn.dataset.chapter, 10);
      goToStage(chapter);
    });
  });
}

function handleScrollChoreoUpdate(progress) {
  // If user scrolls back up from Section 3, exit walkthrough mode cleanly
  if (isWalkthroughMode && progress < 0.90) {
    exitWalkthroughMode(false);
  }

  if (!isWalkthroughMode) {
    camera.position.set(scrollChoreo.camX, scrollChoreo.camY, scrollChoreo.camZ);
    controls.target.set(scrollChoreo.targetX, scrollChoreo.targetY, scrollChoreo.targetZ);
    controls.update();

    buildingGroup.rotation.y = scrollChoreo.towerRotationY;
    applyExplodeFactor(scrollChoreo.explodeFactor);

    if (topFloorModel) {
      topFloorModel.visible = true;
    }

    // Update cloud visibility & opacity
    if (clouds.length > 0) {
      clouds.forEach((c) => {
        c.material.opacity = scrollChoreo.cloudOpacity * 0.75;
        c.visible = scrollChoreo.cloudOpacity > 0.02;
      });
    }
  }

  // When reached Stage 03 milestone, automatically trigger walkthrough mode in Living Room!
  if (progress >= 0.96 && !isWalkthroughMode) {
    enterWalkthroughMode('flatA_living');
  }

  // Smoothly fade story cards based on the active stage
  if (cardClouds) {
    cardClouds.style.opacity = progress <= 0.32 ? '1' : '0';
    cardClouds.style.pointerEvents = progress <= 0.32 ? 'auto' : 'none';
  }
  if (cardExplode) {
    cardExplode.style.opacity = (progress > 0.32 && progress < 0.68) ? '1' : '0';
    cardExplode.style.pointerEvents = (progress > 0.32 && progress < 0.68) ? 'auto' : 'none';
  }
  if (cardInterior) {
    cardInterior.style.opacity = progress >= 0.68 ? '1' : '0';
    cardInterior.style.pointerEvents = progress >= 0.68 ? 'auto' : 'none';
  }

  // Sync story navigator and sidebar chapter step indicators
  let activeStep = 0;
  if (progress >= 0.70) activeStep = 2;
  else if (progress >= 0.30) activeStep = 1;

  if (!isGliding) {
    currentStage = activeStep;
  }

  storyStepBtns.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activeStep);
  });

  const chapterBtns = document.querySelectorAll('.cam-btn[data-chapter]');
  chapterBtns.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activeStep);
  });
}

// =============================================================================
// 5. BLUE DOOR MARKERS & VIRTUAL WALKTHROUGH TOUR (MATTERPORT / STREET VIEW)
// =============================================================================
const TOUR_NODES = {
  // --- ROOM 1: LIVING LOUNGE & DINING ---
  flatA_living: {
    id: 'flatA_living',
    category: 'penthouse',
    title: 'Penthouse: Grand Living & Dining Salon',
    desc: 'Designer lounge featuring 6-seater dining suite, bespoke sofa, and access to all private quarters.',
    pos: new THREE.Vector3(1.0, 36.6, -8.2),
    target: new THREE.Vector3(2.5, 36.2, -9.0),
    portals: [
      { text: 'Gourmet Kitchen 🍳', doorPos: new THREE.Vector3(0.39, 36.5, -10.56), toNode: 'flatA_kitchen' },
      { text: 'Balcony Terrace 🌅', doorPos: new THREE.Vector3(3.54, 36.5, -11.56), toNode: 'flatA_terrace' },
      { text: 'Master Suite 🛏️', doorPos: new THREE.Vector3(4.51, 36.5, -8.11), toNode: 'flatA_master' },
      { text: 'Guest Bedroom 2 🛌', doorPos: new THREE.Vector3(4.39, 36.5, -5.01), toNode: 'flatA_bed2' },
      { text: 'Study / Bed 3 📚', doorPos: new THREE.Vector3(4.51, 36.5, -6.29), toNode: 'flatA_bed3' },
      { text: 'Family Bathroom 🛁', doorPos: new THREE.Vector3(3.5, 36.5, -5.8), toNode: 'flatA_bath' },
      { text: 'Powder Room 🚽', doorPos: new THREE.Vector3(2.73, 36.5, -5.8), toNode: 'flatA_powder' },
      { text: 'Exit to Lift Lobby 🛗', doorPos: new THREE.Vector3(-1.72, 36.5, -7.64), toNode: 'hallway_core' }
    ]
  },

  // --- ROOM 2: GOURMET KITCHEN ---
  flatA_kitchen: {
    id: 'flatA_kitchen',
    category: 'penthouse',
    title: 'Penthouse: Gourmet Culinary Kitchen',
    desc: 'Integrated modern kitchen with stainless washbasin, cabinetry, preparation counters, and window natural light.',
    pos: new THREE.Vector3(-0.6, 36.6, -11.8),
    target: new THREE.Vector3(-0.66, 36.13, -12.5),
    portals: [
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(0.39, 36.5, -10.56), toNode: 'flatA_living' },
      { text: 'Step onto Balcony 🌅', doorPos: new THREE.Vector3(1.5, 36.5, -13.5), toNode: 'flatA_terrace' }
    ]
  },

  // --- ROOM 3: PANORAMIC BALCONY TERRACE ---
  flatA_terrace: {
    id: 'flatA_terrace',
    category: 'penthouse',
    title: 'Penthouse: Panoramic Balcony Terrace',
    desc: 'Private outdoor balcony with skyline railings, lounge seating, and dual access from the kitchen and salon.',
    pos: new THREE.Vector3(2.5, 36.6, -13.8),
    target: new THREE.Vector3(2.5, 36.2, -18.0),
    portals: [
      { text: 'Enter Living Lounge 🛋️', doorPos: new THREE.Vector3(3.54, 36.5, -11.56), toNode: 'flatA_living' },
      { text: 'Enter Kitchen 🍳', doorPos: new THREE.Vector3(0.5, 36.5, -12.5), toNode: 'flatA_kitchen' }
    ]
  },

  // --- ROOM 4: MASTER BEDROOM SUITE ---
  flatA_master: {
    id: 'flatA_master',
    category: 'penthouse',
    title: 'Penthouse: Master Bedroom Suite',
    desc: 'Executive bedroom featuring king-size designer bed, double wardrobes, vanity console, and private ensuite bath.',
    pos: new THREE.Vector3(6.8, 36.6, -11.0),
    target: new THREE.Vector3(7.8, 36.2, -12.4),
    portals: [
      { text: 'Master Ensuite Bath 🚿', doorPos: new THREE.Vector3(8.36, 36.5, -8.89), toNode: 'flatA_ensuite' },
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(4.51, 36.5, -8.11), toNode: 'flatA_living' }
    ]
  },

  // --- ROOM 5: MASTER ENSUITE BATHROOM ---
  flatA_ensuite: {
    id: 'flatA_ensuite',
    category: 'penthouse',
    title: 'Penthouse: Master Ensuite Bathroom',
    desc: 'Private spa bathroom featuring designer toilet, porcelain washbasin, vanity mirror, and premium fittings.',
    pos: new THREE.Vector3(8.0, 36.6, -7.8),
    target: new THREE.Vector3(8.66, 36.0, -7.4),
    portals: [
      { text: 'Return to Master Suite 🛏️', doorPos: new THREE.Vector3(8.36, 36.5, -8.89), toNode: 'flatA_master' }
    ]
  },

  // --- ROOM 6: GUEST BEDROOM 2 ---
  flatA_bed2: {
    id: 'flatA_bed2',
    category: 'penthouse',
    title: 'Penthouse: Guest Bedroom 2',
    desc: 'East-facing double guest bedroom complete with wardrobe suite, bedside tables, and ample morning light.',
    pos: new THREE.Vector3(6.5, 36.6, -5.2),
    target: new THREE.Vector3(8.01, 36.0, -5.05),
    portals: [
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(4.39, 36.5, -5.01), toNode: 'flatA_living' }
    ]
  },

  // --- ROOM 7: BEDROOM 3 / EXECUTIVE STUDY ---
  flatA_bed3: {
    id: 'flatA_bed3',
    category: 'penthouse',
    title: 'Penthouse: Executive Study / Bedroom 3',
    desc: 'Private quiet room featuring daytime study setup, daybed, custom storage, and garden-view window.',
    pos: new THREE.Vector3(0.0, 36.6, -5.0),
    target: new THREE.Vector3(-0.79, 36.0, -4.98),
    portals: [
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(4.51, 36.5, -6.29), toNode: 'flatA_living' }
    ]
  },

  // --- ROOM 8: FAMILY BATHROOM ---
  flatA_bath: {
    id: 'flatA_bath',
    category: 'penthouse',
    title: 'Penthouse: Family Bathroom',
    desc: 'Full residential bathroom with porcelain sanitary ware, enclosed washbasin, and vanity mirrors.',
    pos: new THREE.Vector3(3.85, 36.5, -5.2),
    target: new THREE.Vector3(3.85, 36.0, -4.16),
    portals: [
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(3.85, 36.5, -5.8), toNode: 'flatA_living' }
    ]
  },

  // --- ROOM 9: GUEST POWDER ROOM ---
  flatA_powder: {
    id: 'flatA_powder',
    category: 'penthouse',
    title: 'Penthouse: Guest Powder Room',
    desc: 'Convenient foyer powder room with modern washbasin, water closet, and towel hardware.',
    pos: new THREE.Vector3(2.73, 36.4, -5.55),
    target: new THREE.Vector3(2.73, 36.25, -3.85),
    portals: [
      { text: 'Return to Living Lounge 🛋️', doorPos: new THREE.Vector3(2.73, 36.5, -5.8), toNode: 'flatA_living' }
    ]
  },

  // --- CENTRAL SERVICE CORE: STAIRS & ELEVATORS ---
  hallway_core: {
    id: 'hallway_core',
    category: 'core',
    title: 'Central Lift Lobby & Common Corridor',
    desc: 'Connecting elevator landing, floor foyer, and access doorways to the penthouse suite.',
    pos: new THREE.Vector3(0.0, 36.6, -2.5),
    target: new THREE.Vector3(0.0, 36.2, 2.0),
    portals: [
      { text: 'Enter Penthouse (Flat A) 👑', doorPos: new THREE.Vector3(-1.72, 36.5, -7.64), toNode: 'flatA_living' },
      { text: 'View Stairs & Elevator Shaft 🛗', doorPos: new THREE.Vector3(0.0, 36.5, 1.5), toNode: 'stair_core' }
    ]
  },
  stair_core: {
    id: 'stair_core',
    category: 'core',
    title: 'Architectural Stairwell & Elevator Shaft',
    desc: 'Double-run stairs with steel stringers, timber treads, and full panoramic glass elevator core.',
    pos: new THREE.Vector3(0.0, 36.6, 2.0),
    target: new THREE.Vector3(0.0, 35.0, 4.0),
    portals: [
      { text: 'Return to Lift Lobby 🛗', doorPos: new THREE.Vector3(0.0, 36.5, -1.0), toNode: 'hallway_core' },
      { text: 'Enter Penthouse (Flat A) 👑', doorPos: new THREE.Vector3(-1.72, 36.5, -6.5), toNode: 'flatA_living' }
    ]
  }
};

const TOUR_KEYS = Object.keys(TOUR_NODES);
let isWalkthroughMode = false;
let currentNodeKey = 'flatA_living';

// Look-around angles (360° pan)
let lookYaw = 0;
let lookPitch = 0;
let targetYaw = 0;
let targetPitch = 0;
let isDraggingLook = false;
let prevPointerPos = { x: 0, y: 0 };

// Keyboard Free Walking (WASD)
const keyState = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (e) => {
  if (!isWalkthroughMode) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keyState.w = true;
  if (k === 's' || k === 'arrowdown') keyState.s = true;
  if (k === 'a' || k === 'arrowleft') keyState.a = true;
  if (k === 'd' || k === 'arrowright') keyState.d = true;
});

window.addEventListener('keyup', (e) => {
  if (!isWalkthroughMode) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keyState.w = false;
  if (k === 's' || k === 'arrowdown') keyState.s = false;
  if (k === 'a' || k === 'arrowleft') keyState.a = false;
  if (k === 'd' || k === 'arrowright') keyState.d = false;
});

const walkthroughDock = document.getElementById('walkthrough-dock');
const mainControlPanel = document.getElementById('main-control-panel');
const btnStartWalkthrough = document.getElementById('btn-start-walkthrough');
const btnExitWalkthrough = document.getElementById('btn-exit-walkthrough');
const wtRoomTitle = document.getElementById('wt-room-title');
const wtRoomDesc = document.getElementById('wt-room-desc');
const pathSlider = document.getElementById('path-slider');
const btnPrevRoom = document.getElementById('btn-prev-room');
const btnNextRoom = document.getElementById('btn-next-room');
const roomPillBtns = document.querySelectorAll('.room-pill-btn');

// Dynamic 3D Blue Door Portal Markers Container
const doorPortalElements = [];
const doorPortalsContainer = document.createElement('div');
doorPortalsContainer.id = 'door-portals-container';
document.body.appendChild(doorPortalsContainer);

function clearDoorPortals() {
  doorPortalsContainer.innerHTML = '';
  doorPortalElements.length = 0;
}

function renderDoorPortalsForCurrentNode() {
  clearDoorPortals();
  if (!isWalkthroughMode) return;

  const node = TOUR_NODES[currentNodeKey];
  if (!node || !node.portals) return;

  node.portals.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'door-portal-marker';
    el.innerHTML = `
      <div class="door-portal-ripple"></div>
      <div class="door-portal-core">
        <div class="door-portal-dot"></div>
      </div>
      <span class="door-portal-label">${p.text}</span>
    `;

    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      // Smoothly walk through doorway into destination room!
      navigateToNode(p.toNode, false);
    });

    doorPortalsContainer.appendChild(el);
    doorPortalElements.push({ el, portal: p });
  });
}

function updateWalkthroughCameraHeight() {
  const node = TOUR_NODES[currentNodeKey];
  const lift = explodeState.factor * 0.65;
  camera.position.y = node.pos.y + lift;
}

function enterWalkthroughMode(nodeKey = 'flatA_living') {
  isWalkthroughMode = true;
  controls.enabled = false;

  // GPU ACCELERATION FOR INTEGRATED GRAPHICS:
  // Hide lower 12 building floors (3.3M polys) while exploring interior rooms.
  if (buildingModel) buildingModel.visible = false;

  // Keep roof seated right above head so interior rooms have a realistic ceiling
  if (roofCapGroup) {
    roofCapGroup.visible = true;
    roofCapGroup.rotation.set(0, 0, 0);
    const lift = explodeState.factor * 0.65;
    roofCapGroup.position.set(0, lift, 0);
    roofCapGroup.traverse((c) => {
      if (c.isMesh && c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(m => m.side = THREE.DoubleSide);
        } else {
          c.material.side = THREE.DoubleSide;
        }
      }
    });
  }

  const polyLabel = document.querySelector('.header-stats .stat-pill .stat-val');
  if (polyLabel) polyLabel.textContent = '280K';

  gsap.to(camera, {
    fov: 75,
    duration: 1.0,
    ease: 'power2.inOut',
    onUpdate: () => camera.updateProjectionMatrix()
  });

  walkthroughDock.classList.add('active');
  mainControlPanel.classList.add('hidden-walkthrough');
  canvas.classList.add('canvas-look-grab');

  navigateToNode(nodeKey, true);
}

window.enterWalkthroughMode = enterWalkthroughMode;
window.exitWalkthroughMode = exitWalkthroughMode;
window.navigateToNode = navigateToNode;

function exitWalkthroughMode(shouldFlyToPreset = true) {
  isWalkthroughMode = false;
  controls.enabled = true;
  clearDoorPortals();

  // Restore exterior building geometry
  if (buildingModel) buildingModel.visible = true;
  if (roofCapGroup) {
    if (currentCameraPreset === 'topdown') {
      roofCapGroup.visible = true;
      roofCapGroup.rotation.z = Math.PI / 2;
      roofCapGroup.position.set(-28, 15, 0);
    } else {
      roofCapGroup.visible = true;
      applyExplodeFactor(explodeState.factor);
    }
  }

  const polyLabel = document.querySelector('.header-stats .stat-pill .stat-val');
  if (polyLabel) polyLabel.textContent = '3.64M';

  gsap.to(camera, {
    fov: 45,
    duration: 1.0,
    ease: 'power2.inOut',
    onUpdate: () => camera.updateProjectionMatrix()
  });

  walkthroughDock.classList.remove('active');
  mainControlPanel.classList.remove('hidden-walkthrough');
  canvas.classList.remove('canvas-look-grab', 'canvas-look-grabbing');

  if (shouldFlyToPreset) {
    flyCameraTo('penthouse');
  }
}

function navigateToNode(nodeKey, isImmediate = false) {
  const node = TOUR_NODES[nodeKey];
  if (!node) return;
  currentNodeKey = nodeKey;

  wtRoomTitle.textContent = node.title;
  wtRoomDesc.textContent = node.desc;

  const keyIndex = TOUR_KEYS.indexOf(nodeKey);
  if (keyIndex !== -1) {
    pathSlider.value = keyIndex;
    roomPillBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.node === nodeKey);
    });
  }

  const lift = explodeState.factor * 0.65;
  const targetPos = new THREE.Vector3(node.pos.x, node.pos.y + lift, node.pos.z);
  const targetLook = new THREE.Vector3(node.target.x, node.target.y + lift, node.target.z);

  const dir = targetLook.clone().sub(targetPos).normalize();
  targetYaw = Math.atan2(dir.x, -dir.z);
  targetPitch = Math.asin(dir.y);

  if (isImmediate) {
    camera.position.copy(targetPos);
    lookYaw = targetYaw;
    lookPitch = targetPitch;
    renderDoorPortalsForCurrentNode();
  } else {
    // Smooth GSAP walk through doorway to destination
    clearDoorPortals(); // Clear during motion
    gsap.killTweensOf(camera.position);
    gsap.to(camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.4,
      ease: 'power2.inOut',
      onComplete: () => {
        renderDoorPortalsForCurrentNode();
      }
    });
  }
}

if (btnStartWalkthrough) {
  btnStartWalkthrough.addEventListener('click', () => {
    goToStage(2);
  });
}

btnExitWalkthrough.addEventListener('click', () => {
  goToStage(1);
});

btnPrevRoom.addEventListener('click', () => {
  const idx = TOUR_KEYS.indexOf(currentNodeKey);
  if (idx > 0) navigateToNode(TOUR_KEYS[idx - 1]);
});

btnNextRoom.addEventListener('click', () => {
  const idx = TOUR_KEYS.indexOf(currentNodeKey);
  if (idx < TOUR_KEYS.length - 1) navigateToNode(TOUR_KEYS[idx + 1]);
});

pathSlider.addEventListener('input', (e) => {
  const idx = parseInt(e.target.value, 10);
  if (idx >= 0 && idx < TOUR_KEYS.length) {
    navigateToNode(TOUR_KEYS[idx]);
  }
});

roomPillBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.node) {
      navigateToNode(btn.dataset.node);
    }
  });
});

// Pointer Look-Around Handler (360° pan)
window.addEventListener('pointerdown', (e) => {
  if (!isWalkthroughMode) return;
  if (e.target.closest('#walkthrough-dock') || e.target.closest('.door-portal-marker') || e.target.closest('.app-header')) return;

  isDraggingLook = true;
  prevPointerPos = { x: e.clientX, y: e.clientY };
  canvas.classList.remove('canvas-look-grab');
  canvas.classList.add('canvas-look-grabbing');
});

window.addEventListener('pointermove', (e) => {
  if (!isWalkthroughMode || !isDraggingLook) return;

  const dx = e.clientX - prevPointerPos.x;
  const dy = e.clientY - prevPointerPos.y;
  prevPointerPos = { x: e.clientX, y: e.clientY };

  targetYaw -= dx * 0.0035;
  targetPitch -= dy * 0.0028;
  targetPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, targetPitch));
});

window.addEventListener('pointerup', () => {
  if (!isWalkthroughMode) return;
  isDraggingLook = false;
  canvas.classList.remove('canvas-look-grabbing');
  canvas.classList.add('canvas-look-grab');
});

window.setWalkthroughLook = (yaw, pitch) => {
  targetYaw = lookYaw = yaw;
  targetPitch = lookPitch = pitch;
};

// Update 3D Blue Door Portal Markers on Screen each frame
const portalVec = new THREE.Vector3();
const forwardCam = new THREE.Vector3();
const toPortalVec = new THREE.Vector3();

function updateDoorPortals() {
  if (!isWalkthroughMode) return;
  const lift = explodeState.factor * 0.65;
  camera.getWorldDirection(forwardCam);

  doorPortalElements.forEach(({ el, portal }) => {
    portalVec.copy(portal.doorPos);
    portalVec.y += lift;

    // Check if portal is in front of camera
    toPortalVec.copy(portalVec).sub(camera.position);
    const dist = toPortalVec.length();
    const dot = forwardCam.dot(toPortalVec.normalize());

    // Hide if behind camera, too close (<0.5m), or too far (>35m)
    if (dot < 0.15 || dist < 0.5 || dist > 35) {
      el.style.display = 'none';
      return;
    }

    portalVec.project(camera);

    // Behind clipping plane or far outside screen
    if (portalVec.z > 1 || portalVec.x < -1.15 || portalVec.x > 1.15 || portalVec.y < -1.15 || portalVec.y > 1.15) {
      el.style.display = 'none';
      return;
    }

    const x = (portalVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-portalVec.y * 0.5 + 0.5) * window.innerHeight;

    // Perspective scale based on distance for realism
    const scale = Math.max(0.75, Math.min(1.15, 1.0 - (dist - 4) * 0.025));

    el.style.display = 'flex';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--portal-scale', scale.toFixed(2));
  });
}

// Free Walking Loop (WASD Keyboard navigation + D-Pad buttons)
function updateFreeWalking() {
  if (!isWalkthroughMode) return;
  if (!keyState.w && !keyState.s && !keyState.a && !keyState.d) return;

  const moveSpeed = 0.11;
  const forward = new THREE.Vector3(Math.sin(lookYaw), 0, -Math.cos(lookYaw));
  const right = new THREE.Vector3(Math.cos(lookYaw), 0, Math.sin(lookYaw));

  if (keyState.w) camera.position.addScaledVector(forward, moveSpeed);
  if (keyState.s) camera.position.addScaledVector(forward, -moveSpeed);
  if (keyState.a) camera.position.addScaledVector(right, -moveSpeed);
  if (keyState.d) camera.position.addScaledVector(right, moveSpeed);

  // Keep camera standing at proper floor height
  const node = TOUR_NODES[currentNodeKey];
  const lift = explodeState.factor * 0.65;
  camera.position.y = (node ? node.pos.y : 36.6) + lift;

  // Precise boundary clamp to keep camera comfortably inside the penthouse floor:
  // Penthouse (North): X in [-10, 10], Z in [-14, -3]
  // East Wing: X in [0, 14], Z in [0, 14]
  // West Wing: X in [-14, 0], Z in [0, 14]
  camera.position.x = Math.max(-14.5, Math.min(14.5, camera.position.x));
  camera.position.z = Math.max(-14.2, Math.min(14.0, camera.position.z));
}

// D-Pad Touch / Click Walking Controls
const btnWalkForward = document.getElementById('btn-walk-forward');
const btnWalkBackward = document.getElementById('btn-walk-backward');
const btnWalkLeft = document.getElementById('btn-walk-left');
const btnWalkRight = document.getElementById('btn-walk-right');

function setupDpadButton(btn, key) {
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    keyState[key] = true;
  });
  window.addEventListener('pointerup', () => {
    keyState[key] = false;
  });
  btn.addEventListener('pointerleave', () => {
    keyState[key] = false;
  });
}

setupDpadButton(btnWalkForward, 'w');
setupDpadButton(btnWalkBackward, 's');
setupDpadButton(btnWalkLeft, 'a');
setupDpadButton(btnWalkRight, 'd');

// =============================================================================
// 6. GSAP CAMERA CHOREOGRAPHY (EXTERIOR PRESETS & TOP-DOWN CLEARANCE)
// =============================================================================
let currentCameraPreset = 'hero';

const cameraPresets = {
  hero: {
    pos: { x: 70, y: 52, z: 85 },
    target: { x: 0, y: 18, z: 0 },
    name: 'Hero View'
  },
  penthouse: {
    // Angled cutaway view focused directly on furnished luxury penthouse floor
    pos: { x: 0, y: 52, z: 20 },
    target: { x: 0, y: 36.5, z: -7.5 },
    name: 'Penthouse Suite'
  },
  topdown: {
    // Orthogonal top-down cutaway layout
    pos: { x: 0, y: 95, z: 0.1 },
    target: { x: 0, y: 35.5, z: 0 },
    name: 'Floorplan Layout'
  },
  street: {
    pos: { x: 42, y: 5, z: 50 },
    target: { x: 0, y: 16, z: 0 },
    name: 'Street Elevation'
  }
};

function flyCameraTo(presetKey) {
  if (isWalkthroughMode) {
    isWalkthroughMode = false;
    controls.enabled = true;
    clearDoorPortals();
    if (buildingModel) buildingModel.visible = true;
    const polyLabel = document.querySelector('.header-stats .stat-pill .stat-val');
    if (polyLabel) polyLabel.textContent = '3.64M';

    gsap.to(camera, {
      fov: 45,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate: () => camera.updateProjectionMatrix()
    });
    walkthroughDock.classList.remove('active');
    mainControlPanel.classList.remove('hidden-walkthrough');
    canvas.classList.remove('canvas-look-grab', 'canvas-look-grabbing');
  }

  currentCameraPreset = presetKey;
  const preset = cameraPresets[presetKey];
  if (!preset) return;

  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === presetKey);
  });

  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  const toggleRoof = document.getElementById('toggle-roof');

  if (presetKey === 'topdown') {
    // ROTATE ROOF TOP 90 DEGREES TO MAKE IT VERTICAL AND KEEP IT AT THE SIDE OF THE BUILDING:
    // It stands upright beside the tower like an architectural elevation cross-section,
    // leaving the top-down floorplan 100% unobstructed!
    gsap.to(roofCapGroup.rotation, {
      z: Math.PI / 2,
      duration: 1.2,
      ease: 'power2.inOut'
    });
    gsap.to(roofCapGroup.position, {
      x: -28,
      y: 15,
      z: 0,
      duration: 1.2,
      ease: 'power2.inOut'
    });
    roofCapGroup.visible = true;
    if (toggleRoof) toggleRoof.checked = true;
  } else {
    // Restore roof terrace rotation and position for all other views
    gsap.to(roofCapGroup.rotation, {
      z: (explodeState.factor / 20) * (Math.PI / 2),
      duration: 1.0,
      ease: 'power2.inOut'
    });
    roofCapGroup.visible = true;
    if (toggleRoof) toggleRoof.checked = true;
    applyExplodeFactor(explodeState.factor);
  }

  gsap.to(camera.position, {
    x: preset.pos.x,
    y: preset.pos.y,
    z: preset.pos.z,
    duration: 1.8,
    ease: 'power3.inOut'
  });

  gsap.to(controls.target, {
    x: preset.target.x,
    y: preset.target.y,
    z: preset.target.z,
    duration: 1.8,
    ease: 'power3.inOut',
    onUpdate: () => controls.update()
  });
}

document.querySelectorAll('.cam-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    flyCameraTo(btn.dataset.view);
  });
});

const btnResetView = document.getElementById('btn-reset-view');
if (btnResetView) {
  btnResetView.addEventListener('click', () => {
    goToStage(0);
  });
}



// Layer Visibility Toggles (Optional)
const toggleBuilding = document.getElementById('toggle-building');
if (toggleBuilding) {
  toggleBuilding.addEventListener('change', (e) => {
    if (buildingModel) buildingModel.visible = e.target.checked;
  });
}

const togglePenthouse = document.getElementById('toggle-penthouse');
if (togglePenthouse) {
  togglePenthouse.addEventListener('change', (e) => {
    if (topFloorModel) topFloorModel.visible = e.target.checked;
  });
}

const toggleRoof = document.getElementById('toggle-roof');
if (toggleRoof) {
  toggleRoof.addEventListener('change', (e) => {
    if (roofCapGroup) roofCapGroup.visible = e.target.checked;
  });
}

// Auto-Rotate
const toggleAutoRotate = document.getElementById('toggle-autorotate');
if (toggleAutoRotate) {
  toggleAutoRotate.addEventListener('change', (e) => {
    controls.autoRotate = e.target.checked;
    controls.autoRotateSpeed = 1.0;
  });
}

// Lighting Selector
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setLightingMode(btn.dataset.light);
  });
});

// =============================================================================
// 8. INTERACTIVE 3D HOTSPOTS
// =============================================================================
const hotspots = [
  {
    id: 'roof',
    badge: 'HOTSPOT // TIER 3 (ROOF)',
    title: 'Roof Terrace & Lift Core',
    desc: 'Top parapet level featuring elevator machine room, maintenance access stair, and architectural perimeter railings.',
    specs: { area: '120 m²', height: '36.5 m', status: 'Enclosed' },
    basePos: new THREE.Vector3(0, 39.0, 0),
    tier: 'roof',
    action: () => flyCameraTo('hero')
  },
  {
    id: 'penthouse',
    badge: 'HOTSPOT // TIER 2 (PENTHOUSE)',
    title: 'Luxury Furnished Penthouse',
    desc: 'Fully detailed private suite slotted beneath the roof: master bedrooms, dining tables, kitchen cabinetry, and panoramic views.',
    specs: { area: '480 m²', height: '35.2 m', status: 'Furnished' },
    basePos: new THREE.Vector3(0.5, 36.6, -8.0),
    tier: 'penthouse',
    action: () => enterWalkthroughMode('flatA_living')
  },
  {
    id: 'entrance',
    badge: 'HOTSPOT // TIER 1 (GROUND)',
    title: 'Lobby & Resident Parking',
    desc: 'Ground level complex featuring 20 Ford Ranger parking spaces, landscaped driveway, and entrance lobby.',
    specs: { area: '1,200 m²', height: '0.0 m', status: 'Active' },
    basePos: new THREE.Vector3(18, 1.5, 22),
    tier: 'base',
    action: () => flyCameraTo('street')
  }
];

const hotspotElements = [];
const hotspotCard = document.getElementById('hotspot-card');
const cardBadge = document.getElementById('card-badge');
const cardTitle = document.getElementById('card-title');
const cardDesc = document.getElementById('card-desc');
const cardSpecs = document.getElementById('card-specs');
const cardActionBtn = document.getElementById('card-action-btn');
const btnCloseCard = document.getElementById('btn-close-card');
let activeHotspot = null;

hotspots.forEach(data => {
  const el = document.createElement('div');
  el.className = 'scene-hotspot';
  el.innerHTML = `
    <div class="scene-hotspot-inner"></div>
    <div class="scene-hotspot-pulse"></div>
  `;
  document.body.appendChild(el);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    openHotspotCard(data);
  });

  hotspotElements.push({ el, data });
});

function openHotspotCard(data) {
  activeHotspot = data;
  cardBadge.textContent = data.badge;
  cardTitle.textContent = data.title;
  cardDesc.textContent = data.desc;
  cardSpecs.innerHTML = `
    <div class="spec-item"><span class="spec-label">Area / Units</span><span class="spec-value">${data.specs.area}</span></div>
    <div class="spec-item"><span class="spec-label">Elevation</span><span class="spec-value">${data.specs.height}</span></div>
    <div class="spec-item"><span class="spec-label">Status</span><span class="spec-value highlight">${data.specs.status}</span></div>
  `;
  cardActionBtn.textContent = data.id === 'penthouse' ? 'Step Inside Penthouse' : 'Focus Camera Here';
  hotspotCard.classList.add('visible');
}

btnCloseCard.addEventListener('click', () => {
  hotspotCard.classList.remove('visible');
  activeHotspot = null;
});

cardActionBtn.addEventListener('click', () => {
  if (activeHotspot && activeHotspot.action) {
    activeHotspot.action();
    hotspotCard.classList.remove('visible');
  }
});

const tempVec = new THREE.Vector3();
function updateHotspots() {
  if (isWalkthroughMode) {
    hotspotElements.forEach(({ el }) => { el.style.display = 'none'; });
    return;
  }

  hotspotElements.forEach(({ el, data }) => {
    tempVec.copy(data.basePos);

    if (data.tier === 'penthouse' && topFloorModel) {
      tempVec.y += (explodeState.factor * 0.65);
    } else if (data.tier === 'roof' && roofCapGroup) {
      tempVec.y += (explodeState.factor * 1.35);
    }

    tempVec.project(camera);

    if (tempVec.z > 1) {
      el.style.display = 'none';
      return;
    }

    const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

    el.style.display = 'flex';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  });
}

// =============================================================================
// 9. ANIMATION LOOP & SMOOTH STREET VIEW ORIENTATION
// =============================================================================
const fpsCounter = document.getElementById('fps-counter');
let frameCount = 0;
let lastFpsTime = performance.now();

function animate(time) {
  requestAnimationFrame(animate);

  if (isWalkthroughMode) {
    // Smooth look-around rotation damping
    lookYaw += (targetYaw - lookYaw) * 0.12;
    lookPitch += (targetPitch - lookPitch) * 0.12;

    const forward = new THREE.Vector3(
      Math.sin(lookYaw) * Math.cos(lookPitch),
      Math.sin(lookPitch),
      -Math.cos(lookYaw) * Math.cos(lookPitch)
    );
    camera.lookAt(camera.position.clone().add(forward));

    // Handle WASD / Arrow Keys free walking
    updateFreeWalking();
    updateDoorPortals();
  } else {
    controls.update();
  }

  // Drift cloud layer gently across the sky
  if (clouds.length > 0 && cloudGroup && cloudGroup.visible) {
    clouds.forEach((c) => {
      c.userData.baseAngle += c.userData.driftSpeed;
      c.position.x = Math.cos(c.userData.baseAngle) * c.userData.radius;
      c.position.z = Math.sin(c.userData.baseAngle) * c.userData.radius;
    });
  }

  // Rooftop aviation safety beacons blinking during sunset & night
  if (typeof rooftopBeaconMat !== 'undefined' && rooftopBeaconMat) {
    if (currentLightingMode === 'night' || currentLightingMode === 'sunset') {
      const bPhase = Math.sin(time * 0.005);
      rooftopBeaconMat.opacity = bPhase > 0.35 ? 1.0 : 0.06;
    } else {
      rooftopBeaconMat.opacity = 0.0;
    }
  }

  updateHotspots();
  renderer.render(scene, camera);

  // FPS calculation
  frameCount++;
  if (time - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (time - lastFpsTime));
    fpsCounter.textContent = fps;
    frameCount = 0;
    lastFpsTime = time;
  }
}

requestAnimationFrame(animate);

// =============================================================================
// 10. WINDOW RESIZE HANDLER
// =============================================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});
