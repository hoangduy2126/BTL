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


      // Full rainbow jewel palette — vivid, saturated, church-window quality
      const stainedPalette = [
        [0.92,0.06,0.10], // ruby red
        [0.96,0.42,0.04], // fire orange
        [0.96,0.78,0.04], // golden yellow
        [0.50,0.88,0.04], // lime
        [0.06,0.78,0.22], // vivid green
        [0.04,0.66,0.52], // jade teal
        [0.04,0.78,0.88], // bright cyan
        [0.06,0.38,0.92], // cobalt blue
        [0.06,0.18,0.82], // deep navy
        [0.40,0.06,0.92], // deep violet
        [0.62,0.06,0.94], // amethyst
        [0.88,0.06,0.88], // vivid magenta
        [0.92,0.06,0.46], // rose crimson
        [0.96,0.56,0.10], // amber
        [0.20,0.86,0.60], // spring green
        [0.92,0.30,0.06], // scarlet
        [0.14,0.62,0.94], // sky blue
        [0.78,0.04,0.62], // purple-rose
      ];

      function drng(s){ const x=Math.sin(s*9301+49297)*233280; return x-Math.floor(x); }

      const vtx = `out vec2 vUv;
out vec3 vPos;
out vec2 vScreen;
uniform vec2 uMouse;
void main(){
  vUv=uv; vPos=position;

  // Preliminary clip position to get NDC for cursor-distance calc
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  vec4 clipPre  = projectionMatrix * viewPos;
  vec2 ndc      = clipPre.xy / clipPre.w;

  // 3-D bulge: push vertex toward camera proportional to cursor proximity
  float cdist = distance(ndc, uMouse);
  float bulge = pow(max(0.0, 1.0 - cdist * 2.0), 2.5) * 3.0;
  viewPos.z  += bulge;

  vec4 clip = projectionMatrix * viewPos;
  vScreen   = clip.xy / clip.w;
  gl_Position = clip;
}`;

      // Shader has DARK LEAD LINES baked in via Voronoi edge distance —
      // authentic stained-glass look from the reference images.
      const LEAD = 0.022;  // lead-came line width in UV space
      const frg = `precision highp float;
in vec2 vUv;
in vec3 vPos;
in vec2 vScreen;
out vec4 fragColor;
uniform float uS[${NSEEDS*2}];
uniform float uC[${NSEEDS*3}];
uniform float uOp;
uniform float uTime;
uniform vec2  uMouse; // cursor in NDC (-1..1)

// Hue rotation matrix — smoothly cycles any RGB colour through the wheel
vec3 hueShift(vec3 c, float a){
  float ca=cos(a), sa=sin(a);
  return clamp(mat3(
    ca + (1.0-ca)*0.299,      (1.0-ca)*0.299 - sa*0.587, (1.0-ca)*0.299 + sa*0.587,
    (1.0-ca)*0.587 + sa*0.114, ca + (1.0-ca)*0.587,       (1.0-ca)*0.587 - sa*0.114,
    (1.0-ca)*0.114 - sa*0.299, (1.0-ca)*0.114 + sa*0.299, ca + (1.0-ca)*0.114
  ) * c, 0.0, 1.0);
}

void main(){
  // Cursor blob: distort UVs near mouse position (Voronoi panes warp)
  float cursorDist = distance(vScreen, uMouse);
  float blobR      = max(0.0, 1.0 - cursorDist * 2.2); // falloff radius
  float blob       = pow(blobR, 2.5);
  // Push UVs outward from cursor — makes panes look like they "bulge"
  vec2 blobDir = normalize(vScreen - uMouse + vec2(0.0001));
  vec2 uv = vUv + sin(vUv.yx * 10.0 + uTime * 0.35) * 0.004
              + blobDir * blob * 0.06;

  float d0=1e6,d1=1e6; int idx=0;
  for(int i=0;i<${NSEEDS};i++){
    vec2 s=vec2(uS[i*2],uS[i*2+1]);
    float d=distance(uv,s);
    if(d<d0){d1=d0;d0=d;idx=i;}else if(d<d1){d1=d;}
  }
  float edge=d1-d0;

  if(edge < ${LEAD.toFixed(3)}){
    // ── Lead came: dark near-black line between panes ──────────────
    float t = edge / ${LEAD.toFixed(3)};
    fragColor = vec4(0.07,0.04,0.02, mix(1.0, 0.85, t));
  } else {
    // ── Glass pane colour with live hue animation ─────────────────
    vec3 col = vec3(uC[idx*3], uC[idx*3+1], uC[idx*3+2]);

    // Each cell shifts hue at its own speed — no two panes cycle in sync
    float angle = uTime * 0.9 + float(idx) * 0.52;
    col = hueShift(col, angle);

    // Pane brightness: dimmer at lead edges, bright in pane centre
    float pane = smoothstep(${LEAD.toFixed(3)}, ${(LEAD*5).toFixed(3)}, edge);
    col *= 0.70 + 0.30 * pane;

    // Cathedral backlit glow
    float glow = pow(pane, 2.0) * 0.18;

    // Specular gloss
    float shine = pow(max(0.0, 1.0 - distance(vUv, vec2(0.22,0.80))), 5.0) * 0.55;
    shine      += pow(max(0.0, 1.0 - distance(vUv, vec2(0.80,0.18))), 7.0) * 0.38;

    // ── Orbiting light deflections — mirror the irid accent lights ─────────
    // Each blob sweeps across the UV space driven by uTime, just like the
    // coloured PointLights that orbit the text in dark mode.
    vec3 irid = vec3(0.0);
    vec2 lp;
    float ld;
    // Crimson sweep
    lp = vec2(0.5 + cos(uTime*0.42)*0.48, 0.5 + sin(uTime*0.55)*0.42);
    ld = pow(max(0.0, 1.0 - distance(vUv,lp)*2.6), 4.0);
    irid += vec3(1.00,0.13,0.40) * ld * 0.50;
    // Cyan sweep
    lp = vec2(0.5 + cos(uTime*0.31+2.1)*0.48, 0.5 + sin(uTime*0.38+1.3)*0.42);
    ld = pow(max(0.0, 1.0 - distance(vUv,lp)*2.6), 4.0);
    irid += vec3(0.00,0.80,1.00) * ld * 0.45;
    // Violet sweep
    lp = vec2(0.5 + cos(uTime*0.55+4.2)*0.48, 0.5 + sin(uTime*0.48+3.1)*0.42);
    ld = pow(max(0.0, 1.0 - distance(vUv,lp)*2.6), 4.0);
    irid += vec3(0.67,0.00,1.00) * ld * 0.45;
    // Gold sweep
    lp = vec2(0.5 + cos(uTime*0.24+5.8)*0.48, 0.5 + sin(uTime*0.30+2.6)*0.42);
    ld = pow(max(0.0, 1.0 - distance(vUv,lp)*2.8), 5.0);
    irid += vec3(1.00,0.55,0.00) * ld * 0.40;

    // Internal iridescence shimmer
    float shimmer = sin(vPos.x * 10.0 + uTime * 0.5) * 0.015;

    // Cursor hot-spot glow — bright white-hot blob at mouse position
    vec3 cursorGlow = vec3(1.0, 0.98, 0.95) * pow(blob, 1.2) * 0.65;

    fragColor = vec4(col + glow + shine + irid + shimmer + cursorGlow, uOp);
  }
}`;


      textEdges = new THREE.Group();
      const centerOffset = new THREE.Vector3(-mcx, -mcy, -mcz);

      // Outer silhouette lead lines — clean at 22° threshold (no bevel facets)
      const edgesGeo = new THREE.EdgesGeometry(geo, 22);
      const edgesMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: {
          uMouse: { value: new THREE.Vector2(0, 0) },
          uOp:    { value: 0.35 },
        },
        vertexShader: `
uniform vec2 uMouse;
void main(){
  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
  vec4 clipPre = projectionMatrix * viewPos;
  vec2 ndc     = clipPre.xy / clipPre.w;
  float cdist  = distance(ndc, uMouse);
  float bulge  = pow(max(0.0, 1.0 - cdist * 2.0), 2.5) * 3.0;
  viewPos.z   += bulge;
  gl_Position  = projectionMatrix * viewPos;
}`,
        fragmentShader: `
out vec4 fragColor;
uniform float uOp;
void main(){ fragColor = vec4(0.06, 0.04, 0.02, uOp); }`,
        transparent: true,
        depthWrite: false,
      });
      textEdges.add(new THREE.LineSegments(edgesGeo, edgesMat));

      charGeos.forEach((cg, li) => {
        const seeds  = new Float32Array(NSEEDS * 2);
        const colors = new Float32Array(NSEEDS * 3);
        // Each letter gets its own random seed layout but the SAME full palette
        const shift = li * 19 + 3;
        for (let k = 0; k < NSEEDS; k++) {
          seeds[k*2]   = drng(k*2   + shift);
          seeds[k*2+1] = drng(k*2+1 + shift);
          // Cycle through the full rainbow palette — all colours in every letter
          const c = stainedPalette[k % stainedPalette.length];
          colors[k*3]=c[0]; colors[k*3+1]=c[1]; colors[k*3+2]=c[2];
        }
        const mat = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: {
            uS:    { value: seeds  },
            uC:    { value: colors },
            uOp:   { value: 1.0                        },
            uTime: { value: 0                           },
            uMouse:{ value: new THREE.Vector2(0, 0)     },
          },
          vertexShader:   vtx,
          fragmentShader: frg,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
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
