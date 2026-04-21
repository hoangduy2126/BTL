import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ── State ──────────────────────────────────────────────────────────────────
let camera, scene, renderer, composer, controls;
let textGroup;
let iridLights = [];   // coloured spot lights that orbit to fake anisotropy

const mouse    = { x: 0, y: 0 };
const targetMouse = { x: 0, y: 0 };

// Manual ping-pong rotation on textGroup (independent of OrbitControls)
const TEXT_ROT_MAX   =  0.6;   // radians, ~34°
const TEXT_ROT_MIN   = -0.6;
const TEXT_ROT_SPEED =  0.0005; // radians per frame (~0.14°/frame)
let   textRotY       =  0;     // current Y angle of textGroup
let   textRotDir     =  1;     // 1 = clockwise, -1 = counter-clockwise

// ── Boot ───────────────────────────────────────────────────────────────────
init();

function init() {

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera – pulled back enough to frame thick text nicely
    camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(0, 0, 34);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.06;
    controls.enableZoom      = false;
    controls.enablePan       = false;
    controls.autoRotate      = false;
    // Keep a gentle polar constraint so dragging vertically stays reasonable
    controls.minPolarAngle   = Math.PI / 2 - 0.55;
    controls.maxPolarAngle   = Math.PI / 2 + 0.55;
    // Limit horizontal (azimuth) movement
    controls.minAzimuthAngle = -0.5;
    controls.maxAzimuthAngle =  0.5;

    // Events
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

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
        0xff2266,   // crimson
        0xff8800,   // orange-gold
        0xffee00,   // yellow
        0x00ff88,   // green
        0x00ccff,   // cyan
        0xaa00ff,   // violet
    ];
    iridColors.forEach((color, i) => {
        const light = new THREE.PointLight(color, 180, 35, 2);  // much lower intensity
        light.userData.phase = (i / iridColors.length) * Math.PI * 2;
        light.userData.radius = 14 + (i % 2) * 4;
        light.userData.speed  = 0.18 + i * 0.025;
        iridLights.push(light);
        scene.add(light);
    });
}

// ── Text Geometry ──────────────────────────────────────────────────────────
function loadText() {
    const ttfLoader = new TTFLoader();
    ttfLoader.load(
        'https://raw.githubusercontent.com/googlefonts/montserrat/master/fonts/ttf/Montserrat-Black.ttf',
        (json) => {
            const font = (new FontLoader()).parse(json);

            // ── Holographic Obsidian Material ──────────────────────────────
            // MeshPhysicalMaterial with maximum iridescence + clearcoat to
            // simulate the CD-disc anisotropy look.
            const mat = new THREE.MeshPhysicalMaterial({
                color:           0x0d0d0d,   // near-black base
                metalness:       0.75,        // metallic but not perfect mirror
                roughness:       0.28,        // slightly brushed — cuts harsh glare
                envMapIntensity: 1.1,         // moderate env reflections

                // Very faint glass-like depth
                transmission:    0.03,
                ior:             1.5,
                thickness:       2.5,

                // Thin-film iridescence — present but restrained
                iridescence:          0.65,
                iridescenceIOR:       1.4,
                iridescenceThicknessRange: [120, 600],

                // Softer clearcoat
                clearcoat:            0.6,
                clearcoatRoughness:   0.18,

                // Subtle sheen
                sheen:          0.4,
                sheenRoughness: 0.5,
                sheenColor:     new THREE.Color(0x6677cc),
            });

            // VRTX geometry – massive, deep block letters
            const geo = new TextGeometry('VRTX', {
                font,
                size:          7.8,
                depth:         3.8,
                curveSegments: 20,
                bevelEnabled:  true,
                bevelThickness: 0.45,
                bevelSize:      0.28,
                bevelOffset:    0,
                bevelSegments:  12,
            });
            geo.center();

            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow    = true;
            mesh.receiveShadow = true;
            textGroup.add(mesh);

            // Hide loading screen once font is ready
            const ls = document.getElementById('loading-screen');
            if (ls) ls.classList.add('hidden');
        }
    );
}

// ── Particles ──────────────────────────────────────────────────────────────
function createParticles() {
    const count = 350;
    const pos   = new Float32Array(count * 3);
    const col   = new Float32Array(count * 3);

    // Rainbow palette for the dust
    const palette = [
        [0, 1, 1],       // cyan
        [1, 0, 0.8],     // magenta
        [1, 0.6, 0],     // gold
        [0.5, 0, 1],     // violet
        [0, 1, 0.4],     // green
    ];

    for (let i = 0; i < count; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * 70;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 50;

        const c = palette[Math.floor(Math.random() * palette.length)];
        col[i * 3]     = c[0];
        col[i * 3 + 1] = c[1];
        col[i * 3 + 2] = c[2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size:           0.09,
        vertexColors:   true,
        transparent:    true,
        opacity:        0.55,
        blending:       THREE.AdditiveBlending,
        sizeAttenuation: true,
    });

    scene.add(new THREE.Points(geo, mat));
}

// ── Post-processing ────────────────────────────────────────────────────────
function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Gentle bloom – enough to make highlights glow without washing out detail
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        0.25,   // strength — subtle glow only
        0.4,    // radius
        0.65    // threshold — only hottest highlights bloom
    );
    composer.addPass(bloom);

    // Chromatic aberration – subtle lens fringing
    const rgbShift = new ShaderPass(RGBShiftShader);
    rgbShift.uniforms['amount'].value = 0.0018;
    composer.addPass(rgbShift);
}

// ── Events ─────────────────────────────────────────────────────────────────
function onMouseMove(e) {
    targetMouse.x =  (e.clientX / innerWidth)  * 2 - 1;
    targetMouse.y = -(e.clientY / innerHeight)  * 2 + 1;
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
        textRotY   = TEXT_ROT_MAX;
        textRotDir = -1;               // hit right limit → reverse to counter-clockwise
    } else if (textRotY <= TEXT_ROT_MIN) {
        textRotY   = TEXT_ROT_MIN;
        textRotDir =  1;               // hit left limit  → reverse to clockwise
    }

    // Gentle float on the text group (position stays centred)
    if (textGroup) {
        textGroup.position.x = 0;
        textGroup.position.y = Math.sin(t * 0.45) * 0.35;
        textGroup.rotation.y = textRotY;                      // ping-pong Y
        textGroup.rotation.z = Math.sin(t * 0.12) * 0.018;   // subtle Z-roll
    }

    // Orbit the iridescent accent lights around the text
    iridLights.forEach((light) => {
        const angle = t * light.userData.speed + light.userData.phase;
        const r     = light.userData.radius;
        light.position.set(
            Math.cos(angle) * r,
            Math.sin(angle * 1.7) * r * 0.55,
            Math.sin(angle) * (r * 0.5) + 5
        );
    });

    controls.update();
    composer.render();
}
