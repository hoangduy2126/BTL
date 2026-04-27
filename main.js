import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TTFLoader } from "three/addons/loaders/TTFLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ── State ──────────────────────────────────────────────────────────────────
let camera, scene, renderer, composer, controls;
let textGroup;
let textMesh; // Keep reference for wireframe toggle
let textEdges; // Keep reference for the clean edge wireframe
let bloomPass, darkMaterial, lightMaterial;
let iridLights = []; // coloured spot lights that orbit to fake anisotropy

const mouse = { x: 0, y: 0 };
const targetMouse = { x: 0, y: 0 };

// Manual ping-pong rotation on textGroup (independent of OrbitControls)
const TEXT_ROT_MAX = 0.6; // radians, ~34°
const TEXT_ROT_MIN = -0.6;
const TEXT_ROT_SPEED = 0.0005; // radians per frame (~0.14°/frame)
let textRotY = 0; // current Y angle of textGroup
let textRotDir = 1; // 1 = clockwise, -1 = counter-clockwise

// ── Boot ───────────────────────────────────────────────────────────────────
init();

function init() {
  // Scene
  scene = new THREE.Scene();
  // Background is handled by CSS (renderer alpha: true)
  scene.background = null;

  const observer = new MutationObserver(() => {
    const light = document.body.classList.contains("light-mode");
    if (bloomPass) {
      bloomPass.threshold = light ? 2.0 : 0.65;
    }
    if (textMesh && textEdges) {
      textMesh.visible = !light;
      textEdges.visible = light;
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Camera – pulled back enough to frame thick text nicely
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 0, 34);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Rich PMREM env-map (for reflections on the obsidian surface)
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Lights
  buildLightRig();

  // Text
  textGroup = new THREE.Group();
  scene.add(textGroup);
  loadText();

  // Particles
  createParticles();

  // Post-processing
  setupPostProcessing();

  // Controls — mouse drag only, NO autoRotate (ping-pong is handled manually)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = false;
  // Keep a gentle polar constraint so dragging vertically stays reasonable
  controls.minPolarAngle = Math.PI / 2 - 0.55;
  controls.maxPolarAngle = Math.PI / 2 + 0.55;
  // Limit horizontal (azimuth) movement
  controls.minAzimuthAngle = -0.5;
  controls.maxAzimuthAngle = 0.5;

  // Events
  document.addEventListener("mousemove", onMouseMove);
  window.addEventListener("resize", onResize);

  // Animate
  renderer.setAnimationLoop(animate);
}

// ── Cinematic Light Rig ────────────────────────────────────────────────────
function buildLightRig() {
  // Soft ambient fill
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // Primary key – warm gold from upper-right front
  const key = new THREE.DirectionalLight(0xffcc66, 2.2);
  key.position.set(14, 12, 22);
  key.castShadow = true;
  scene.add(key);

  // Fill – cool blue-white from left
  const fill = new THREE.DirectionalLight(0xaaccff, 1.2);
  fill.position.set(-18, 4, 18);
  scene.add(fill);

  // Rim – deep magenta back-right
  const rim1 = new THREE.SpotLight(0xff00cc, 2500);
  rim1.position.set(18, 8, -14);
  rim1.angle = Math.PI / 5;
  rim1.penumbra = 0.9;
  rim1.decay = 2;
  scene.add(rim1);

  // Rim – electric cyan back-left
  const rim2 = new THREE.SpotLight(0x00ffff, 2500);
  rim2.position.set(-18, -6, -14);
  rim2.angle = Math.PI / 5;
  rim2.penumbra = 0.9;
  rim2.decay = 2;
  scene.add(rim2);

  // Iridescent accent lights (orbit to simulate CD rainbow bands)
  // These are cheap per-frame moving lights that produce streaky highlights
  const iridColors = [
    0xff2266, // crimson
    0xff8800, // orange-gold
    0xffee00, // yellow
    0x00ff88, // green
    0x00ccff, // cyan
    0xaa00ff, // violet
  ];
  iridColors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 180, 35, 2); // much lower intensity
    light.userData.phase = (i / iridColors.length) * Math.PI * 2;
    light.userData.radius = 14 + (i % 2) * 4;
    light.userData.speed = 0.18 + i * 0.025;
    iridLights.push(light);
    scene.add(light);
  });
}

// ── Text Geometry ──────────────────────────────────────────────────────────
function loadText() {
  const ttfLoader = new TTFLoader();
  ttfLoader.load(
    "https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Black.ttf",
    (json) => {
      const font = new FontLoader().parse(json);

      // ── Holographic Obsidian Material ──────────────────────────────
      // MeshPhysicalMaterial with maximum iridescence + clearcoat to
      // simulate the CD-disc anisotropy look.
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x0d0d0d, // near-black base
        metalness: 0.75, // metallic but not perfect mirror
        roughness: 0.28, // slightly brushed — cuts harsh glare
        envMapIntensity: 1.1, // moderate env reflections

        // Removed very faint glass-like depth to fix massive lag
        // transmission:    0.03,
        // ior:             1.5,
        // thickness:       2.5,

        // Thin-film iridescence — present but restrained
        iridescence: 0.65,
        iridescenceIOR: 1.4,
        iridescenceThicknessRange: [120, 600],

        // Softer clearcoat
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,

        // Subtle sheen
        sheen: 0.4,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0x6677cc),
      });

      // ── Per-letter geometry with manual spacing ───────────────────────
      // TextGeometry has no letter-spacing param, so we create each
      // character separately, advance a cursor by charWidth + gap,
      // then merge into one BufferGeometry used by both modes.
      const LETTER_GAP = 0.9; // extra world-units of space between letters
      const textOptions = {
        font,
        size: 7.8,
        depth: 3.8,
        curveSegments: 14,  // higher = smoother curves, no staircase
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.28,
        bevelOffset: 0,
        bevelSegments: 8,   // smooth bevel rings
      };

      const charGeos = [];
      let cursor = 0;
      for (const char of 'VRTX') {
        const cg = new TextGeometry(char, textOptions);
        cg.computeBoundingBox();
        const bb = cg.boundingBox;
        // Flush left edge to cursor position, then advance cursor
        cg.translate(cursor - bb.min.x, 0, 0);
        cursor += (bb.max.x - bb.min.x) + LETTER_GAP;
        charGeos.push(cg);
      }

      const geo = mergeGeometries(charGeos);
      geo.computeBoundingBox();
      // Centre the merged block
      const mcx = (geo.boundingBox.max.x + geo.boundingBox.min.x) / 2;
      const mcy = (geo.boundingBox.max.y + geo.boundingBox.min.y) / 2;
      const mcz = (geo.boundingBox.max.z + geo.boundingBox.min.z) / 2;
      geo.translate(-mcx, -mcy, -mcz);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      textGroup.add(mesh);
      textMesh = mesh;
      darkMaterial = mat;

      // ── Stained Glass — LIGHT MODE only ─────────────────────────────────
      // ONE full-spectrum palette shared by all letters so every pane across
      // all of VRTX is a different colour from the rainbow — exactly like a
      // real church stained-glass window where colours mix freely everywhere.
      const NSEEDS = 18;


      // Muted neutral palette — each hue is desaturated ~40% toward mid-gray
      const stainedPalette = [
        [0.70, 0.42, 0.40], // dusty terracotta
        [0.74, 0.60, 0.46], // warm tan
        [0.74, 0.70, 0.50], // muted gold
        [0.54, 0.66, 0.50], // sage
        [0.44, 0.64, 0.52], // muted green
        [0.42, 0.62, 0.60], // muted teal
        [0.44, 0.68, 0.74], // soft cyan
        [0.48, 0.56, 0.72], // slate blue
        [0.46, 0.50, 0.70], // muted indigo
        [0.58, 0.48, 0.70], // dusty violet
        [0.64, 0.50, 0.70], // soft amethyst
        [0.70, 0.48, 0.66], // dusty mauve
        [0.70, 0.48, 0.54], // muted rose
        [0.72, 0.60, 0.46], // warm sand
        [0.52, 0.66, 0.58], // muted jade
        [0.68, 0.52, 0.46], // soft sienna
        [0.52, 0.60, 0.70], // smoke blue
        [0.64, 0.52, 0.62], // muted plum
      ];

      function drng(s){ const x=Math.sin(s*9301+49297)*233280; return x-Math.floor(x); }

      const vtx = `out vec2 vUv;
out vec3 vPos;
out vec2 vScreen;
out vec3 vNormal;
uniform vec2 uMouse;
void main(){
  vUv = uv; vPos = position;
  vNormal = normalMatrix * normal;  // view-space normal

  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  vec4 clipPre  = projectionMatrix * viewPos;
  vec2 ndc      = clipPre.xy / clipPre.w;

  float cdist = distance(ndc, uMouse);
  float bulge = pow(max(0.0, 1.0 - cdist * 2.0), 2.5) * 3.0;
  viewPos.z  += bulge;

  vec4 clip = projectionMatrix * viewPos;
  vScreen   = clip.xy / clip.w;
  gl_Position = clip;
}`;

      // Fragment shader: replicates the CSS nav-gradient-flow animation exactly.
      // Colours: --cyan #8ebba8 → --green #3b8c9d → --gold #f6ecc0 → --magenta #d96b38
      // Speed: 10 s per full cycle (same as site CSS)
      // Layout: 1.5× the letter width visible at once (CSS equivalent of 300% background-size)
      const frg = `precision highp float;
in vec3 vPos;
in vec2 vScreen;
in vec3 vNormal;
out vec4 fragColor;
uniform float uTime;
uniform vec2  uMouse;

// Site palette: exact hex values from :root CSS variables
vec3 gradAt(float t){
  t = fract(t);
  vec3 c0 = vec3(0.557, 0.733, 0.659); // --cyan    #8ebba8
  vec3 c1 = vec3(0.231, 0.549, 0.616); // --green   #3b8c9d
  vec3 c2 = vec3(0.965, 0.925, 0.753); // --gold    #f6ecc0
  vec3 c3 = vec3(0.851, 0.420, 0.220); // --magenta #d96b38
  float s = t * 4.0;
  int   i = int(floor(s));
  float f = smoothstep(0.0, 1.0, fract(s));
  if (i == 0) return mix(c0, c1, f);
  if (i == 1) return mix(c1, c2, f);
  if (i == 2) return mix(c2, c3, f);
  return           mix(c3, c0, f);
}

void main(){
  // Face detection: front face normal faces the viewer (view-space z > 0)
  float faceBlend = smoothstep(0.2, 0.6, vNormal.z);
  if (faceBlend < 0.01) {
    fragColor = vec4(0.14, 0.13, 0.12, 1.0); // side walls: dark neutral
    return;
  }

  // nav-gradient-flow wave: scrolls left→right, 10 s per cycle
  // xNorm 0…1 across VRTX, ×1.5 = 300% width (shows 1.5 gradient repeats)
  // ── Metallic face: gradient is the tinted base, cursor is the light source ──
  float xNorm   = (vPos.x + 18.0) / 36.0;
  vec3  baseCol = gradAt(xNorm * 1.5 - uTime / 10.0);

  // Bowling-ball shiny: keep full base colour with a little ambient so unlit faces aren't black
  vec3  ballBase = baseCol * 0.80 + vec3(0.08);

  // Blinn-Phong specular — cursor acts as a point light
  vec3  N = normalize(vNormal);
  vec3  L = normalize(vec3(uMouse - vScreen, 0.3)); // Z=0.3: light close to surface = tracks cursor directly
  vec3  V = vec3(0.0, 0.0, 1.0);                    // view direction (toward camera)
  vec3  H = normalize(L + V);
  float NdotL = max(dot(N, L), 0.0);
  float spec  = pow(max(dot(N, H), 0.0), 160.0) * NdotL; // 160 = tight glossy

  // Specular: near-white, slightly tinted by gradient
  vec3  specCol = mix(vec3(1.0, 0.98, 0.95), baseCol, 0.20);

  // Direct screen-space hot-spot — bright exactly where cursor sits on the surface
  float cursorDist = distance(vScreen, uMouse);
  float hotSpot    = pow(max(0.0, 1.0 - cursorDist * 5.0), 2.5) * 0.55;

  vec3 faceCol = ballBase + spec * specCol * 1.4 + hotSpot * specCol;
  vec3 sideCol = baseCol * 0.25 + spec * specCol * 0.6 + hotSpot * specCol * 0.4;

  fragColor = vec4(mix(sideCol, faceCol, faceBlend), 1.0);
}`;


      textEdges = new THREE.Group();
      const centerOffset = new THREE.Vector3(-mcx, -mcy, -mcz);

      charGeos.forEach((cg, li) => {
        const mat = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: {
            uTime:  { value: 0 },
            uMouse: { value: new THREE.Vector2(0, 0) },
          },
          vertexShader:   vtx,
          fragmentShader: frg,
          side: THREE.DoubleSide,
        });
        const m = new THREE.Mesh(cg, mat);
        m.position.copy(centerOffset);
        textEdges.add(m);
      });

      textGroup.add(textEdges);

      // Trigger initial theme update for text
      const light = document.body.classList.contains("light-mode");
      textMesh.visible = !light;
      textEdges.visible = light;
      if (light && bloomPass) bloomPass.threshold = 2.0;

      // Hide loading screen with a delay to allow the intro animation to finish
      const ls = document.getElementById("loading-screen");
      if (ls) {
        setTimeout(() => {
          ls.classList.add("hidden");
        }, 1000); // Reduced to 2s for a faster experience
      }
    },
  );
}

// ── Particles ──────────────────────────────────────────────────────────────
function createParticles() {
  const count = 350;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  // Rainbow palette for the dust
  const palette = [
    [0, 1, 1], // cyan
    [1, 0, 0.8], // magenta
    [1, 0.6, 0], // gold
    [0.5, 0, 1], // violet
    [0, 1, 0.4], // green
  ];

  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 50;

    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.09,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  scene.add(new THREE.Points(geo, mat));
}

// ── Post-processing ────────────────────────────────────────────────────────
function setupPostProcessing() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Gentle bloom – enough to make highlights glow without washing out detail
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.25, // strength — subtle glow only
    0.4, // radius
    0.65, // threshold — only hottest highlights bloom
  );
  composer.addPass(bloomPass);

  // Chromatic aberration – subtle lens fringing
  const rgbShift = new ShaderPass(RGBShiftShader);
  rgbShift.uniforms["amount"].value = 0.0018;
  composer.addPass(rgbShift);
}

// ── Events ─────────────────────────────────────────────────────────────────
function onMouseMove(e) {
  targetMouse.x = (e.clientX / innerWidth) * 2 - 1;
  targetMouse.y = -(e.clientY / innerHeight) * 2 + 1;
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}

// ── Render Loop ────────────────────────────────────────────────────────────
function animate() {
  const t = performance.now() * 0.001;

  // Smooth mouse lerp
  mouse.x += (targetMouse.x - mouse.x) * 0.07;
  mouse.y += (targetMouse.y - mouse.y) * 0.07;

  // ── Manual ping-pong Y rotation on textGroup ───────────────────────────
  textRotY += textRotDir * TEXT_ROT_SPEED;
  if (textRotY >= TEXT_ROT_MAX) {
    textRotY = TEXT_ROT_MAX;
    textRotDir = -1; // hit right limit → reverse to counter-clockwise
  } else if (textRotY <= TEXT_ROT_MIN) {
    textRotY = TEXT_ROT_MIN;
    textRotDir = 1; // hit left limit  → reverse to clockwise
  }

  // Gentle float on the text group (position stays centred)
  if (textGroup) {
    textGroup.position.x = 0;
    textGroup.position.y = Math.sin(t * 0.45) * 0.35;
    textGroup.rotation.y = textRotY; // ping-pong Y
    textGroup.rotation.z = Math.sin(t * 0.12) * 0.018; // subtle Z-roll
  }

  // Orbit the iridescent accent lights around the text
  iridLights.forEach((light) => {
    const angle = t * light.userData.speed + light.userData.phase;
    const r = light.userData.radius;
    light.position.set(
      Math.cos(angle) * r,
      Math.sin(angle * 1.7) * r * 0.55,
      Math.sin(angle) * (r * 0.5) + 5,
    );
  });

  // Update uTime + uMouse for all light-mode stained glass materials
  if (textEdges && textEdges.children) {
    textEdges.children.forEach(child => {
      if (child.material && child.material.uniforms) {
        const u = child.material.uniforms;
        if (u.uTime)  u.uTime.value  = t;
        if (u.uMouse) u.uMouse.value.set(mouse.x, mouse.y);
      }
    });
  }

  controls.update();
  composer.render();
}
