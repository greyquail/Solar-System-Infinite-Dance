import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- basic setup ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 50;
controls.maxDistance = 8000;

// --- starfield ---
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
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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

const sunHaloGeo = new THREE.SphereGeometry(45, 32, 32);
const sunHaloMat = new THREE.MeshBasicMaterial({
  color: 0xffdd55,
  transparent: true,
  opacity: 0.12
});
const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
scene.add(sunHalo);

// --- planets ---
const planetsData = [
  { name: 'Mercury', color: 0xffaa88, radius: 60,  speed: 4.15 },
  { name: 'Venus',   color: 0xffe0aa, radius: 90,  speed: 1.63 },
  { name: 'Earth',   color: 0x88bbff, radius: 120, speed: 1.00 },
  { name: 'Mars',    color: 0xff6666, radius: 150, speed: 0.53 },
  { name: 'Jupiter', color: 0xffcc88, radius: 210, speed: 0.084 },
  { name: 'Saturn',  color: 0xfff0c0, radius: 270, speed: 0.034 },
  { name: 'Uranus',  color: 0xa0ffff, radius: 320, speed: 0.012 },
  { name: 'Neptune', color: 0x6688ff, radius: 360, speed: 0.006 }
];

const speedScale = 0.0007;
const trailLength = 2000;
const planets = [];

planetsData.forEach((p, idx) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 16),
    new THREE.MeshBasicMaterial({ color: p.color })
  );
  scene.add(mesh);

  const positions = new Float32Array(trailLength * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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
    angle: Math.random() * Math.PI * 2,
    irrational: Math.sqrt(2 + idx * 0.3)
  });
});

// --- animation ---
let lastTime = performance.now();
let globalTime = 0;

renderer.autoClearColor = false;

function updatePlanets(dt) {
  globalTime += dt;

  planets.forEach((p, idx) => {
    const w = p.speed * speedScale * p.irrational;
    p.angle += w * dt;

    const e = 1.0 + 0.1 * Math.sin(globalTime * 0.00003 + idx);
    const x = Math.cos(p.angle) * p.radius * e;
    const z = Math.sin(p.angle) * p.radius;
    const y = 12 * Math.sin(p.angle * 0.5 + idx);

    p.mesh.position.set(x, y, z);

    p.index = (p.index + 1) % trailLength;
    const i3 = p.index * 3;
    p.positions[i3]     = x;
    p.positions[i3 + 1] = y;
    p.positions[i3 + 2] = z;

    p.trail.geometry.attributes.position.needsUpdate = true;
  });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  renderer.setClearColor(0x000000, 0.08);
  renderer.clearColor();

  updatePlanets(dt);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
