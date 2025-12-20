// --- basic setup ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 4K on big screens
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.00015);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1e6
);
camera.position.set(0, 400, 900);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 50;
controls.maxDistance = 8000;

// --- subtle starfield background ---
function makeStars(count = 2000) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 5000 * Math.random() ** 0.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 3,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.4
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
}
makeStars();

// --- sun ---
const sunGeo = new THREE.SphereGeometry(20, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
const sun = new THREE.Mesh(sunGeo, sunMat);
scene.add(sun);

// halo
const sunHaloGeo = new THREE.SphereGeometry(45, 32, 32);
const sunHaloMat = new THREE.MeshBasicMaterial({
  color: 0xffdd55,
  transparent: true,
  opacity: 0.12
});
const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
scene.add(sunHalo);

// --- planet definitions (scaled, not realistic units) ---
const planetsData = [
  { name: "Mercury", color: 0xffaa88, radius: 60, speed: 4.15 },
  { name: "Venus",   color: 0xffe0aa, radius: 90, speed: 1.63 },
  { name: "Earth",   color: 0x88bbff, radius: 120, speed: 1.0 },
  { name: "Mars",    color: 0xff6666, radius: 150, speed: 0.53 },
  { name: "Jupiter", color: 0xffcc88, radius: 210, speed: 0.084 },
  { name: "Saturn",  color: 0xfff0c0, radius: 270, speed: 0.034 },
  { name: "Uranus",  color: 0xa0ffff, radius: 320, speed: 0.012 },
  { name: "Neptune", color: 0x6688ff, radius: 360, speed: 0.006 }
];

// we exaggerate speed ratios using powers to create rich interference patterns
const speedScale = 0.0007;
const trailLength = 2000; // points per trail

// each planet: a small sphere + dynamic trail
const planets = [];

planetsData.forEach((p) => {
  const g = new THREE.SphereGeometry(5, 16, 16);
  const m = new THREE.MeshBasicMaterial({ color: p.color });
  const mesh = new THREE.Mesh(g, m);
  scene.add(mesh);

  const trailGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(trailLength * 3);
  trailGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const trailMat = new THREE.LineBasicMaterial({
    color: p.color,
    transparent: true,
    opacity: 0.8
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  scene.add(trail);

  planets.push({
    ...p,
    mesh,
    trail,
    positions,
    index: 0,
    angle: Math.random() * Math.PI * 2
  });
});

// --- infinite dance update ---
let lastTime = performance.now();
let globalTime = 0;

function updatePlanets(dt) {
  globalTime += dt;

  planets.forEach((p, idx) => {
    // orbital speed: tweak with small irrational offsets
    const irrational = Math.sqrt(2 + idx * 0.3);
    const w = p.speed * speedScale * irrational;

    p.angle += w * dt;

    // elliptical exaggeration for nicer patterns
    const e = 1.0 + 0.1 * Math.sin(globalTime * 0.00003 + idx);
    const x = Math.cos(p.angle) * p.radius * e;
    const z = Math.sin(p.angle) * p.radius;
    const y = 12 * Math.sin(p.angle * 0.5 + idx); // slight vertical wobble

    p.mesh.position.set(x, y, z);

    // update trail circular buffer
    const pos = p.positions;
    p.index = (p.index + 1) % trailLength;
    const i3 = p.index * 3;
    pos[i3] = x;
    pos[i3 + 1] = y;
    pos[i3 + 2] = z;

    // write fading along the buffer
    const attr = p.trail.geometry.getAttribute("position");
    attr.needsUpdate = true;

    // fade opacity along trail using vertex colors approximation via line segments:
    // instead, here we simulate fading by occasionally shrinking older points
    // (cheaper than per-vertex color for this minimal version)
  });
}

// subtle long-exposure effect: do NOT clear fully each frame
renderer.autoClearColor = false;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  // fade old frame slightly to create glowing trails
  renderer.setClearColor(0x000000, 0.08);
  renderer.clearColor();

  updatePlanets(dt);

  controls.update();
  renderer.render(scene, camera);
}

animate();

// --- handle resize ---
window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
