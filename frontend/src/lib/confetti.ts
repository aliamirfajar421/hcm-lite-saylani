/**
 * Lightweight Zero-Dependency Canvas Confetti Burst
 * Optimized for celebration wow-factors (face scan check-in, leave approval, payroll)
 */
export function triggerConfetti(durationMs: number = 2500) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const colors = [
    "#10b981", "#14b8a6", "#06b6d4", "#3b82f6",
    "#8b5cf6", "#ec4899", "#f59e0b", "#eab308"
  ];

  interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    tilt: number;
    opacity: number;
  }

  const particleCount = 90;
  const particles: Particle[] = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width * 0.5 + (Math.random() - 0.5) * 200,
      y: height * 0.45 + (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5) * 18,
      vy: Math.random() * -16 - 6,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      tilt: Math.random() * 10 - 5,
      opacity: 1,
    });
  }

  let startTime: number | null = null;
  let animId: number;

  function render(time: number) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;
    const progress = elapsed / durationMs;

    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.rotationSpeed;
      p.opacity = Math.max(0, 1 - progress);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (elapsed < durationMs) {
      animId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animId);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  animId = requestAnimationFrame(render);
}

