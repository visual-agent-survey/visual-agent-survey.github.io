"use strict";

const coverLevelColors = [
  { light: "#89aeff", rgb: "137, 174, 255" },
  { light: "#69e5df", rgb: "105, 229, 223" },
  { light: "#ffcb87", rgb: "255, 203, 135" },
  { light: "#e1acff", rgb: "225, 172, 255" },
];

{
  const canvas = document.querySelector("#cover-motion");
  const toggle = document.querySelector("#cover-motion-toggle");
  const image = canvas?.previousElementSibling;

  if (image instanceof HTMLImageElement && toggle && "CanvasRenderingContext2D" in window) {
    document.querySelectorAll(".cover-foundation-icon").forEach(paintFoundationIcon);
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

function paintFoundationIcon(canvas, index) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const model = index === 0;
  const color = model ? "#9faeff" : "#d2acff";
  context.strokeStyle = color;
  context.lineWidth = 2.4;

  if (model) {
    const aperture = Array.from({ length: 6 }, (_, i) => {
      const angle = i * Math.PI / 3;
      return [32 + 23 * Math.cos(angle), 32 + 23 * Math.sin(angle)];
    });
    context.beginPath();
    context.moveTo(...aperture[0]);
    aperture.slice(1).forEach((point) => context.lineTo(...point));
    context.closePath();
    aperture.forEach((point, i) => {
      const endpoint = aperture[(i + 2) % aperture.length];
      context.moveTo(...point);
      context.lineTo((point[0] + endpoint[0] * 2) / 3, (point[1] + endpoint[1] * 2) / 3);
    });
    context.stroke();
  } else {
    context.beginPath();
    context.ellipse(32, 32, 26, 16, -.56, 0, 2 * Math.PI);
    context.moveTo(12, 39);
    context.lineTo(30, 20);
    context.lineTo(48, 38);
    context.closePath();
    context.stroke();
    for (const [x, y] of [[12, 39], [30, 20], [48, 38]]) {
      context.fillStyle = "#160d26";
      context.beginPath();
      context.arc(x, y, 4.7, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }
  }
}

function startCoverMotion(context, image, toggle, levels) {
  const { canvas } = context;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  // The paths are registered to the static cover in this coordinate space.
  const width = 1536;
  const height = 1024;
  const blue = "131, 166, 255";
  const white = "227, 236, 255";
  const lilac = "189, 167, 255";

  const orbits = [
    { points: [[376, 511], [752, 351], [992, 344], [1285, 228]], period: 8, phase: .15, length: .21, size: 5.6 },
    { points: [[0, 935], [386, 878], [858, 806], [857, 694]],
      continuation: [[857, 694], [857, 621], [679, 550], [474, 519]], period: 10, phase: .29, length: .25, size: 5.4 },
    { points: [[1009, 690], [1018, 800], [479, 882], [0, 984]],
      approach: [[372, 442], [641, 429], [1006, 576], [1009, 690]], period: 14, phase: .35, length: .19, size: 4 },
    { points: [[580, 343], [884, 183], [1257, 35], [1450, 46]],
      continuation: [[1450, 46], [1594, 41], [1522, 168], [1353, 248]], period: 16, phase: .58, length: .15, size: 4.4 },
  ].map((orbit, level) => ({ ...orbit, tint: coverLevelColors[level].rgb, level }));
  const { backdrop, probe, probeX, probeY, probeLeft, probeTop } = prepareCoverScene(image, width, height, orbits);
  const meteors = [
    { points: [[543, 276], [665, 198], [778, 132], [912, 73]], period: 13, offset: 12.3, length: .5, tint: white, size: 3, duration: 1.4 },
    { points: [[1082, 862], [1195, 796], [1330, 716], [1468, 656]], period: 19, offset: 14, length: .5, tint: blue, size: 3.2, duration: 1.6 },
  ];
  const stars = [
    [572, 284, 2.4], [682, 96, 2.6], [765, 152, 3], [789, 81, 2.2],
    [849, 159, 1.8], [1019, 112, 2.4], [1072, 92, 2.5], [1158, 181, 2.2],
    [1371, 21, 2.1], [1453, 112, 2.8], [1436, 288, 2.3], [1069, 550, 2.6],
    [1123, 354, 2.4], [1385, 602, 2], [1243, 606, 3], [1104, 723, 2.4],
  ];

  let playing = true;
  let scrollTimer = 0;
  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let lastFrame = 0;
  let compact = false;

  function glow(x, y, radius, tint, strength) {
    const halo = context.createRadialGradient(x, y, 0, x, y, radius);
    halo.addColorStop(0, `rgba(${tint}, ${strength})`);
    halo.addColorStop(.28, `rgba(${tint}, ${strength * .48})`);
    halo.addColorStop(1, `rgba(${tint}, 0)`);
    context.fillStyle = halo;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function paintPulse({ points, length, size, tint }, progress, opacity) {
    if (opacity <= 0) return;
    const [x, y] = curvePoint(points, progress);
    const start = Math.max(0, progress - length);
    const [tailX, tailY] = curvePoint(points, start);
    const paint = context.createLinearGradient(tailX, tailY, x, y);
    paint.addColorStop(0, `rgba(${tint}, 0)`);
    paint.addColorStop(.72, `rgba(${tint}, ${opacity * .4})`);
    paint.addColorStop(1, `rgba(${tint}, ${opacity})`);

    context.beginPath();
    context.moveTo(tailX, tailY);
    for (let step = 1; step <= 18; step++) {
      context.lineTo(...curvePoint(points, start + (progress - start) * step / 18));
    }
    context.lineCap = "round";
    context.strokeStyle = paint;
    context.lineWidth = size * 2.2;
    context.globalAlpha = .19;
    context.stroke();
    context.lineWidth = size * .65;
    context.globalAlpha = 1;
    context.stroke();
    glow(x, y, size * 7, tint, opacity * .52);

    context.fillStyle = `rgba(${tint}, ${opacity})`;
    context.beginPath();
    context.arc(x, y, size * .62, 0, Math.PI * 2);
    context.fill();
  }

  function paintStars(time) {
    stars.forEach(([x, y, size], index) => {
      const pulse = .5 + .5 * Math.sin(time * (1.1 + index % 4 * .21) + index * 2.4);
      const opacity = pulse * pulse * .73;
      glow(x, y, size * 4, blue, opacity);
      context.fillStyle = `rgba(${white}, ${opacity})`;
      context.fillRect(x - size * .38, y - size * .38, size * .76, size * .76);
    });
  }

  function render() {
    context.clearRect(0, 0, width, height);
    context.drawImage(backdrop, 0, 0);
    context.globalCompositeOperation = "lighter";
    paintStars(elapsed);
    const starPulse = .5 + .5 * Math.cos((elapsed - 6.6) * Math.PI / 4);
    glow(1285, 228, 30 + 22 * starPulse, blue, .16 + .36 * starPulse);
    for (const orbit of orbits) {
      const progress = (elapsed / orbit.period + orbit.phase) % 1;
      const opacity = Math.min(1, progress * 10, (1 - progress) * 9) * .95;
      paintPulse(orbit, progress, opacity);
    }
    for (const meteor of meteors) {
      const progress = (elapsed + meteor.offset) % meteor.period / meteor.duration;
      if (progress < 1) paintPulse(meteor, progress, Math.sin(progress * Math.PI) ** 1.6 * .85);
    }
    context.globalCompositeOperation = "source-over";
    levels.forEach((paint) => paint?.(elapsed));

    const phase = elapsed * Math.PI / 6;
    const travel = Math.sin(phase);
    const pitch = 1 + travel * .045;
    const drift = travel * 102 + (compact ? travel * travel * 48 : 0);
    context.save();
    context.translate(probeX + drift, probeY - travel * 43 + (1 - Math.cos(phase)) * 10);
    context.rotate(Math.sin(phase * 2) * .115);
    context.scale(pitch, pitch);
    context.drawImage(probe, probeLeft - probeX, probeTop - probeY);
    context.globalCompositeOperation = "lighter";
    const beacon = (.5 + .5 * Math.cos(elapsed * Math.PI * .7)) ** 8;
    glow(984 - probeX, 307 - probeY, 15, lilac, beacon * .84);
    context.restore();
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = canvas.clientWidth;
    compact = displayWidth <= 420;
    const pixelWidth = Math.round(displayWidth * pixelRatio);
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

function prepareCoverScene(image, width, height, orbits) {
  const backdrop = document.createElement("canvas");
  backdrop.width = width;
  backdrop.height = height;
  const sky = backdrop.getContext("2d");
  sky.drawImage(image, 0, 0, width, height);

  // Lift the original engraved probe onto its own layer so it can bank and translate.
  const probeLeft = 734;
  const probeTop = 266;
  const probeX = 921;
  const probeY = 348;
  const probe = document.createElement("canvas");
  probe.width = 377;
  probe.height = 155;
  const hull = probe.getContext("2d");
  const outline = new Path2D(
    "M41 140 L108 117 L301 142 L311 156 L321 130 L335 127 L328 98 L333 94 L350 126 L364 123 " +
    "Q357 81 368 47 Q379 18 410 29 Q439 39 466 81 L481 82 Q498 67 507 75 Q517 86 502 101 " +
    "L486 116 Q498 147 497 175 L560 186 L685 211 L708 244 L628 234 L478 209 L456 198 " +
    "L428 195 L435 209 L424 216 L416 208 L402 231 L390 233 L391 245 L383 259 L372 259 " +
    "L373 235 L350 233 L343 252 L326 263 L314 256 L313 243 L323 229 L315 218 L297 232 " +
    "L292 226 L308 207 L305 180 L275 182 L192 168 L129 157 Z"
  );
  hull.scale(.5, .5);
  hull.clip(outline);
  hull.resetTransform();
  hull.drawImage(image, -probeLeft, -probeTop);

  // Borrow a clean patch of sky and feather it into the opening under the moving probe.
  const repair = document.createElement("canvas");
  repair.width = probe.width;
  repair.height = probe.height;
  const patch = repair.getContext("2d");
  patch.drawImage(image, 67, 61, repair.width, repair.height, 0, 0, repair.width, repair.height);
  patch.globalCompositeOperation = "destination-out";
  for (const [x, y, innerX, innerY] of [
    [0, 0, 15, 0], [repair.width, 0, repair.width - 15, 0],
    [0, 0, 0, 12], [0, repair.height, 0, repair.height - 12],
  ]) {
    const fade = patch.createLinearGradient(x, y, innerX, innerY);
    fade.addColorStop(0, "#000");
    fade.addColorStop(1, "#0000");
    patch.fillStyle = fade;
    patch.fillRect(0, 0, repair.width, repair.height);
  }
  sky.drawImage(repair, probeLeft, probeTop);
  paintDistantSky(sky);

  // The order and colors match the four level diagrams directly below the cover.
  for (const { approach, points, continuation, level, tint } of orbits) {
    const path = new Path2D();
    path.moveTo(...(approach || points)[0]);
    if (approach) path.bezierCurveTo(...approach[1], ...approach[2], ...approach[3]);
    path.bezierCurveTo(...points[1], ...points[2], ...points[3]);
    if (continuation) path.bezierCurveTo(...continuation[1], ...continuation[2], ...continuation[3]);
    sky.lineCap = "round";
    sky.setLineDash(level === 3 ? [2, 6] : []);
    sky.lineWidth = 8;
    sky.strokeStyle = `rgba(${tint}, .13)`;
    sky.stroke(path);
    sky.lineWidth = level === 3 ? 2.8 : 2.4;
    sky.strokeStyle = `rgba(${tint}, .94)`;
    sky.stroke(path);
  }
  return { backdrop, probe, probeX, probeY, probeLeft, probeTop };
}

function paintDistantSky(context) {
  let seed = 23081;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function haze(x, y, radius, tint, opacity) {
    const wash = context.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, `rgba(${tint}, ${opacity})`);
    wash.addColorStop(1, `rgba(${tint}, 0)`);
    context.fillStyle = wash;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  haze(1440, 577, 190, "73, 62, 151", .26);
  haze(1260, 817, 192, "74, 66, 161", .28);
  haze(1120, 936, 127, "116, 67, 145", .21);
  for (let i = 0; i < 1800; i++) {
    const y = 420 + random() * 600;
    const center = 1545 - (y - 420) * .69 + 26 * Math.sin(y / 89);
    const x = center + (random() + random() - 1) * 225;
    if (x < 1040 || x > 1536) continue;
    const strength = random();
    context.fillStyle = i % 4 === 0
      ? `rgba(184, 154, 237, ${strength * .37})`
      : `rgba(137, 153, 245, ${strength * .48})`;
    const size = i % 27 === 0 ? 2.3 : .65 + strength * .7;
    context.fillRect(x, y, size, size);
  }

  for (const [x, y, radius] of [[1166, 600, 7], [1439, 446, 10], [1492, 686, 6], [1189, 866, 9], [1378, 963, 7]]) {
    haze(x, y, radius * 3, "146, 162, 249", .35);
    context.strokeStyle = "#c0caff9c";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x - radius, y);
    context.lineTo(x + radius, y);
    context.moveTo(x, y - radius);
    context.lineTo(x, y + radius);
    context.stroke();
    context.fillStyle = "#e7e9ff";
    context.fillRect(x - 1, y - 1, 2, 2);
  }

  const x = 1359;
  const y = 768;
  const radius = 72;
  context.save();
  context.translate(x, y);
  context.rotate(-.32);

  function rings(start, end, opacity) {
    context.globalAlpha = opacity;
    for (let band = 0; band < 13; band++) {
      context.strokeStyle = band % 4 === 0 ? "#b0b6f7" : "#7478ba";
      context.lineWidth = band % 4 === 0 ? 1.2 : .65;
      context.beginPath();
      context.ellipse(0, 0, 92 + band * 3.6, 27 + band * 1.2, 0, start, end);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  rings(Math.PI, Math.PI * 2, .5);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.save();
  context.clip();
  const atmosphere = context.createRadialGradient(-43, -42, 0, 12, 15, 103);
  atmosphere.addColorStop(0, "#a6b0ff");
  atmosphere.addColorStop(.36, "#575a9f");
  atmosphere.addColorStop(.76, "#25204c");
  atmosphere.addColorStop(1, "#130717");
  context.fillStyle = atmosphere;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  for (let band = -60; band <= 66; band += 4) {
    const wash = context.createLinearGradient(-66, 0, 73, 0);
    wash.addColorStop(0, "#ced0ff77");
    wash.addColorStop(.46, "#8285e353");
    wash.addColorStop(1, "#8285e300");
    context.strokeStyle = wash;
    context.lineWidth = .75;
    context.beginPath();
    context.moveTo(-72, band - 10);
    context.bezierCurveTo(-47, band + 5, 19, band + 11, 75, band - 4);
    context.stroke();
  }
  for (let i = 0; i < 4200; i++) {
    const px = (random() * 2 - 1) * radius;
    const py = (random() * 2 - 1) * radius;
    const opacity = Math.max(.09, .66 - (px + py) / 175) * random();
    context.fillStyle = i % 3 === 0 ? `rgba(15, 7, 31, ${opacity})` : `rgba(183, 192, 250, ${opacity * .52})`;
    context.fillRect(px, py, 1, 1);
  }
  context.restore();
  context.lineWidth = 1.6;
  const rim = context.createLinearGradient(-48, -62, 42, 62);
  rim.addColorStop(0, "#d3d8ff");
  rim.addColorStop(.45, "#8387be");
  rim.addColorStop(1, "#51476e22");
  context.strokeStyle = rim;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  rings(0, Math.PI, .74);
  context.restore();
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
  const { light: accent } = coverLevelColors[level];
  canvas.closest("a").style.setProperty("--level-glow", accent);
  const plate = document.createElement("canvas");
  plate.width = canvas.width;
  plate.height = canvas.height;
  const pen = plate.getContext("2d");
  const width = 220;
  const height = 104;
  pen.scale(plate.width / width, plate.height / height);
  display.scale(canvas.width / width, canvas.height / height);

  const ink = "#1b1130";
  const secondary = accent + "a3";
  const faint = "#696184";
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
      display.shadowBlur = 9;
      display.shadowColor = color;
      display.beginPath();
      display.arc(x, y, 2.8, 0, Math.PI * 2);
      display.fill();
    });
    display.globalAlpha = 1;
    display.shadowBlur = 0;
  };
}
