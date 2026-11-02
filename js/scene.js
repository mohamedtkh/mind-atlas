// The 3D view. When a page has its concept card, the card itself becomes the 3D model: the
// picture is lifted into a relief using its depth map, so it looks like the card. Pages without
// a card use a simple figure. Each frame, the motion from motion.js is applied. One WebGL
// renderer is used per open page, and it is released when the page closes, because phones
// limit how many WebGL contexts they keep.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { poseFor, hash } from "./motion.js";

const TAU = Math.PI * 2;
const CALM_INTENSITY = 0.45; // calm mode: smaller movements
const CALM_TIME_SCALE = 0.6; // calm mode: a slower clock
const RELIEF_HEIGHT = 2.7; // the card's height in the scene, in world units
const RELIEF_DEPTH = 0.8; // how far the nearest parts of the card stand out from the farthest
const RELIEF_CENTER_Y = 1.4;

let sprite = null;
function softSprite() {
  if (sprite) return sprite;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  sprite = new THREE.CanvasTexture(canvas);
  sprite.colorSpace = THREE.SRGBColorSpace;
  return sprite;
}

export function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const PARTICLES = {
  fog: { count: 60, size: 2.6, opacity: 0.12, spread: [6, 3, 6], speed: 0.05 },
  sparks: { count: 140, size: 0.09, opacity: 0.9, spread: [4, 3.2, 4], speed: 0.3 },
  dust: { count: 160, size: 0.055, opacity: 0.55, spread: [5, 3.4, 5], speed: 0.1 },
};

function makeParticles(kind, color) {
  const cfg = PARTICLES[kind];
  if (!cfg) return null;
  const [sx, sy, sz] = cfg.spread;
  const n = cfg.count;
  const base = new Float32Array(n * 3);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    base[i * 3] = (hash(i * 3 + 1) - 0.5) * sx;
    base[i * 3 + 1] = hash(i * 3 + 2) * sy;
    base[i * 3 + 2] = (hash(i * 3 + 3) - 0.5) * sz;
    phase[i] = hash(i * 7 + 11) * TAU;
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  geometry.setAttribute("position", position);
  const material = new THREE.PointsMaterial({
    color,
    map: softSprite(),
    size: cfg.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: cfg.opacity,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const update = (t) => {
    const a = position.array;
    for (let i = 0; i < n; i += 1) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      const p = phase[i];
      if (kind === "sparks") {
        a[i * 3] = x + Math.sin(0.9 * t + p) * 0.15;
        a[i * 3 + 1] = (y + t * cfg.speed) % sy;
        a[i * 3 + 2] = z + Math.cos(0.7 * t + p) * 0.15;
      } else if (kind === "dust") {
        a[i * 3] = x + Math.sin(0.2 * t + p) * 0.3;
        a[i * 3 + 1] = (((y - t * cfg.speed) % sy) + sy) % sy;
        a[i * 3 + 2] = z + Math.cos(0.15 * t + p) * 0.3;
      } else {
        a[i * 3] = x + Math.sin(cfg.speed * t + p) * 0.8;
        a[i * 3 + 1] = y + Math.sin(cfg.speed * 0.7 * t + 2 * p) * 0.25;
        a[i * 3 + 2] = z + Math.cos(cfg.speed * t + p) * 0.8;
      }
    }
    position.needsUpdate = true;
  };
  update(0);
  return { object: points, update };
}

// The generic figure, for pages that have no concept card. It is deliberately simple: a head,
// a torso, and four limbs on pivots.
function makeFigure(material) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.0;
  root.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.6, 8, 20), material);
  torso.position.y = 0.56;
  hips.add(torso);

  const neck = new THREE.Group();
  neck.position.y = 1.12;
  hips.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 40, 28), material);
  head.position.y = 0.22;
  neck.add(head);

  // A limb hangs from a pivot at the joint, so it can swing from there.
  const limb = (x, y, radius, drop) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    hips.add(pivot);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 0.7, 6, 14), material);
    mesh.position.y = drop;
    pivot.add(mesh);
    return pivot;
  };
  const arms = [limb(-0.38, 0.95, 0.08, -0.36), limb(0.38, 0.95, 0.08, -0.36)];
  const legs = [limb(-0.14, 0, 0.12, -0.47), limb(0.14, 0, 0.12, -0.47)];
  return { root, hips, torso, neck, arms, legs };
}

function posePerson(figure, pose) {
  figure.root.position.set(pose.jitter[0], pose.bob + pose.jitter[1], pose.jitter[2]);
  figure.hips.rotation.set(pose.lean, 0, pose.sway);
  figure.torso.scale.y = 1 + pose.breath;
  figure.neck.rotation.set(pose.headTilt, pose.headYaw, 0);
  figure.arms[0].rotation.x = pose.armAngle + pose.armSwing;
  figure.arms[1].rotation.x = pose.armAngle - pose.armSwing;
  figure.legs[0].rotation.x = pose.legStep;
  figure.legs[1].rotation.x = -pose.legStep;
}

// Effects around the figure. Each one stays hidden or at zero opacity unless its motion asks for it.
function makeEffects(palette) {
  const group = new THREE.Group();
  const accent = new THREE.Color(palette.accent);

  // A flat ring on the floor (panic, night).
  const ringGeometry = new THREE.RingGeometry(0.97, 1, 128);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.y = 0.02;
  ring.visible = false;
  group.add(ring);

  // Small spheres circling the head (obsessive loops).
  const thoughtGeometry = new THREE.SphereGeometry(0.1, 20, 14);
  const thoughtMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.4 });
  const thoughts = Array.from({ length: 8 }, () => {
    const mesh = new THREE.Mesh(thoughtGeometry, thoughtMaterial);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });

  // Memory fragments around the figure (trauma). On a card page they show the card itself.
  const fragmentGeometry = new THREE.PlaneGeometry(0.95, 0.62);
  const fragments = [
    [-1.8, 1.9, -0.6],
    [1.7, 2.2, -0.8],
    [-1.4, 0.9, 0.9],
    [1.6, 1.2, 1.0],
    [0.2, 2.7, -1.6],
  ].map((at) => {
    const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(fragmentGeometry, material);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.lookAt(0, at[1], 0);
    group.add(mesh);
    return { mesh, material };
  });

  // Discs that face the figure from all around the room (social anxiety).
  const watchGeometry = new THREE.CircleGeometry(0.14, 24);
  const watchMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * TAU;
    const mesh = new THREE.Mesh(watchGeometry, watchMaterial);
    mesh.position.set(Math.cos(angle) * 3.4, 1.1 + hash(i + 3) * 1.6, Math.sin(angle) * 3.4);
    mesh.lookAt(0, 1.2, 0);
    group.add(mesh);
  }

  // A pane of glass in front of the figure (depersonalization).
  const veilMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.fog), transparent: true, opacity: 0, roughness: 0.15, depthWrite: false });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), veilMaterial);
  veil.position.set(0, 1.3, 1.1);
  veil.visible = false;
  group.add(veil);

  // Points that attention jumps between (ADHD).
  const attentionGeometry = new THREE.SphereGeometry(0.12, 18, 12);
  const attentionMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6, roughness: 0.3 });
  const attention = Array.from({ length: 6 }, () => {
    const mesh = new THREE.Mesh(attentionGeometry, attentionMaterial);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });

  return { group, ring, ringMaterial, thoughts, fragments, watchMaterial, veil, veilMaterial, attention };
}

function applyEffects(fx, pose) {
  if (pose.ring) {
    fx.ring.visible = true;
    fx.ring.scale.set(pose.ring.radius, 1, pose.ring.radius);
    fx.ringMaterial.opacity = pose.ring.opacity;
  } else {
    fx.ring.visible = false;
  }

  fx.thoughts.forEach((mesh, i) => {
    mesh.visible = Boolean(pose.thoughts);
    if (!pose.thoughts) return;
    const angle = pose.thoughts.spin + (i / fx.thoughts.length) * TAU;
    mesh.position.set(Math.cos(angle) * pose.thoughts.radius, pose.thoughts.height, Math.sin(angle) * pose.thoughts.radius);
  });

  fx.fragments.forEach((fragment, i) => {
    fragment.material.opacity = pose.fragments ? pose.fragments[i] : 0;
  });

  fx.watchMaterial.opacity = pose.watchers;
  fx.veilMaterial.opacity = pose.veil;
  fx.veil.visible = pose.veil > 0;

  fx.attention.forEach((mesh, i) => {
    mesh.visible = Boolean(pose.attention);
    if (pose.attention) mesh.position.set(...pose.attention[i]);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

// Reads the red channel of a grayscale depth picture: 0 is far, 255 is near.
function readDepth(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < values.length; i += 1) values[i] = pixels[i * 4];
  return { width: canvas.width, height: canvas.height, values };
}

// Builds the card as a 3D relief: the card's picture is the surface, and the depth map
// moves each part of it toward or away from the viewer.
async function buildRelief(colorUrl, depthUrl, palette, fragments) {
  const [colorImage, depthImage] = await Promise.all([
    loadImage(colorUrl),
    depthUrl ? loadImage(depthUrl).catch(() => null) : null,
  ]);

  const texture = new THREE.Texture(colorImage);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const aspect = colorImage.naturalWidth / colorImage.naturalHeight;
  const width = RELIEF_HEIGHT * aspect;
  const segmentsX = 160;
  const segmentsY = Math.max(8, Math.round(segmentsX / aspect));
  const geometry = new THREE.PlaneGeometry(width, RELIEF_HEIGHT, segmentsX, segmentsY);

  if (depthImage) {
    const depth = readDepth(depthImage);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const u = position.getX(i) / width + 0.5;
      const v = position.getY(i) / RELIEF_HEIGHT + 0.5;
      const col = Math.min(depth.width - 1, Math.max(0, Math.round(u * (depth.width - 1))));
      const row = Math.min(depth.height - 1, Math.max(0, Math.round((1 - v) * (depth.height - 1))));
      const near = depth.values[row * depth.width + col] / 255;
      position.setZ(i, (near - 0.5) * RELIEF_DEPTH);
    }
    geometry.computeVertexNormals();
  }

  // The card's own picture is also used as the light it gives off, so its colors read the same
  // as the picture. The lights then add the shading that gives the relief its depth.
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    color: 0xffffff,
    emissive: new THREE.Color(0.4, 0.4, 0.4),
    emissiveMap: texture,
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));

  // The memory fragments show the card itself, in its own colors and proportions.
  for (const fragment of fragments) {
    fragment.material.map = texture;
    fragment.material.color.set(0xffffff);
    fragment.material.needsUpdate = true;
    fragment.mesh.scale.set((0.9 * aspect) / 0.95, 0.9 / 0.62, 1);
  }

  return { group, material, texture, accent: new THREE.Color(palette.accent) };
}

function poseRelief(relief, pose) {
  const g = relief.group;
  g.position.set(pose.jitter[0], RELIEF_CENTER_Y + pose.bob + pose.jitter[1], pose.jitter[2]);
  g.rotation.set(pose.lean * 0.6 + pose.headTilt * 0.3, pose.headYaw + pose.armSwing * 0.4, pose.sway);
  const breath = 1 + pose.breath;
  g.scale.set(breath, breath, breath);
  relief.material.color.set(0xffffff).lerp(relief.accent, pose.tint * 0.5);
  const glow = pose.ring ? pose.ring.opacity * 0.6 : 0;
  relief.material.emissive.copy(relief.accent).multiplyScalar(glow);
}

// Releases geometry and materials. Textures are shared, so they are kept.
function disposeTree(root) {
  root.traverse((node) => {
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) material.dispose();
  });
  root.clear();
}

// Returns null when the device has no WebGL, so the page can show its text instead.
// `relief` is { color, depth } with picture URLs, or null for the generic figure.
// Returns { setPaused, setCalm, resetView, dispose } otherwise.
export function createFeelView(container, { entry, calm = false, paused = false, relief: reliefSources = null }) {
  if (!webglAvailable()) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `${entry.name}. ${entry.scene.caption}`);
  container.replaceChildren(canvas);

  const scene = new THREE.Scene();
  const palette = entry.scene.palette;
  scene.background = new THREE.Color(palette.background);
  scene.fog = new THREE.FogExp2(new THREE.Color(palette.fog), 0.07);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const homePosition = new THREE.Vector3(0, 2.4, 7.2);
  const homeTarget = new THREE.Vector3(0, 1.3, 0);
  camera.position.copy(homePosition);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 10;
  controls.autoRotateSpeed = 0.5;
  controls.update();

  const world = new THREE.Group();
  scene.add(world);

  const hemisphere = new THREE.HemisphereLight(0xffffff, new THREE.Color(palette.ground), 1.8);
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 6, 5);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
  fill.position.set(-4, 3, -3);
  const spot = new THREE.SpotLight(0xfff1d6, 240, 25, 0.45, 0.6, 1.2);
  spot.position.set(0, 8, 4);
  spot.target.position.set(0, 1.2, 0);
  spot.visible = entry.scene.style === "spotlight";
  world.add(hemisphere, key, fill, spot, spot.target);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 96),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.ground), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  world.add(ground);

  const figureMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.figure), roughness: 0.65, metalness: 0.02 });
  const figure = makeFigure(figureMaterial);
  world.add(figure.root);

  const effects = makeEffects(palette);
  world.add(effects.group);

  const particles = makeParticles(entry.scene.particles, new THREE.Color(palette.accent));
  if (particles) world.add(particles.object);

  const figureColor = new THREE.Color(palette.figure);
  const accentColor = new THREE.Color(palette.accent);
  const style = entry.scene.style;
  let time = 0;
  let last = performance.now();
  let frameId = 0;
  let relief = null;
  let disposed = false;

  // The card loads in the background. The generic figure stays until it is ready.
  if (reliefSources) {
    buildRelief(reliefSources.color, reliefSources.depth, palette, effects.fragments)
      .then((built) => {
        if (disposed) {
          built.texture.dispose();
          disposeTree(built.group);
          return;
        }
        relief = built;
        world.add(relief.group);
        figure.root.visible = false;
        // Frame the card, which is taller than the figure was.
        homePosition.set(0, RELIEF_CENTER_Y, 5.4);
        homeTarget.set(0, RELIEF_CENTER_Y, 0);
        camera.position.copy(homePosition);
        controls.target.copy(homeTarget);
        controls.update();
      })
      .catch(() => {
        // The card could not be loaded, so the generic figure stays.
      });
  }

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) time += dt * (calm ? CALM_TIME_SCALE : 1);

    const pose = poseFor(style, time, calm ? CALM_INTENSITY : 1);
    if (relief) {
      poseRelief(relief, pose);
    } else {
      posePerson(figure, pose);
      figureMaterial.color.copy(figureColor).lerp(accentColor, 0.5 * pose.tint);
    }
    applyEffects(effects, pose);
    particles?.update(time);

    controls.autoRotate = !paused && !calm;
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);

  return {
    setPaused(value) {
      paused = Boolean(value);
    },
    setCalm(value) {
      calm = Boolean(value);
    },
    resetView() {
      camera.position.copy(homePosition);
      controls.target.copy(homeTarget);
      controls.update();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      if (relief) relief.texture.dispose();
      disposeTree(world);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
