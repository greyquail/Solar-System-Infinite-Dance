import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ------------ physical + visual scale ------------
const G = 6.67430e-11;      // real G, but we will rescale
const M_SUN = 1.9885e30;
const AU     = 1.495978707e11;

// we rescale to keep numbers comfortable for JS
const POS_SCALE = 1 / AU;          // meters -> AU
const MASS_SCALE = 1 / M_SUN;      // kg -> solar masses
const G_SCALED = G * M_SUN * POS_SCALE * POS_SCALE * POS_SCALE; // rough

// time step: seconds per simulation step
const DT = 60 * 60 * 6; // 6 hours

// ------------ renderer, scene, camera ------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.autoClearColor = false;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.01,
  1e6
);
camera.position.set(0, 60, 220);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 20;
controls.maxDistance = 2000;

// convert physical AU units to scene units
const SCENE_SCALE = 200; // AU * SCENE_SCALE -> units on screen

function physToScene(posAU) {
  return posAU.clone().multiplyScalar(SCENE_SCALE);
}

// ------------ body definition ------------
// data from typical solar system tables, simplified ratios [web:150][web:179]
function makeBodies() {
  const bodies = [];

  // Sun
  bodies.push({
    name: 'Sun',
    mass: 1.0, // solar masses
    pos: new THREE.Vector3(0, 0, 0),
    vel: new THREE.Vector3(0, 0, 0),
    color: 0xffdd55,
    radiusScene: 6,
    trailColor: 0xffdd55
  });

  // Mercury
  bodies.push(planetCircular(
    'Mercury',
    0.055,            // mass Msun
    0.387,            // a (AU)
    0.2056,           // e
    0.2408,           // period (yr)
    0.122,            // inclination (rad ~7deg)
    0xc9c3b8
  ));

  // Venus
  bodies.push(planetCircular(
    'Venus',
    0.815 / 332946,   // Msun
    0.723,
    0.0068,
    0.615,
    0.059,            // ~3.4°
    0xf6d9b5
  ));

  // Earth
  bodies.push(planetCircular(
    'Earth',
    1 / 332946,       // Msun
    1.0,
    0.0167,
    1.0,
    0.0,
    0x4fa7ff
  ));

  // Mars
  bodies.push(planetCircular(
    'Mars',
    0.107 / 332946,
    1.524,
    0.0934,
    1.881,
    0.032,            // ~1.85°
    0xd2553f
  ));

  // Moon as body orbiting Earth
  const earth = bodies.find(b => b.name === 'Earth');
  const moonDistanceAU = 384400000 * POS_SCALE;       // m -> AU
  const moonOrbitalPeriodDays = 27.32;
  const moonPeriod = moonOrbitalPeriodDays / 365.25; // years

  const moonSpeed =
    2 * Math.PI * moonDistanceAU / (moonPeriod * 365.25 * 24 * 3600);

  const moonDir = new THREE.Vector3(0, 0, 1); // orthogonal to Earth's radius
  const moonPos = earth.pos.clone().add(new THREE.Vector3(moonDistanceAU, 0, 0));
  const moonVel = earth.vel.clone().add(
    moonDir
      .clone()
      .multiplyScalar(moonSpeed * POS_SCALE)
  );

  bodies.push({
    name: 'Moon',
    mass: (7.34767309e22 * MASS_SCALE),
    pos: moonPos,
    vel: moonVel,
    color: 0xfafafa,
    radiusScene: 1.5,
    trailColor: 0xffffff
  });

  return bodies;
}

// helper: create approximate elliptical orbit with circular speed in plane
function planetCircular(name, massSolar, aAU, e, periodYears, incRad, color) {
  const a = aAU;
  const r = a * (1 - e);          // start near perihelion
  const pos = new THREE.Vector3(r, 0, 0);

  const Tsec = periodYears * 365.25 * 24 * 3600;
  const vCirc = 2 * Math.PI * a / Tsec;
  const vel = new THREE.Vector3(0, 0, vCirc * POS_SCALE);

  // incline orbit plane
  const rot = new THREE.Matrix4().makeRotationZ(incRad);
  pos.applyMatrix4(rot);
  vel.applyMatrix4(rot);

  return {
    name,
    mass: massSolar,
    pos,
    vel,
    color,
    radiusScene: 2.5,
    trailColor: color
  };
}

const bodies = makeBodies();

// ------------ meshes + trails ------------
const trailLength = 5000;

bodies.forEach(b => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(b.radiusScene, 16, 16),
    new THREE.MeshBasicMaterial({ color: b.color })
  );
  scene.add(mesh);
  b.mesh = mesh;

  const positions = new Float32Array(trailLength * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: b.trailColor,
    transparent: true,
    opacity: b.name === 'Sun' ? 0.15 : 0.38
  });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  b.trail = {
    positions,
    geo,
    index: 0
  };
});

// slight glow sphere for Sun
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(14, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffdd55,
    transparent: true,
    opacity: 0.15
  })
);
scene.add(sunGlow);
bodies.find(b => b.name === 'Sun').glow = sunGlow;

// ------------ leapfrog integrator ------------
function computeAccelerations() {
  const acc = bodies.map(() => new THREE.Vector3(0, 0, 0));

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const bi = bodies[i];
      const bj = bodies[j];

      const dx = bj.pos.clone().sub(bi.pos);
      const distSq = dx.lengthSq() + 1e-8;
      const invR3 = 1 / Math.pow(distSq, 1.5);

      const factor = G_SCALED * invR3;

      const ai = dx.clone().multiplyScalar(factor * bj.mass);
      const aj = dx.clone().multiplyScalar(-factor * bi.mass);

      acc[i].add(ai);
      acc[j].add(aj);
    }
  }
  return acc;
}

// initial accelerations
let acc = computeAccelerations();

// leapfrog: v(t+dt/2) -> x(t+dt) -> a(t+dt) -> v(t+dt)
function step(dt) {
  // half‑kick
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vel.add(acc[i].clone().multiplyScalar(dt / 2));
  }

  // drift
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].pos.add(bodies[i].vel.clone().multiplyScalar(dt));
  }

  // new acceleration
  acc = computeAccelerations();

  // half‑kick
  for (let i = 0; i < bodies.length; i++) {
    bodies[i].vel.add(acc[i].clone().multiplyScalar(dt / 2));
  }
}

// ------------ trails update ------------
function updateVisuals() {
  bodies.forEach(b => {
    const scenePos = physToScene(b.pos);
    b.mesh.position.copy(scenePos);

    if (b.glow) {
      b.glow.position.copy(scenePos);
    }

    const t = b.trail;
    t.index = (t.index + 1) % trailLength;
    const i3 = t.index * 3;
    t.positions[i3]     = scenePos.x;
    t.positions[i3 + 1] = scenePos.y;
    t.positions[i3 + 2] = scenePos.z;
    t.geo.attributes.position.needsUpdate = true;
  });
}

// ------------ animation loop ------------
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  let dtMs = now - lastTime;
  lastTime = now;

  // speed multiplier (makes patterns appear faster)
  const speedUp = 200; // tweak this
  let steps = Math.max(1, Math.floor((dtMs / 16) * 2));

  const dtSim = DT * speedUp / steps;

  for (let s = 0; s < steps; s++) {
    step(dtSim);
  }

  renderer.setClearColor(0x000000, 0.03);
  renderer.clearColor();

  updateVisuals();
  controls.update();
  renderer.render(scene, camera);
}

animate();

// ------------ resize ------------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
