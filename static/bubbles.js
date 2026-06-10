// "The Internet Map" inspired bubble field with mouse interaction
(function () {
  const canvas = document.getElementById('bubbles');
  const ctx = canvas.getContext('2d');
  let W, H, DPR;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Color palette echoing the reference image + Bluetown brand blue
  const PALETTE = [
    '0,0,0',         // Pitch black
    '80,80,80',      // Dark gray
    '150,150,150',   // Mid gray
    '200,200,200',   // Light gray
    '255,255,255',   // White
    '50,50,50'       // Charcoal
  ];
  const PALETTE_WEIGHTS = [0.34, 0.24, 0.18, 0.12, 0.04, 0.08];

  function pickColor() {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < PALETTE.length; i++) {
      acc += PALETTE_WEIGHTS[i];
      if (r <= acc) return PALETTE[i];
    }
    return PALETTE[0];
  }

  // Particle field
  const NUM = Math.min(260, Math.floor((window.innerWidth * window.innerHeight) / 6000));
  let particles = [];

  function makeParticle() {
    const sizeRoll = Math.random();
    let r;
    if (sizeRoll > 0.985) r = 26 + Math.random() * 18;       // rare giant nodes
    else if (sizeRoll > 0.92) r = 10 + Math.random() * 10;   // medium
    else r = 0.6 + Math.random() * 3.2;                       // tiny dust

    return {
      x: Math.random() * W,
      y: Math.random() * H,
      baseX: 0, baseY: 0,
      r: r,
      baseR: r,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      color: pickColor(),
      alpha: 0.25 + Math.random() * 0.55,
      twinkleSpeed: 0.004 + Math.random() * 0.012,
      twinklePhase: Math.random() * Math.PI * 2,
    };
  }

  for (let i = 0; i < NUM; i++) {
    const p = makeParticle();
    p.baseX = p.x; p.baseY = p.y;
    particles.push(p);
  }

  // Mouse state
  const mouse = { x: -9999, y: -9999, active: false };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener('mouseleave', () => { mouse.active = false; });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { mouse.active = false; });

  const REPEL_RADIUS = 140;
  const REPEL_STRENGTH = 1800;
  const RETURN_SPRING = 0.012;
  const FRICTION = 0.92;

  let t = 0;

  function frame() {
    t += 1;
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      // Drift
      p.baseX += p.vx;
      p.baseY += p.vy;

      // Wrap base position
      if (p.baseX < -50) p.baseX = W + 50;
      if (p.baseX > W + 50) p.baseX = -50;
      if (p.baseY < -50) p.baseY = H + 50;
      if (p.baseY > H + 50) p.baseY = -50;

      // Spring towards drifting base position
      let dx = p.baseX - p.x;
      let dy = p.baseY - p.y;
      p.vx_off = (p.vx_off || 0);
      p.vy_off = (p.vy_off || 0);
      p.vx_off += dx * RETURN_SPRING;
      p.vy_off += dy * RETURN_SPRING;

      // Mouse repulsion -> bubble push
      if (mouse.active) {
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const dist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
        if (dist < REPEL_RADIUS) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH / (dist * dist + 40);
          p.vx_off += (mdx / dist) * force;
          p.vy_off += (mdy / dist) * force;
        }
      }

      p.vx_off *= FRICTION;
      p.vy_off *= FRICTION;

      p.x += p.vx_off;
      p.y += p.vy_off;

      // Twinkle
      p.twinklePhase += p.twinkleSpeed;
      const twinkle = 0.7 + 0.3 * Math.sin(p.twinklePhase);
      const alpha = p.alpha * twinkle;

      // Glow for bigger nodes
      if (p.baseR > 8) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.4);
        grad.addColorStop(0, `rgba(${p.color},${alpha * 0.5})`);
        grad.addColorStop(1, `rgba(${p.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }
  frame();
})();
