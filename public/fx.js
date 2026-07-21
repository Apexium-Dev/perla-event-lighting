const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
let w, h, particles;

const PARTICLE_COUNT = 60;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}

function makeParticle() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.4,
    speed: Math.random() * 0.35 + 0.08,
    drift: (Math.random() - 0.5) * 0.25,
    twinkle: Math.random() * Math.PI * 2,
    twinkleSpeed: Math.random() * 0.02 + 0.008,
  };
}

function init() {
  resize();
  particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
}

function tick() {
  ctx.clearRect(0, 0, w, h);
  for (const p of particles) {
    p.twinkle += p.twinkleSpeed;
    const alpha = 0.35 + Math.sin(p.twinkle) * 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(217, 184, 114, ${Math.max(alpha, 0)})`;
    ctx.shadowColor = "rgba(243, 216, 150, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fill();

    p.y -= p.speed;
    p.x += p.drift;
    if (p.y < -5) {
      p.y = h + 5;
      p.x = Math.random() * w;
    }
    if (p.x < -5) p.x = w + 5;
    if (p.x > w + 5) p.x = -5;
  }
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resize);

if (!reduceMotion) {
  init();
  requestAnimationFrame(tick);
} else {
  canvas.style.display = "none";
}
