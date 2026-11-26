"use strict";

const coverLevelColors = ["#4c75a4", "#387b8d", "#49739a", "#596f99"];

{
  const canvas = document.querySelector("#cover-motion");
  const toggle = document.querySelector("#cover-motion-toggle");
  const image = canvas?.previousElementSibling;

  if (image instanceof HTMLImageElement && toggle && "CanvasRenderingContext2D" in window) {
    const levels = Array.from(document.querySelectorAll(".cover-level-art"), createCoverLevel);
    levels.forEach((paint) => paint?.());
    toggle.hidden = false;
    let observer;
    let initialized = false;
    async function initialize() {
      if (initialized) return;
      initialized = true;
      observer?.disconnect();
      toggle.removeEventListener("click", initialize);
      toggle.disabled = true;
      try {
        await image.decode();
        const context = canvas.getContext("2d");
        if (context) startCoverMotion(context, image, toggle, levels);
        else toggle.hidden = true;
      } catch {
        toggle.hidden = true;
      } finally {
        toggle.disabled = false;
      }
    }
    toggle.addEventListener("click", initialize, { once: true });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (!reduced.matches) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !reduced.matches) initialize();
      });
      observer.observe(canvas);
    }
  }
}

function startCoverMotion(context, image, toggle, levels) {
  const { canvas } = context;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const width = 1500;
  const height = 520;
  const waterline = 447;
  const fog = document.createElement("canvas");
  fog.width = 128;
  fog.height = 128;
  const fogPaint = fog.getContext("2d");
  const mist = fogPaint.createRadialGradient(64, 64, 0, 64, 64, 64);
  mist.addColorStop(0, "#b7d2f4a0");
  mist.addColorStop(.46, "#8baed64a");
  mist.addColorStop(1, "#8baed600");
  fogPaint.fillStyle = mist;
  fogPaint.fillRect(0, 0, 128, 128);
  const wisps = [
    [708, 437, 430, 34, .25],
    [960, 431, 430, 40, .42],
    [1160, 439, 490, 35, .46],
    [1350, 426, 320, 37, .36],
    [1490, 446, 390, 24, .40],
  ];
  let playing = true;
  let scrollTimer = 0;
  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let lastFrame = 0;

  function render() {
    context.clearRect(0, 0, width, height);

    // Shift thin rows of the existing reflection, with a smooth transition at the horizon.
    for (let y = waterline; y < height; y += 2) {
      const depth = (y - waterline) / (height - waterline);
      const shift = depth * (3.6 * Math.sin(y * .29 - elapsed * 1.6) + 1.6 * Math.sin(y * .11 + elapsed));
      context.globalAlpha = Math.min(1, depth * 4);
      context.drawImage(image, 0, y * image.naturalHeight / height,
        image.naturalWidth, 2 * image.naturalHeight / height, shift - 6, y, width + 12, 2);
    }

    wisps.forEach(([x, y, w, h, opacity], index) => {
      const phase = elapsed * (.19 + index * .024) + index * 1.4;
      const drift = Math.sin(phase) * (35 + index * 7);
      context.globalAlpha = opacity * (.78 + .22 * Math.cos(phase));
      context.drawImage(fog, x + drift - w / 2, y + Math.cos(phase) * 5 - h / 2, w, h);
    });
    context.globalAlpha = 1;

    levels.forEach((paint) => paint?.(elapsed));
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(canvas.clientWidth * pixelRatio);
    const pixelHeight = Math.round(canvas.clientHeight * pixelRatio);
    if (!pixelWidth || !pixelHeight || (canvas.width === pixelWidth && canvas.height === pixelHeight)) return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    render();
  }

  function animate(now) {
    if (!lastFrame || now - lastFrame >= 30) {
      if (lastFrame) elapsed += Math.min((now - lastFrame) / 1000, .08);
      lastFrame = now;
      render();
    }
    frame = requestAnimationFrame(animate);
  }

  function updatePlayback() {
    toggle.textContent = playing ? "Pause animation" : "Play animation";
    if (playing && visible && !document.hidden && !scrollTimer) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    }
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }).observe(canvas.closest(".hero-art"));

  toggle.addEventListener("click", () => {
    playing = !playing;
    updatePlayback();
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) playing = false;
    updatePlayback();
  });
  window.addEventListener("scroll", () => {
    if (!playing || !visible) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollTimer = 0;
      updatePlayback();
    }, 140);
    if (frame) updatePlayback();
  }, { passive: true });
  document.addEventListener("visibilitychange", updatePlayback);
  resize();
  updatePlayback();
}

function curvePoint([start, first, second, end], t) {
  const s = 1 - t;
  const a = s * s * s;
  const b = 3 * s * s * t;
  const c = 3 * s * t * t;
  const d = t * t * t;
  return [
    a * start[0] + b * first[0] + c * second[0] + d * end[0],
    a * start[1] + b * first[1] + c * second[1] + d * end[1],
  ];
}

function createCoverLevel(canvas, level) {
  const display = canvas.getContext("2d");
  if (!display) return;
  const accent = coverLevelColors[level];
  const plate = document.createElement("canvas");
  plate.width = canvas.width;
  plate.height = canvas.height;
  const pen = plate.getContext("2d");
  const width = 220;
  const height = 104;
  pen.scale(plate.width / width, plate.height / height);
  display.scale(canvas.width / width, canvas.height / height);

  const ink = "#eff5fb";
  const secondary = accent + "c7";
  const faint = "#7c8fa3";
  const active = [];

  function line(points, color, weight = 1) {
    pen.strokeStyle = color;
    pen.lineWidth = weight;
    pen.beginPath();
    pen.moveTo(...points[0]);
    for (const point of points.slice(1)) pen.lineTo(...point);
    pen.stroke();
  }

  function orbit(points, color, { dotted = false, animate = false } = {}) {
    const [start, first, second, end] = points;
    pen.beginPath();
    pen.moveTo(...start);
    pen.bezierCurveTo(...first, ...second, ...end);
    pen.setLineDash(dotted ? [2, 3] : []);
    pen.strokeStyle = color;
    pen.lineWidth = dotted ? 1 : 1.6;
    pen.stroke();
    pen.setLineDash([]);
    if (!dotted) {
      const angle = Math.atan2(end[1] - second[1], end[0] - second[0]);
      const x = end[0] - 6 * Math.cos(angle);
      const y = end[1] - 6 * Math.sin(angle);
      const dx = Math.sin(angle) * 3;
      const dy = Math.cos(angle) * 3;
      line([[x + dx, y - dy], end, [x - dx, y + dy]], color, 1.2);
    }
    if (animate) active.push({ points, color });
  }

  function planet(x, y, radius, color, rings = 1) {
    pen.beginPath();
    pen.arc(x, y, radius, 0, Math.PI * 2);
    pen.fillStyle = ink;
    pen.fill();
    pen.strokeStyle = color;
    pen.lineWidth = 1.35;
    pen.stroke();
    pen.save();
    pen.clip();
    for (let mark = -radius * .6; mark < radius; mark += 2.6) {
      line([[x + mark - 5, y + radius], [x + mark + 4, y - radius]], color + "70");
    }
    pen.restore();
    for (let ring = 1; ring <= rings; ring++) {
      pen.beginPath();
      pen.ellipse(x, y, radius + 5 * ring, radius + 2.7 * ring, -.32, 0, Math.PI * 2);
      pen.strokeStyle = color + "71";
      pen.lineWidth = .8;
      pen.stroke();
    }
  }

  function updater(x, y, color, revised = false) {
    pen.beginPath();
    pen.moveTo(x, y - 13);
    pen.lineTo(x + 13, y);
    pen.lineTo(x, y + 13);
    pen.lineTo(x - 13, y);
    pen.closePath();
    pen.fillStyle = ink;
    pen.fill();
    pen.strokeStyle = color;
    pen.lineWidth = 1.7;
    pen.stroke();
    line([[x - 4, y], [x + 4, y]], color, 1.5);
    if (revised) line([[x, y - 4], [x, y + 4]], color, 1.5);
  }

  function star(x, y, radius, color) {
    line([[x - radius, y], [x + radius, y]], color);
    line([[x, y - radius], [x, y + radius]], color);
    pen.fillStyle = color;
    pen.fillRect(x - 1, y - 1, 2, 2);
  }

  // All four plates use the same ink, stipple and symbols as a single star chart.
  for (let i = 0; i < 150; i++) {
    const x = 12 + (i * 79 + i * i * 3) % 196;
    const y = 8 + (i * 53 + i * i * 7) % 86;
    pen.fillStyle = i % 11 === 0 ? accent + "65" : accent + "2e";
    pen.fillRect(x, y, i % 11 === 0 ? 1.5 : .85, .9);
  }
  star(191, 23, 4, faint);
  star(25, 78, 3, faint);

  switch (level) {
    case 0:
      orbit([[27, 55], [75, 55], [155, 55], [192, 55]], accent, { animate: true });
      planet(49, 55, 6, accent, 0);
      planet(107, 55, 9, accent);
      planet(162, 55, 6, accent, 0);
      break;
    case 1:
      orbit([[31, 56], [52, 56], [66, 56], [86, 56]], secondary);
      orbit([[87, 56], [122, 56], [158, 64], [188, 65]], faint, { dotted: true });
      orbit([[87, 56], [115, 55], [126, 24], [182, 33]], accent, { animate: true });
      orbit([[178, 40], [190, 92], [95, 100], [86, 66]], secondary, { animate: true });
      planet(87, 56, 7, accent, 0);
      star(182, 33, 5, accent);
      break;
    case 2:
      orbit([[48, 49], [62, 33], [82, 33], [98, 47]], secondary, { animate: true });
      orbit([[122, 48], [138, 32], [159, 33], [178, 49]], accent, { animate: true });
      orbit([[180, 62], [161, 89], [114, 91], [108, 65]], secondary, { animate: true });
      planet(43, 54, 9, accent);
      updater(109, 53, accent);
      planet(179, 55, 13, accent, 2);
      break;
    case 3:
      orbit([[54, 41], [76, 6], [160, 8], [166, 42]], accent, { animate: true });
      orbit([[162, 63], [138, 105], [82, 100], [55, 63]], accent, { animate: true });
      orbit([[157, 50], [135, 30], [88, 35], [105, 54]], secondary, { animate: true });
      orbit([[107, 64], [120, 73], [158, 76], [190, 61]], secondary, { animate: true });
      updater(53, 52, secondary);
      updater(165, 52, accent, true);
      planet(110, 59, 7, accent);
      star(193, 60, 5, accent);
      break;
  }

  return (time) => {
    display.clearRect(0, 0, width, height);
    display.drawImage(plate, 0, 0, width, height);
    if (time === undefined) return;
    active.forEach(({ points, color }, index) => {
      const phase = (time / (4.7 + level * .7) + index * .38 + level * .16) % 1;
      const opacity = Math.min(1, phase * 12, (1 - phase) * 12);
      const [x, y] = curvePoint(points, phase);
      display.fillStyle = color;
      display.globalAlpha = opacity;
      display.shadowBlur = 4;
      display.shadowColor = color;
      display.beginPath();
      display.arc(x, y, 2.8, 0, Math.PI * 2);
      display.fill();
    });
    display.globalAlpha = 1;
    display.shadowBlur = 0;
  };
}
