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
let textMesh;    // Keep reference for wireframe toggle
let textEdges;   // Keep reference for the clean wireframe (light mode)
let wireUniforms = null; // shared uniforms for wireframe animation
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
      textMesh.visible   = !light;
      textEdges.visible  = light;
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
      // character separately, advance a cursor by charWidth + gap.
      // We build TWO merged geometries from identical layout/spacing:
      //   • geo      — full bevel, used for the dark-mode obsidian mesh
      //   • wireGeo  — NO bevel, used for edge extraction (light mode)
      //     Without bevel there are zero ring duplicates, so every
      //     structural edge (front outline, back outline, side wall,
      //     curve steps) maps to exactly ONE line.
      const LETTER_GAP = 0.9; // extra world-units of space between letters

      // Shared size/depth so both geometries occupy the same space
      const BASE_SIZE  = 7.8;
      const BASE_DEPTH = 3.8;

      const textOptions = {
        font,
        size: BASE_SIZE,
        depth: BASE_DEPTH,
        curveSegments: 10,
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.28,
        bevelOffset: 0,
        bevelSegments: 5,
      };

      // Wireframe options — enable bevel for the rounded 4-line thick edge
      const wireOptions = {
        font,
        size: BASE_SIZE,
        depth: BASE_DEPTH,
        curveSegments: 10,
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.28,
        bevelOffset: 0,
        bevelSegments: 3, // 3 segments + main edge = 4 lines thick
      };

      const charGeos     = [];
      const wireCharGeos = [];
      let cursor = 0;

      for (const char of 'VRTX') {
        // Beveled mesh geometry
        const cg = new TextGeometry(char, textOptions);
        cg.computeBoundingBox();
        const bb = cg.boundingBox;
        cg.translate(cursor - bb.min.x, 0, 0);

        // Beveled wire geometry — reuse same cursor position
        const wg = new TextGeometry(char, wireOptions);
        wg.computeBoundingBox();
        const wbb = wg.boundingBox;
        wg.translate(cursor - wbb.min.x, 0, 0);

        cursor += (bb.max.x - bb.min.x) + LETTER_GAP;
        charGeos.push(cg);
        wireCharGeos.push(wg);
      }

      // ── Dark-mode mesh geometry (beveled) ─────────────────────────────
      const geo = mergeGeometries(charGeos);
      geo.computeBoundingBox();
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

      // ── Light-mode wire geometry (no bevel) ───────────────────────────
      const wireGeo = mergeGeometries(wireCharGeos);
      wireGeo.computeBoundingBox();
      const wcx = (wireGeo.boundingBox.max.x + wireGeo.boundingBox.min.x) / 2;
      const wcy = (wireGeo.boundingBox.max.y + wireGeo.boundingBox.min.y) / 2;
      const wcz = (wireGeo.boundingBox.max.z + wireGeo.boundingBox.min.z) / 2;
      wireGeo.translate(-wcx, -wcy, -wcz);

      wireUniforms = {
        uTime:  { value: 0.0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      };

      // 8° threshold on the geometry:
      //   • Coplanar front/back face triangles  → ~0°  → dropped
      //   • Curved surface subdivision strips   → ~5-7° → dropped
      //   • Bevel ring edges                     → >10° → kept
      //   • Silhouette / outline edges           → ~90° → kept
      //   • Depth (extrusion side) edges         → ~90° → kept
      //   • Sharp corner creases (V, T, X)       → >30° → kept
      const edgesGeo = new THREE.EdgesGeometry(wireGeo, 8);

      // ── Wireframe shader ──────────────────────────────────────────────────
      // Vertex  → gentle mouse-proximity bulge (keeps the interactive feel)
      // Fragment → spatial sine-wave highlight + mouse hover glow + depth fade
      const wireMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: wireUniforms,
        vertexShader: /* glsl */`
out  vec3  vWorld;
out  float vDepth;
uniform vec2 uMouse;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;

  vec4 viewPos = viewMatrix * worldPos;
  vDepth       = -viewPos.z;

  vec4 clip    = projectionMatrix * viewPos;

  // Soft bulge toward camera near the cursor
  vec2  ndc   = clip.xy / clip.w;
  float cdist = distance(ndc, uMouse);
  float bulge = pow(max(0.0, 1.0 - cdist * 1.8), 3.0) * 2.2;
  viewPos.z  += bulge;
  gl_Position = projectionMatrix * viewPos;
}`,
        fragmentShader: /* glsl */`
in  vec3  vWorld;
in  float vDepth;
out vec4  fragColor;
uniform float uTime;
uniform vec2  uMouse;

void main() {
  // Base: near-black ink with a slight cool tint
  vec3 base = vec3(0.07, 0.09, 0.13);

  // Travelling-wave highlight — spatial so the pulse looks 3-D
  float phase = (vWorld.x * 0.18 + vWorld.y * 0.10) - uTime * 1.1;
  float wave  = pow(max(0.0, sin(phase * 3.14159)), 6.0);
  vec3  pulse = mix(vec3(0.35, 0.55, 1.00), vec3(0.15, 0.90, 0.85), wave);

  // Mouse-proximity glow — hot-spot brightens edges near the cursor
  float mx    = uMouse.x * 17.0;
  float my    = uMouse.y *  9.0;
  float mdist = distance(vWorld.xy, vec2(mx, my));
  float hover = pow(max(0.0, 1.0 - mdist * 0.12), 3.0) * 0.55;

  // Depth fade — rear faces slightly desaturate for depth cue
  float fade  = clamp(1.0 - (vDepth - 28.0) * 0.04, 0.55, 1.0);

  vec3  col   = (base + pulse * (0.35 + wave * 0.45) + vec3(hover)) * fade;
  float alpha = 0.80 + wave * 0.18 + hover * 0.20;

  fragColor = vec4(col, alpha);
}`,
        transparent: true,
        depthWrite:  false,
        depthTest:   true,
        blending:    THREE.NormalBlending,
      });

      textEdges = new THREE.LineSegments(edgesGeo, wireMat);
      textGroup.add(textEdges);

      // Trigger initial theme update for text
      const light = document.body.classList.contains("light-mode");
      textMesh.visible  = !light;
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

  // Update wireframe uniforms once per frame (light mode)
  if (wireUniforms) {
    wireUniforms.uTime.value = t;
    wireUniforms.uMouse.value.set(mouse.x, mouse.y);
  }

  controls.update();
  composer.render();
}
