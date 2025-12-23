import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.autoClearColor = false; // for glow trails
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.00012);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1e6
);
camera.position.set(0, 400, 900);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 60;
controls.maxDistance = 9000;

// ---------- background stars ----------
function makeStars(count = 2500) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 6000 * Math.random() ** 0.55;
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
    opacity: 0.35
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
}
makeStars();

// ---------- sun ----------
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(22, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffdd55 })
);
scene.add(sun);

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(55, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffdd55,
    transparent: true,
    opacity: 0.12
  })
);
scene.add(sunGlow);

// ---------- planet + moon data ----------
const planetSystems = [
  {
    name: 'Earth',
    color: 0x88bbff,
    radius: 120,
    orbitalSpeed: 1.0,
    tiltPhase: 0.4,
    moons: [
      { name: 'Moon', color: 0xffffff, r: 26, speed: 12.0 }
    ]
  },
  {
    name: 'Mars',
    color: 0xff6666,
    radius: 160,
    orbitalSpeed: 0.53,
    tiltPhase: 1.2,
    moons: [
      { name: 'Phobos', color: 0xffddaa, r: 18, speed: 18.0 },
      { name: 'Deimos', color: 0xffbb88, r: 26, speed: 11.0 }
    ]
  },
  {
    name: 'Jupiter',
    color: 0xffcc88,
    radius: 230,
    orbitalSpeed: 0.084,
    tiltPhase: 2.1,
    moons: [
      { name: 'Io',       color: 0xffeeaa, r: 32, speed: 34.0 },
      { name: 'Europa',   color: 0xbbddff, r: 40, speed: 25.0 },
      { name: 'Ganymede', color: 0xddddff, r: 48, speed: 19.0 },
      { name: 'Callisto', color: 0xbbbbbb, r: 58, speed: 15.0 }
    ]
  },
  {
    name: 'Saturn',
    color: 0xfff7c0,
    radius: 310,
    orbitalSpeed: 0.034,
    tiltPhase: 2.8,
    moons: [
      { name: 'Titan',    color: 0xffe6aa, r: 56, speed: 21.0 },
      { name: 'Enceladus',color: 0xddeeff, r: 40, speed: 28.0 }
    ]
  },
  {
    name: 'Uranus',
    color: 0xa0ffff,
    radius: 370,
    orbitalSpeed: 0.012,
    tiltPhase: 3.6,
    moons: [
      { name: 'Titania', color: 0xcceeff, r: 44, speed: 19.0 }
    ]
  },
  {
    name: 'Neptune',
    color: 0x6688ff,
    radius: 420,
    orbitalSpeed: 0.006,
    tiltPhase: 4.2,
    moons: [
      { name: 'Triton', color: 0xccddff, r: 46, speed: 23.0 }
    ]
  }
];

// ---------- build meshes + trails ----------
const speedScale = 0.0007;
const trailLength = 2600;

const systems = [];

for (let s = 0; s < planetSystems.length; s++) {
  const pDef = planetSystems[s];

  // planet point (small, just a glowing dot, no orbit trail)
  const pMesh = new THREE.Mesh(
    new THREE.SphereGeometry(7, 16, 16),
    new THREE.MeshBasicMaterial({ color: pDef.color })
  );
  scene.add(pMesh);

  const system = {
    def: pDef,
    mesh: pMesh,
    angle: Math.random() * Math.PI * 2,
    irrational: Math.sqrt(2 + s * 0.37),
    moons: []
  };

  // moons for this planet
  pDef.moons.forEach((mDef, mi) => {
    const mMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 12, 12),
      new THREE.MeshBasicMaterial({ color: mDef.color })
    );
    scene.add(mMesh);

    const positions = new Float32Array(trailLength * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: mDef.color,
      transparent: true,
      opacity: 0.9
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);

    system.moons.push({
      def: mDef,
      mesh: mMesh,
      positions,
      trail,
      index: 0,
      angle: Math.random() * Math.PI * 2,
      irrational: Math.sqrt(3.1 + mi * 0.51)
    });
  });

  systems.push(system);
}

// ---------- animation ----------
let lastTime = performance.now();
let globalTime = 0;

function update(dt) {
  globalTime += dt;

  systems.forEach((sys, si) => {
    const pd = sys.def;

    // planet motion around Sun (slight ellipse + vertical wobble)
    const wPlanet = pd.orbitalSpeed * speedScale * sys.irrational;
    sys.angle += wPlanet * dt;

    const ellipseFactor = 1.0 + 0.18 * Math.sin(globalTime * 0.000025 + si);
    const px = Math.cos(sys.angle) * pd.radius * ellipseFactor;
    const pz = Math.sin(sys.angle) * pd.radius;
    const py = 18 * Math.sin(sys.angle * 0.4 + pd.tiltPhase);

    sys.mesh.position.set(px, py, pz);

    // moons: draw the flowers
    sys.moons.forEach((moon, mi) => {
      const md = moon.def;
      const wMoon = md.speed * speedScale * moon.irrational;
      moon.angle += wMoon * dt;

      // local orbit plane rotated differently per moon
      const localTilt = 0.4 + 0.35 * mi;
      const mxLocal = Math.cos(moon.angle) * md.r;
      const mzLocal = Math.sin(moon.angle) * md.r;
      const myLocal = Math.sin(moon.angle * 0.7 + localTilt) * (md.r * 0.3);

      const mx = px + mxLocal;
      const my = py + myLocal;
      const mz = pz + mzLocal;

      moon.mesh.position.set(mx, my, mz);

      // update trail circular buffer
      moon.index = (moon.index + 1) % trailLength;
      const i3 = moon.index * 3;
      moon.positions[i3]     = mx;
      moon.positions[i3 + 1] = my;
      moon.positions[i3 + 2] = mz;

      moon.trail.geometry.attributes.position.needsUpdate = true;
    });
  });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  // long-exposure fade
  renderer.setClearColor(0x000000, 0.06);
  renderer.clearColor();

  update(dt);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// ---------- resize ----------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
