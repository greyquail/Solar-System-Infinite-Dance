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

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1e6
);
camera.position.set(0, 280, 820);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 60;
controls.maxDistance = 9000;

// ---------- sun ----------
const sun = new THREE.Mesh(
  new THREE.SphereGeometry(20, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffdd55 })
);
scene.add(sun);

const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(52, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffdd55,
    transparent: true,
    opacity: 0.15
  })
);
scene.add(sunGlow);

// ---------- planet + moon data (ratios approximate real system) ----------
const planetSystems = [
  // orbitalSpeed ~ 1 / orbitalPeriod; radius scaled
  {
    name: 'Mercury',
    color: 0xc9c3b8,
    radius: 70,
    orbitalSpeed: 4.15,    // 88 days
    tiltPhase: 0.2,
    moons: []              // none
  },
  {
    name: 'Venus',
    color: 0xf6d9b5,
    radius: 95,
    orbitalSpeed: 1.62,    // 225 days
    tiltPhase: 0.6,
    moons: []              // none
  },
  {
    name: 'Earth',
    color: 0x4fa7ff,
    radius: 120,
    orbitalSpeed: 1.0,     // 365 days
    tiltPhase: 0.9,
    moons: [
      // period ratio ≈ 27.3 / 365 -> sped up but same proportion
      { name: 'Moon', color: 0xfafafa, r: 26, speed: 13.4 }
    ]
  },
  {
    name: 'Mars',
    color: 0xd2553f,
    radius: 150,
    orbitalSpeed: 0.53,    // 687 days
    tiltPhase: 1.4,
    moons: [
      { name: 'Phobos', color: 0xffddaa, r: 18, speed: 18.0 }, // fast inner
      { name: 'Deimos', color: 0xffbb88, r: 26, speed: 11.0 }  // slower outer
    ]
  },
  {
    name: 'Jupiter',
    color: 0xd8b483,
    radius: 210,
    orbitalSpeed: 0.084,   // 11.86 years
    tiltPhase: 2.0,
    moons: [
      // Galilean moons with 1:2:4 resonance approximated
      { name: 'Io',       color: 0xffeeaa, r: 30, speed: 40.0 },
      { name: 'Europa',   color: 0xbbddff, r: 38, speed: 20.0 },
      { name: 'Ganymede', color: 0xddddff, r: 46, speed: 10.0 },
      { name: 'Callisto', color: 0xbbbbbb, r: 56, speed: 5.0  }
    ]
  },
  {
    name: 'Saturn',
    color: 0xe7d8aa,
    radius: 270,
    orbitalSpeed: 0.034,   // 29.5 years
    tiltPhase: 2.6,
    moons: [
      { name: 'Titan',     color: 0xffe6aa, r: 54, speed: 7.0 },
      { name: 'Enceladus', color: 0xddeeff, r: 36, speed: 18.0 }
    ]
  },
  {
    name: 'Uranus',
    color: 0x88f0ff,
    radius: 320,
    orbitalSpeed: 0.012,   // 84 years
    tiltPhase: 3.2,
    moons: [
      { name: 'Titania', color: 0xcceeff, r: 42, speed: 9.0 }
    ]
  },
  {
    name: 'Neptune',
    color: 0x597dff,
    radius: 360,
    orbitalSpeed: 0.006,   // 165 years
    tiltPhase: 3.8,
    moons: [
      { name: 'Triton', color: 0xccddff, r: 44, speed: 11.0 }
    ]
  }
];

// ---------- build meshes + trails ----------
const speedScale = 0.0007;
const trailLength = 4800; // long, smooth flowers
const systems = [];

for (let s = 0; s < planetSystems.length; s++) {
  const pDef = planetSystems[s];

  const pMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 16),
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

  pDef.moons.forEach((mDef, mi) => {
    const mMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: mDef.color })
    );
    scene.add(mMesh);

    const positions = new Float32Array(trailLength * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: mDef.color,
      transparent: true,
      opacity: 0.32,
      linewidth: 1
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

    // planet motion around Sun (ellipse + wobble, using realistic-ish speed ratios)
    const wPlanet = pd.orbitalSpeed * speedScale * sys.irrational;
    sys.angle += wPlanet * dt;

    const ellipseFactor = 1.0 + 0.10 * Math.sin(globalTime * 0.00002 + si);
    const px = Math.cos(sys.angle) * pd.radius * ellipseFactor;
    const pz = Math.sin(sys.angle) * pd.radius;
    const py = 14 * Math.sin(sys.angle * 0.4 + pd.tiltPhase);

    sys.mesh.position.set(px, py, pz);

    // moons: pure epicycle flowers
    sys.moons.forEach((moon, mi) => {
      const md = moon.def;
      const wMoon = md.speed * speedScale * moon.irrational;
      moon.angle += wMoon * dt;

      // orbit plane tilt per moon
      const localTilt = 0.5 + 0.45 * mi;

      // radial modulation -> petals, but small so it still feels physical
      const lobes = 5 + mi * 2;
      const radialMod = 1.0 + 0.16 * Math.sin(lobes * moon.angle + si * 0.7);

      const mxLocal = Math.cos(moon.angle) * md.r * radialMod;
      const mzLocal = Math.sin(moon.angle) * md.r * radialMod;
      const myLocal = Math.sin(moon.angle * 0.7 + localTilt) * (md.r * 0.22);

      const mx = px + mxLocal;
      const my = py + myLocal;
      const mz = pz + mzLocal;

      moon.mesh.position.set(mx, my, mz);

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

  // long‑exposure style fade (very subtle, never fully clearing)
  renderer.setClearColor(0x000000, 0.028);
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
