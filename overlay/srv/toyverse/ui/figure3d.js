/* ToyMesh-3D-Figuren für den Setup-Assistenten (lustige Fassung).
 * Eigene, prozedurale Figur aus Grundformen mit menschlichen Zügen (Augen, Augenbrauen, Mund).
 * Je Oberfläche eigene Kleidung, Kopfbedeckung, Gegenstand und Bewegung. Lizenzfrei (three.js, MIT, lokal).
 * Ohne WebGL: mount() liefert null, der Aufrufer zeigt dann die 2D-Figur.
 * Keine externen Anfragen. */
import * as THREE from "../vendor/three/three.module.min.js";

// Themen je Oberfläche. hat/prop/idle sind Namen aus den Bauteilen unten.
var CFG = {
  toyclassic: { shirt: 0x3b82f6, pants: 0x1e293b, hat: "cap", accent: 0xf8fafc, prop: "tablet", idle: "wave" },
  toyaqua:    { shirt: 0x22d3ee, pants: 0x0e4f5c, hat: "visor", accent: 0x67e8f9, prop: "cup", idle: "bounce" },
  toyquest:   { shirt: 0x6d28d9, pants: 0x3b2a12, hat: "hood", accent: 0xd4af37, prop: "map", idle: "wave", cape: 0x9b5cff },
  toyplasma:  { shirt: 0x701a75, pants: 0x1f1027, hat: "headset", accent: 0xff4fd8, prop: "glow", idle: "spin" },
  toysafe:    { shirt: 0x047857, pants: 0x0f2e25, hat: "helmet", accent: 0x10b981, prop: "shield", idle: "nod" },
  toytiles:   { shirt: 0xd97706, pants: 0x3f2a0b, hat: "cube", accent: 0xfde68a, prop: "tiles", idle: "bounce" },
  toyguide:   { shirt: 0x2563eb, pants: 0x172554, hat: "bun", accent: 0xbfdbfe, prop: "book", idle: "wave" },
  toyfocus:   { shirt: 0x52525b, pants: 0x18181b, hat: "none", accent: 0xe4e4e7, prop: "none", idle: "breathe" },
  toydroid:   { shirt: 0x34d399, pants: 0x134e3a, hat: "band", accent: 0xa7f3d0, prop: "phone", idle: "bounce" },
  toydesk:    { shirt: 0x475569, pants: 0x1e293b, hat: "none", accent: 0xcbd5e1, prop: "bag", idle: "nod", tie: 0x0f172a }
};
var SKIN = 0xf1c9a5, HAIR = 0x2b1d14, EYE = 0x1a1a22;

function hasWebGL() {
  try {
    var c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch (e) { return false; }
}

function std(color, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.6, metalness: 0.05 }, extra || {}));
}
function glow(color) {
  return new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3 });
}
function mesh(geo, mat) { return new THREE.Mesh(geo, mat); }

// Baut die Figur. Rückgabe: Gelenke zum Animieren.
function build(cfg) {
  var root = new THREE.Group();
  var body = new THREE.Group();   // Körper (für Hüpfen und Drehen)
  root.add(body);

  // Kopf
  var head = new THREE.Group();
  head.position.set(0, 1.56, 0);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.32, 24, 18), std(SKIN)));

  // Haare (Kappe hinten)
  var hair = mesh(new THREE.SphereGeometry(0.335, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std(HAIR));
  hair.position.set(0, 0.04, -0.02);
  head.add(hair);

  // Augen mit Glanzpunkt, Augenbrauen, Mund
  var eyes = [];
  [-0.11, 0.11].forEach(function (x) {
    var eye = new THREE.Group();
    eye.position.set(x, 0.02, 0.285);
    eye.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), std(EYE)));
    var shine = mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.015, 0.02, 0.04);
    eye.add(shine);
    head.add(eye);
    eyes.push(eye);
    var brow = mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), std(HAIR));
    brow.position.set(x, 0.1, 0.29);
    head.add(brow);
  });
  // Nase und Ohren
  var nose = mesh(new THREE.SphereGeometry(0.035, 10, 8), std(SKIN));
  nose.position.set(0, -0.04, 0.315); head.add(nose);
  [-0.315, 0.315].forEach(function (x) {
    var ear = mesh(new THREE.SphereGeometry(0.06, 10, 8), std(SKIN));
    ear.position.set(x, -0.02, 0); head.add(ear);
  });
  var mouth = mesh(new THREE.TorusGeometry(0.075, 0.014, 6, 14, Math.PI), std(0x7a2e2e));
  mouth.rotation.z = Math.PI;      // untere Hälfte = Lächeln
  mouth.position.set(0, -0.13, 0.295);
  head.add(mouth);

  // Kopfbedeckung und Zubehör
  addHat(head, cfg);

  // Torso mit Kleidung
  var torso = mesh(new THREE.CapsuleGeometry(0.2, 0.48, 6, 12), std(cfg.shirt));
  torso.position.set(0, 1.08, 0);
  body.add(torso);
  if (cfg.tie) {
    var tie = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), std(cfg.tie));
    tie.position.set(0, 1.12, 0.2);
    body.add(tie);
  }

  // Umhang (nur ToyQuest)
  var cape = null;
  if (cfg.cape) {
    cape = mesh(new THREE.PlaneGeometry(0.55, 0.9), std(cfg.cape, { side: THREE.DoubleSide }));
    cape.position.set(0, 1.0, -0.2);
    body.add(cape);
  }

  // Arme (Schulter als Drehpunkt)
  var armR = armPivot(0.3, 1.27, cfg.shirt);
  var armL = armPivot(-0.3, 1.27, cfg.shirt);
  body.add(armR.pivot, armL.pivot);
  // Hände
  var handR = mesh(new THREE.SphereGeometry(0.08, 10, 8), std(SKIN));
  handR.position.set(0, -0.5, 0);
  armR.pivot.add(handR);
  armL.pivot.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), std(SKIN)).translateY(-0.5));

  // Gegenstand in der rechten Hand
  var prop = buildProp(cfg.prop, cfg.accent);
  if (prop) {
    prop.position.set(0.02, -0.56, 0.14);
    armR.pivot.add(prop);
  }

  // Beine (Hüfte als Drehpunkt)
  var legR = legPivot(0.12), legL = legPivot(-0.12);
  body.add(legR.pivot, legL.pivot);
  legR.pivot.add(mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), std(cfg.pants)).translateY(-0.35));
  legL.pivot.add(mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), std(cfg.pants)).translateY(-0.35));
  legR.pivot.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), std(0x111111)).translateZ(0.06).translateY(-0.7));
  legL.pivot.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), std(0x111111)).translateZ(0.06).translateY(-0.7));

  return { root: root, body: body, head: head, torso: torso, armR: armR.pivot, armL: armL.pivot, legR: legR.pivot, legL: legL.pivot, eyes: eyes, cape: cape, hat: head.userData.hat };
}

function armPivot(x, y, color) {
  var pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  pivot.add(mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), std(color)).translateY(-0.28));
  return { pivot: pivot };
}
function legPivot(x) {
  var pivot = new THREE.Group();
  pivot.position.set(x, 0.8, 0);
  return { pivot: pivot };
}

function addHat(head, cfg) {
  var acc = std(cfg.accent);
  var k = cfg.hat;
  if (k === "cap") {
    var top = mesh(new THREE.CylinderGeometry(0.33, 0.35, 0.14, 18), std(cfg.shirt));
    top.position.set(0, 0.24, 0); head.add(top);
    var brim = mesh(new THREE.BoxGeometry(0.36, 0.03, 0.22), std(cfg.shirt));
    brim.position.set(0, 0.17, 0.22); head.add(brim);
  } else if (k === "helmet") {
    var dome = mesh(new THREE.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(cfg.shirt));
    dome.position.set(0, 0.04, 0); head.add(dome);
    var badge = mesh(new THREE.CircleGeometry(0.07, 6), acc);
    badge.position.set(0, 0.3, 0.2); badge.rotation.x = -0.6; head.add(badge);
  } else if (k === "hood") {
    var hood = mesh(new THREE.SphereGeometry(0.37, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), std(cfg.shirt, { side: THREE.DoubleSide }));
    hood.position.set(0, 0.02, -0.03); head.add(hood);
    var feather = mesh(new THREE.ConeGeometry(0.05, 0.3, 6), acc);
    feather.position.set(0.22, 0.3, 0); feather.rotation.z = -0.5; head.add(feather);
  } else if (k === "headset") {
    var band = mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 28, Math.PI), std(0x222222));
    band.rotation.z = Math.PI; band.position.set(0, 0.02, 0); head.add(band);
    var ear = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), glow(cfg.accent));
    ear.rotation.z = Math.PI / 2; ear.position.set(-0.36, 0, 0); head.add(ear);
  } else if (k === "bun") {
    var bun = mesh(new THREE.SphereGeometry(0.14, 12, 10), std(HAIR));
    bun.position.set(0, 0.42, -0.06); head.add(bun);
    var fringe = mesh(new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), std(HAIR));
    fringe.position.set(0, 0.06, 0.02); head.add(fringe);
  } else if (k === "visor") {
    var visor = mesh(new THREE.BoxGeometry(0.5, 0.11, 0.06), glow(cfg.accent));
    visor.position.set(0, 0.04, 0.3); head.add(visor);
  } else if (k === "cube") {
    var cube = mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), std(cfg.accent));
    cube.position.set(0, 0.6, 0); head.userData.hat = cube; head.add(cube);
  } else if (k === "band") {
    var ring = mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 28), glow(cfg.accent));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.2, 0); head.add(ring);
  }
}

function buildProp(k, accent) {
  var g = new THREE.Group();
  if (k === "tablet") {
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.28, 0.03), std(0x111827)));
    g.add(mesh(new THREE.BoxGeometry(0.17, 0.23, 0.01), glow(accent)).translateZ(0.02));
  } else if (k === "cup") {
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.14, 12), std(0xf8fafc)));
  } else if (k === "shield") {
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 6), std(0x064e3b)).rotateX(Math.PI / 2));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 6), glow(accent)).rotateX(Math.PI / 2));
  } else if (k === "map") {
    g.add(mesh(new THREE.PlaneGeometry(0.24, 0.3), std(0xf5e6c8, { side: THREE.DoubleSide })));
  } else if (k === "glow") {
    g.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), glow(accent)));
  } else if (k === "tiles") {
    for (var i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), std(accent)).translateY(i * 0.06));
  } else if (k === "book") {
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.26, 0.05), std(0x1d4ed8)));
  } else if (k === "phone") {
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.22, 0.02), std(0x111827)));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.17, 0.01), glow(accent)).translateZ(0.02));
  } else if (k === "bag") {
    g.add(mesh(new THREE.BoxGeometry(0.26, 0.18, 0.12), std(0x78350f)));
  } else {
    return null;
  }
  return g;
}

// Aktionen (Kampf- und Bewegungsposen). Dauer in Sekunden. loop = Wiederholung.
var CLIPS = {
  walk:    { dur: 1.2, loop: true },
  punch:   { dur: 0.6 },
  kick:    { dur: 0.8 },
  jump:    { dur: 0.9 },
  victory: { dur: 2.4 }
};

// Linear zwischen Schlüsselwerten [[zeit, wert], ...], zeit 0..1
function keys(list, p) {
  if (p <= list[0][0]) return list[0][1];
  for (var i = 1; i < list.length; i++) {
    if (p <= list[i][0]) {
      var a = list[i - 1], b = list[i];
      var u = (p - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return list[list.length - 1][1];
}

// Wendet eine Aktion an. p = Fortschritt 0..1 (bei loop: Phase), t = Zeit in Sekunden.
function applyClip(f, name, p, t) {
  if (name === "walk") {
    var s = Math.sin(t * 5.2);
    f.legR.rotation.x = 0.5 * s;
    f.legL.rotation.x = -0.5 * s;
    f.armR.rotation.x = -0.4 * s;
    f.armL.rotation.x = 0.4 * s;
    f.body.position.y = 0.04 * Math.abs(Math.cos(t * 5.2));
  } else if (name === "punch") {
    f.armR.rotation.x = keys([[0, 0], [0.22, 0.5], [0.42, -1.55], [1, 0]], p);
    f.armR.rotation.z = keys([[0, 0.06], [0.42, 0.35], [1, 0.06]], p);
    f.body.rotation.y = keys([[0, 0], [0.22, -0.3], [0.42, 0.25], [1, 0]], p);
    f.armL.rotation.x = keys([[0, 0], [0.4, 0.3], [1, 0]], p);
  } else if (name === "kick") {
    f.legR.rotation.x = keys([[0, 0], [0.3, -0.5], [0.5, -1.5], [1, 0]], p);
    f.body.rotation.x = keys([[0, 0], [0.3, 0.15], [0.6, 0.12], [1, 0]], p);
    f.armR.rotation.z = keys([[0, 0.06], [0.5, 0.8], [1, 0.06]], p);
  } else if (name === "jump") {
    f.body.position.y = keys([[0, 0], [0.45, 0.32], [1, 0]], p);
    f.legR.rotation.x = keys([[0, 0], [0.25, -0.7], [0.75, -0.7], [1, 0]], p);
    f.legL.rotation.x = keys([[0, 0], [0.25, -0.7], [0.75, -0.7], [1, 0]], p);
    f.armR.rotation.z = keys([[0, 0.06], [0.45, 2.4], [1, 0.06]], p);
    f.armL.rotation.z = keys([[0, -0.06], [0.45, -2.4], [1, -0.06]], p);
  } else if (name === "victory") {
    var bob = Math.abs(Math.sin(t * 6));
    f.body.position.y = 0.06 * bob;
    f.armR.rotation.z = 2.5 + 0.12 * Math.sin(t * 8);
    f.armL.rotation.z = -2.5 - 0.12 * Math.sin(t * 8);
    f.head.rotation.x = -0.15;
  }
}

// Bewegung je Figur. t in Sekunden. act = {name, p} oder null.
function animate(f, cfg, t, blink, act) {
  var s = Math.sin(t * 2.2);
  var idle = cfg.idle;
  f.body.position.y = 0;
  f.body.rotation.x = 0;
  f.body.rotation.y = 0;
  f.head.rotation.x = 0;
  f.armR.rotation.z = 0.06 * s;
  f.armL.rotation.z = -0.06 * s;
  f.legR.rotation.x = 0;
  f.legL.rotation.x = 0;
  f.torso.scale.y = 1 + 0.015 * Math.sin(t * 2.2);

  if (idle === "wave") {
    f.armR.rotation.z = 2.2 + 0.3 * Math.sin(t * 5);
  } else if (idle === "bounce") {
    f.body.position.y = Math.abs(Math.sin(t * 3)) * 0.07;
  } else if (idle === "spin") {
    f.body.rotation.y = Math.sin(t * 0.9) * 0.7;
  } else if (idle === "nod") {
    f.head.rotation.x = 0.12 * Math.sin(t * 1.6);
  }
  f.legR.rotation.x = 0.02 * s;
  f.legL.rotation.x = -0.02 * s;
  if (act) applyClip(f, act.name, act.p, t);
  if (f.cape) f.cape.rotation.x = -0.12 + 0.08 * Math.sin(t * 2.6);
  if (f.hat && cfg.hat === "cube") { f.hat.rotation.y = t * 0.9; f.hat.rotation.x = t * 0.5; }
  // Augen blinzeln alle ca. 3,8 s
  var k = (t % 3.8) < 0.12 ? 0.15 : 1;
  f.eyes.forEach(function (e) { e.scale.y = k; });
  if (blink) f.eyes.forEach(function (e) { e.scale.y = 1; });
}

function reduced() {
  return document.documentElement.classList.contains("tm-still") ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// mount(el, uiId): zeichnet die Figur in el. Liefert {dispose} oder null (ohne WebGL).
export function mount(el, uiId) {
  if (!hasWebGL()) return null;
  var cfg = CFG[uiId] || CFG.toyclassic;
  var w = el.clientWidth || 96, h = el.clientHeight || 96;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  } catch (e) { return null; }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  el.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
  cam.position.set(0, 1.2, 5.2);
  cam.lookAt(0, 1.1, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  var key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(2, 4, 3);
  scene.add(key);
  var rim = new THREE.PointLight(cfg.accent, 1.2, 6);
  rim.position.set(-1.6, 1.8, -1.5);
  scene.add(rim);

  var f = build(cfg);
  scene.add(f.root);
  f.root.position.y = 0; // Figur reicht von etwa y=0 (Füße) bis y=2.2 (Würfel)

  var still = reduced();
  var t0 = performance.now();
  var raf = 0, disposed = false;
  var act = null; // {name, start} für die laufende Aktion

  function currentAct(now) {
    if (!act) return null;
    var clip = CLIPS[act.name];
    var el = (now - act.start) / 1000;
    if (clip.loop) return { name: act.name, p: (el % clip.dur) / clip.dur };
    if (el >= clip.dur) { act = null; return null; }
    return { name: act.name, p: el / clip.dur };
  }

  function frame(now) {
    if (disposed) return;
    animate(f, cfg, (now - t0) / 1000, false, currentAct(now));
    renderer.render(scene, cam);
    if (!still) raf = requestAnimationFrame(frame);
  }
  frame(performance.now());
  if (!still) raf = requestAnimationFrame(frame);

  return {
    // Startet eine Aktion: "walk", "punch", "kick", "jump" oder "victory"
    play: function (name) {
      if (!CLIPS[name] || still) return; // bei reduzierter Bewegung keine Aktionen
      act = { name: name, start: performance.now() };
    },
    dispose: function () {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss(); // gibt den WebGL-Kontext frei (auf dem Tablet gibt es nur wenige)
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}

export var UI_IDS = Object.keys(CFG);
