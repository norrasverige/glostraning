const COLORS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#f15bb5'];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let canvas;
let ctx;
let particles = [];
let running = false;

function setup() {
  canvas ??= document.getElementById('confetti');
  ctx ??= canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function confetti(count = 80, origin = { x: 0.5, y: 0.6 }) {
  if (reducedMotion.matches) return;
  setup();
  for (let i = 0; i < count; i++) {
    particles.push({
      x: origin.x * canvas.width,
      y: origin.y * canvas.height,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 15 - 5,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      age: 0,
    });
  }
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.y < canvas.height + 20 && p.age < 400);
  for (const p of particles) {
    p.vy += 0.35;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.spin;
    p.age++;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  if (particles.length) requestAnimationFrame(tick);
  else running = false;
}
