/**
 * PARCHE QUIRURGICO: Animacion continua del stickman nadador (100% ancho inferior)
 * Corrige los 3 problemas de la captura:
 * 1. Reloj absoluto con performance.now() para que nunca se congele en React/Next.js.
 * 2. Medicion dinamica del ancho real (ResizeObserver + window.innerWidth) para que nade de lado a lado.
 * 3. Contraste blanco + renderizado en 2 capas (cuerpo bajo el agua semitransparente, cabeza y brazada por encima de la ola).
 */

export function mountSwimmerLane(canvas, container) {
  if (!canvas || !container) return () => {};

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};
  const LOGICAL_H = 128;
  const LOOP_DURATION = 16.0; // 16 segundos por vuelta completa (ida y vuelta)

  let logicalW = window.innerWidth || 1440;
  let rafId = null;
  const startTime = performance.now();
  let lastBubbleAt = -1;
  let lastKickSplashAt = -1;
  let prevArmSin = 0;
  const bubbles = [];
  const splashes = [];

  // 1. Ajusta el canvas al 100% del ancho real de la pantalla en todo momento
  function syncSize() {
    const rect = container.getBoundingClientRect();
    const w = rect.width > 50 ? rect.width : window.innerWidth;
    const h = rect.height > 20 ? rect.height : LOGICAL_H;
    logicalW = Math.max(1, Math.round(LOGICAL_H * (w / h)));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(logicalW * dpr);
    const targetH = Math.round(LOGICAL_H * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  syncSize();
  window.addEventListener("resize", syncSize);
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncSize) : null;
  if (observer) observer.observe(container);

  // Funciones de geometria de olas
  const getBackWaveY = (x, t) =>
    56 + Math.sin(x * 0.024 + (Math.PI * 16 * t) / LOOP_DURATION + 1.35) * 6.5;

  const getFrontWaveY = (x, t) =>
    62 + Math.sin(x * 0.024 - (Math.PI * 16 * t) / LOOP_DURATION) * 6.0;

  const getFrontSlope = (x, t) =>
    (getFrontWaveY(x + 4, t) - getFrontWaveY(x - 4, t)) / 8;

  // 2. Calculo de posicion X de extremo a extremo y fase de brazada
  function getSwimmerPose(t, elapsed) {
    const margin = Math.min(64, logicalW / 4);
    const rightLimit = logicalW - margin;
    const span = rightLimit - margin;
    const strokePhase = Math.PI * 2 * 1.4 * elapsed; // 1.4 brazadas/segundo

    let x = margin;
    let flipX = 1;
    let isTurning = false;

    if (t < 7.2) {
      // Ida: izquierda -> derecha por toda la pantalla
      const p = t / 7.2;
      x = margin + span * p + Math.sin(strokePhase * 2) * 3 * Math.sin(p * Math.PI);
      flipX = 1;
    } else if (t < 8.0) {
      // Viraje en el borde derecho
      const p = (t - 7.2) / 0.8;
      x = rightLimit + Math.sin(p * Math.PI) * 12;
      flipX = Math.cos(p * Math.PI);
      isTurning = true;
    } else if (t < 15.2) {
      // Vuelta: derecha -> izquierda por toda la pantalla
      const p = (t - 8.0) / 7.2;
      x = rightLimit - span * p - Math.sin(strokePhase * 2) * 3 * Math.sin(p * Math.PI);
      flipX = -1;
    } else {
      // Viraje en el borde izquierdo
      const p = (t - 15.2) / 0.8;
      x = margin - Math.sin(p * Math.PI) * 12;
      flipX = -Math.cos(p * Math.PI);
      isTurning = true;
    }

    const y = getFrontWaveY(x, t) - 2 + Math.sin(strokePhase * 2) * 1.4;
    return { x, y, flipX, slope: getFrontSlope(x, t), strokePhase, isTurning };
  }

  function applyTransform(pose) {
    const safeFlip = Math.abs(pose.flipX) < 0.08 ? (pose.flipX >= 0 ? 0.08 : -0.08) : pose.flipX;
    const tilt = Math.atan(pose.slope) * 0.5 - 0.05 + Math.sin(pose.strokePhase * 2) * 0.03;
    ctx.translate(pose.x, pose.y);
    ctx.scale(safeFlip, 1);
    ctx.rotate(tilt);
  }

  // Capa sumergida: torso, brazada subacuatica y patada de crol
  function drawBodyUnderWave(pose) {
    ctx.save();
    applyTransform(pose);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.shadowColor = "rgba(8, 20, 48, 0.65)";
    ctx.shadowBlur = 6;
    ctx.lineCap = "round";

    // Patada alternada
    const k1 = Math.sin(pose.strokePhase * 3) * 6.5;
    const k2 = Math.sin(pose.strokePhase * 3 + Math.PI) * 6.5;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(-26, 2);
    ctx.quadraticCurveTo(-42, 2 + k2 * 0.4, -56, 2 + k2);
    ctx.stroke();

    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(-26, 1);
    ctx.quadraticCurveTo(-42, 1 + k1 * 0.4, -56, 1 + k1);
    ctx.stroke();

    // Torso
    ctx.lineWidth = 5.8;
    ctx.beginPath();
    ctx.moveTo(-27, 2);
    ctx.quadraticCurveTo(-5, 0.5, 16, -1.5);
    ctx.stroke();

    // Brazo de traccion bajo el agua
    const pullPhase = pose.strokePhase + Math.PI;
    const pullX = 12 + Math.cos(pullPhase) * 20;
    const pullY = 4 + Math.max(0, Math.sin(pullPhase)) * 12;
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.quadraticCurveTo(10, pullY + 3, pullX, pullY);
    ctx.stroke();

    ctx.restore();
  }

  // Capa aerea (por ENCIMA de la cresta de la ola): cabeza y brazo de recobro
  function drawHeadAndArmAboveWave(pose) {
    ctx.save();
    applyTransform(pose);
    ctx.strokeStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(7, 16, 38, 0.75)";
    ctx.shadowBlur = 8;
    ctx.lineCap = "round";

    // Cabeza sobre la linea de flotacion
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.arc(20, -10.5, 9.5, 0, Math.PI * 2);
    ctx.stroke();

    // Brazo aereo de crol
    if (!pose.isTurning) {
      const lift = Math.max(0, Math.sin(pose.strokePhase));
      const reach = Math.cos(pose.strokePhase);
      if (lift > 0.02) {
        ctx.lineWidth = 4.6;
        ctx.beginPath();
        ctx.moveTo(12, -1);
        ctx.quadraticCurveTo(10 + reach * 10, -5 - lift * 24, 12 + reach * 24, -2 - lift * 18);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 3. Bucle principal continuo ligado al reloj del sistema
  function render(now) {
    const elapsed = Math.max(0, (now - startTime) / 1000);
    const t = elapsed % LOOP_DURATION;

    ctx.clearRect(0, 0, logicalW, LOGICAL_H);

    // Ola trasera celeste
    ctx.fillStyle = "rgba(105, 206, 250, 0.88)";
    ctx.beginPath();
    ctx.moveTo(0, LOGICAL_H);
    for (let x = 0; x <= logicalW + 8; x += 8) ctx.lineTo(x, getBackWaveY(x, t));
    ctx.lineTo(logicalW, LOGICAL_H);
    ctx.fill();

    const pose = getSwimmerPose(t, elapsed);

    // Cuerpo sumergido
    drawBodyUnderWave(pose);

    // Ola frontal semitransparente + cresta blanca
    const grad = ctx.createLinearGradient(0, 54, 0, LOGICAL_H);
    grad.addColorStop(0, "rgba(61, 138, 247, 0.76)");
    grad.addColorStop(0.6, "rgba(38, 108, 230, 0.86)");
    grad.addColorStop(1, "rgba(24, 79, 201, 0.94)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, LOGICAL_H);
    for (let x = 0; x <= logicalW + 6; x += 6) ctx.lineTo(x, getFrontWaveY(x, t));
    ctx.lineTo(logicalW, LOGICAL_H);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let x = 0; x <= logicalW + 6; x += 6) {
      const y = getFrontWaveY(x, t);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Cabeza y brazo por encima de la ola
    drawHeadAndArmAboveWave(pose);

    const dir = pose.flipX >= 0 ? 1 : -1;

    // Helper para generar gotas ligeras de splash
    const spawnSplash = (sx, sy, count, spreadX, liftMin, liftMax) => {
      for (let k = 0; k < count; k++) {
        splashes.push({
          x: sx + (Math.random() - 0.5) * spreadX,
          y: sy,
          r: 1.3 + Math.random() * 1.3,
          vx: -dir * (0.35 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.7,
          vy: -(liftMin + Math.random() * (liftMax - liftMin)),
          born: now,
          maxLife: 360 + Math.random() * 140
        });
      }
    };

    // Splash sutil cuando la mano entra al agua en cada brazada
    const curArmSin = Math.sin(pose.strokePhase);
    if (!pose.isTurning && prevArmSin > 0 && curArmSin <= 0) {
      const entryX = pose.x + dir * 32;
      const entryY = getFrontWaveY(entryX, t);
      spawnSplash(entryX, entryY, 5, 10, 1.3, 2.3);
    }
    prevArmSin = curArmSin;

    // Splash ligero en los pies (patada de crol) o en viraje
    if (lastKickSplashAt < 0 || now - lastKickSplashAt > (pose.isTurning ? 110 : 190)) {
      lastKickSplashAt = now;
      const footX = pose.isTurning ? pose.x : pose.x - dir * 50;
      const footY = getFrontWaveY(footX, t);
      spawnSplash(footX, footY, pose.isTurning ? 4 : 2, 12, 0.9, 1.7);
    }

    // Burbujas sumergidas que se elevan hacia la superficie de la ola
    if (lastBubbleAt < 0 || now - lastBubbleAt > 115) {
      lastBubbleAt = now;
      bubbles.push({
        x: pose.x - dir * (16 + Math.random() * 28),
        y: pose.y + 24 + Math.random() * 18,
        r: 2.0 + Math.random() * 2.0,
        vx: -dir * (0.28 + Math.random() * 0.2),
        vy: -(0.42 + Math.random() * 0.24),
        seed: Math.random() * Math.PI * 2,
        born: now
      });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      const age = (now - b.born) / 950;
      b.x += b.vx + Math.sin(now * 0.014 + b.seed) * 0.22;
      b.y += b.vy;

      // Desaparece al llegar a la cresta de la ola o cumplir su ciclo
      const surfaceY = getFrontWaveY(b.x, t) + 2;
      if (age >= 1 || b.y <= surfaceY) {
        bubbles.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.88 * (1 - age * 0.75)).toFixed(2)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Renderizado de gotas de splash con arco de gravedad suave
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      const age = (now - s.born) / s.maxLife;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.095;

      const surfaceY = getFrontWaveY(s.x, t) + 2;
      if (age >= 1 || (s.vy > 0 && s.y > surfaceY)) {
        splashes.splice(i, 1);
        continue;
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${(0.9 * (1 - age)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);

  // Limpieza al desmontar en React/Next
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("resize", syncSize);
    if (observer) observer.disconnect();
  };
}
