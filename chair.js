/* ==========================================================
   HARD PART — chair.js
   Interactive 3D barber chair (Three.js r160, loaded from a CDN on demand).
   The chair is built procedurally from primitives, so no model file is needed.
   Loaded lazily by script.js; exposes window.HardPartChair.create().
   ========================================================== */
(function () {
  'use strict';

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

  /* Camera "stops". pos/target are world coordinates; amp scales the idle rotation. */
  const VIEWS = {
    full:      { pos: [3.6, 2.0, 5.0], target: [0, 1.2, 0.2],    amp: 1 },
    headrest:  { pos: [1.5, 2.55, 2.4], target: [0, 2.15, -0.35], amp: 0.25 },
    leather:   { pos: [2.3, 1.7, 2.3], target: [0.15, 1.1, 0.1], amp: 0.3 },
    footrest:  { pos: [2.5, 0.85, 3.3], target: [0, 0.5, 1.0],   amp: 0.25 }
  };

  /* Rounded box: extruded rounded rectangle with a bevel (core Three.js has no RoundedBox). */
  function roundedBox(THREE, w, h, d, r, b) {
    b = Math.min(b, r, w / 2, h / 2, d / 2);
    const iw = w - 2 * b, ih = h - 2 * b, rr = Math.max(r - b, 0.001);
    const x = -iw / 2, y = -ih / 2, s = new THREE.Shape();
    s.moveTo(x + rr, y);
    s.lineTo(x + iw - rr, y);      s.quadraticCurveTo(x + iw, y, x + iw, y + rr);
    s.lineTo(x + iw, y + ih - rr); s.quadraticCurveTo(x + iw, y + ih, x + iw - rr, y + ih);
    s.lineTo(x + rr, y + ih);      s.quadraticCurveTo(x, y + ih, x, y + ih - rr);
    s.lineTo(x, y + rr);           s.quadraticCurveTo(x, y, x + rr, y);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 10
    });
    g.center();
    return g;
  }

  /* Studio reflections: a dark room with a few bright softboxes, baked to an environment map. */
  function buildEnvironment(THREE, renderer, scene) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide })));
    const box = (w, h, x, y, z, power) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1da).multiplyScalar(power), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 1, 0);
      env.add(m);
    };
    box(7, 3, -7, 5, 5, 7);    // key softbox, front left
    box(1.6, 8, 7, 3, -4, 9);  // tall strip, back right (the chrome highlight)
    box(6, 6, 0, 9, 0, 3);     // overhead
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.03).texture;
    pmrem.dispose();
  }

  function buildChair(THREE) {
    const group = new THREE.Group();
    const leather = new THREE.MeshPhysicalMaterial({ color: 0x1a1411, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.6 });
    const chrome  = new THREE.MeshStandardMaterial({ color: 0xe2e0da, metalness: 1, roughness: 0.12, envMapIntensity: 1.3 });
    const metal   = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.85, roughness: 0.35, envMapIntensity: 0.8 });
    const groove  = new THREE.MeshBasicMaterial({ color: 0x050403 });

    const add = (parent, geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const cyl = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 40);

    // Base, sleeve, piston, seat plate
    add(group, cyl(0.86, 0.78, 0.1), metal, 0, 0.05, 0);
    add(group, cyl(0.7, 0.62, 0.06), chrome, 0, 0.13, 0);
    add(group, cyl(0.26, 0.2, 0.4), chrome, 0, 0.3, 0);
    add(group, cyl(0.1, 0.1, 0.35), chrome, 0, 0.6, 0);
    add(group, cyl(0.34, 0.34, 0.08), metal, 0, 0.8, 0);

    // Seat cushion
    add(group, roundedBox(THREE, 1.15, 0.2, 1.05, 0.12, 0.07), leather, 0, 0.92, 0.1);

    // Backrest (tilted back), with headrest and stitched grooves
    const back = new THREE.Group();
    back.position.set(0, 1.05, -0.42);
    back.rotation.x = -0.2;
    group.add(back);
    add(back, roundedBox(THREE, 1.0, 1.0, 0.22, 0.14, 0.07), leather, 0, 0.55, 0);
    [-0.25, 0.25].forEach((x) => add(back, new THREE.BoxGeometry(0.014, 0.8, 0.01), groove, x, 0.55, 0.112));
    [-0.12, 0.12].forEach((x) => add(back, new THREE.CylinderGeometry(0.024, 0.024, 0.34, 16), chrome, x, 1.14, 0));
    const head = add(back, roundedBox(THREE, 0.62, 0.34, 0.2, 0.1, 0.06), leather, 0, 1.38, 0.02);
    head.rotation.x = 0.1;

    // Armrests
    [-1, 1].forEach((s) => {
      add(group, new THREE.CylinderGeometry(0.035, 0.035, 0.4, 16), chrome, s * 0.66, 1.18, 0.05);
      add(group, roundedBox(THREE, 0.2, 0.1, 0.85, 0.05, 0.04), leather, s * 0.66, 1.4, 0.12);
    });

    // Footrest: sloped strut + ribbed plate
    const a = new THREE.Vector3(0, 0.8, 0.5), b = new THREE.Vector3(0, 0.45, 1.2);
    const dir = b.clone().sub(a), len = dir.length();
    const strut = add(group, new THREE.CylinderGeometry(0.04, 0.04, len, 16), chrome, 0, 0, 0);
    strut.position.copy(a).add(b).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const plate = add(group, roundedBox(THREE, 0.95, 0.06, 0.5, 0.03, 0.02), metal, 0, 0.42, 1.38);
    plate.rotation.x = -0.35;
    [-0.18, -0.06, 0.06, 0.18].forEach((z) => add(plate, new THREE.BoxGeometry(0.9, 0.012, 0.025), chrome, 0, 0.035, z));
    return group;
  }

  async function create(stage, canvas, opts) {
    opts = opts || {};
    const THREE = await import(THREE_URL);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); // cap cost on dense screens
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 9, 17);
    buildEnvironment(THREE, renderer, scene);

    // Lights: warm key spot (casts the shadow), cool-cream rim, faint fill
    const key = new THREE.SpotLight(0xfff1da, 260, 0, 0.45, 0.8, 2);
    key.position.set(-4, 7, 4.5);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xf1ebdd, 1.6);
    rim.position.set(4, 3, -5);
    scene.add(rim, new THREE.HemisphereLight(0x444444, 0x050505, 0.35));

    // Floor and the brand ring
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.55, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.8, 1.83, 96), new THREE.MeshBasicMaterial({ color: 0xf1ebdd, transparent: true, opacity: 0.45 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    const chair = buildChair(THREE);
    scene.add(chair);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);

    /* State: plain arrays keep the maths simple and cheap */
    let goal = VIEWS.full;
    const curPos = goal.pos.slice(), curTgt = goal.target.slice();
    let curAmp = 1, mx = 0, my = 0, sx = 0, sy = 0, t = 0, last = 0, fit = 1;
    let inView = false, raf = 0;

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit = Math.min(1.8, Math.max(1, 1.25 / camera.aspect)); // pull back on narrow stages
      if (reduce) draw(true);
    }

    function update(dt, snap) {
      const k = snap ? 1 : 1 - Math.exp(-dt * 3);       // smooth camera transition
      for (let i = 0; i < 3; i++) {
        curPos[i] += (goal.pos[i] - curPos[i]) * k;
        curTgt[i] += (goal.target[i] - curTgt[i]) * k;
      }
      curAmp += (goal.amp - curAmp) * k;
      const m = snap ? 1 : 1 - Math.exp(-dt * 4);
      sx += (mx - sx) * m; sy += (my - sy) * m;         // eased mouse offset

      camera.position.set(
        curTgt[0] + (curPos[0] - curTgt[0]) * fit + sx * 0.6,
        curTgt[1] + (curPos[1] - curTgt[1]) * fit - sy * 0.3,
        curTgt[2] + (curPos[2] - curTgt[2]) * fit
      );
      camera.lookAt(curTgt[0], curTgt[1], curTgt[2]);
      chair.rotation.y = reduce ? 0.3 : 0.15 + Math.sin(t * 0.35) * 0.35 * curAmp; // subtle idle sway
    }

    function draw(snap) { update(0.016, snap); renderer.render(scene, camera); }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      update(dt, false);
      renderer.render(scene, camera);
    }
    function sync() {
      const run = inView && !document.hidden && !reduce;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    // Input: mouse only (touch scrolls the page instead)
    stage.addEventListener('pointermove', (e) => {
      if (reduce || e.pointerType === 'touch') return;
      const r = stage.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 2 - 1;
      my = ((e.clientY - r.top) / r.height) * 2 - 1;
    });
    stage.addEventListener('pointerleave', () => { mx = 0; my = 0; });

    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; sync(); }).observe(stage); // render only when visible
    document.addEventListener('visibilitychange', sync);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); inView = false; sync(); if (opts.onLost) opts.onLost(); });

    resize();
    draw(true);

    return {
      setView(name) {
        if (!VIEWS[name]) return;
        goal = VIEWS[name];
        if (reduce) draw(true);            // reduced motion: jump, no travel
      }
    };
  }

  window.HardPartChair = { create };
})();
