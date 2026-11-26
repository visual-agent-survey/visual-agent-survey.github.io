"use strict";

{
  const canvas = document.querySelector("#cover-motion");
  const toggle = document.querySelector("#cover-motion-toggle");
  const image = canvas?.previousElementSibling;
  if (image instanceof HTMLImageElement && toggle && "CanvasRenderingContext2D" in window) {
    toggle.hidden = false;
    toggle.addEventListener("click", async () => {
      toggle.disabled = true;
      try {
        await image.decode();
        if (canvas.getContext("2d")) startCoverMotion(canvas, image, toggle);
        else toggle.hidden = true;
      } catch {
        toggle.hidden = true;
      } finally {
        toggle.disabled = false;
      }
    }, { once: true });
  }
}

function startCoverMotion(canvas, image, toggle) {
  // All coordinates describe the original 3:1 artwork at this sample width.
  const width = 1280;
  const height = Math.round(width * image.naturalHeight / image.naturalWidth);
  const source = document.createElement("canvas");
  source.width = canvas.width = width;
  source.height = canvas.height = height;
  const input = source.getContext("2d");
  input.drawImage(image, 0, 0, width, height);
  const pixels = input.getImageData(0, 0, width, height).data;
  const output = canvas.getContext("2d");

  const smooth = (value) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };

  const cycle = 2 * Math.PI / 9;
  const hillTracks = [
    { start: 645, end: 934, heights: [323, 314, 321, 335, 324, 310, 292], phase: .1, tint: "226, 246, 228" },
    { start: 650, end: 932, heights: [356, 362, 355, 342, 337, 346, 356], phase: .46, tint: "255, 237, 169" },
    { start: 647, end: 934, heights: [351, 370, 387, 386, 367, 354, 359], phase: .81, tint: "232, 249, 225" },
  ];

  function field(x, y, core, edge, pose) {
    return {
      x, y, core, edge,
      at(time) {
        // Phase shifts let the gestures pass from left to right, then to the lower row.
        const beat = time * cycle;
        const phase = beat - x / width * 2.2 - (y > height / 2 ? 1.35 : 0);
        const { dx = 0, dy = 0, angle = 0, stretchY = 0 } = pose(phase, beat);
        const ramp = smooth(time / 1.25);
        return {
          dx: dx * ramp, dy: dy * ramp, stretchY: stretchY * ramp,
          cosine: Math.cos(angle * ramp) - 1, sine: Math.sin(angle * ramp),
        };
      },
    };
  }

  function drift(x, y, core, edge, horizontal, vertical, delay = 0) {
    return field(x, y, core, edge, (phase) => ({
      dx: horizontal * Math.sin(phase - delay),
      dy: vertical * Math.cos(phase - delay),
    }));
  }

  function sway(x, y, core, edge, amplitude, delay = 0) {
    return field(x, y, core, edge, (phase) => ({
      angle: amplitude * Math.sin(phase - delay),
    }));
  }

  const patches = [
    // The three linked nodes trace separate paths.
    preparePatch(245, 84, 150, 122, [
      drift(276, 141, 12, 38, 9, 7, .1),
      drift(315, 169, 12, 38, 10, 8, 2.3),
      drift(347, 123, 12, 38, 8, 6, 4.1),
    ]),
    preparePatch(440, 102, 63, 60, [
      drift(478, 132, 16, 27, 4, 3),
    ]),
    preparePatch(639, 77, 111, 118, [
      sway(701, 132, 37, 61, .12),
    ]),
    preparePatch(750, 91, 100, 111, [
      field(800, 148, 36, 56, (phase) => ({
        dy: 3 * Math.sin(phase),
        stretchY: -.075 * Math.sin(phase),
      })),
    ]),
    preparePatch(872, 86, 111, 94, [
      field(898, 153, 21, 26, (phase, beat) => ({
        angle: -2 * beat + .14 * Math.sin(phase),
      })),
      field(942, 126, 29, 35, (phase, beat) => ({
        angle: beat - .07 * Math.sin(phase),
      })),
    ], true),
    preparePatch(983, 79, 117, 119, [
      sway(1034, 104, 67, 94, .102),
    ]),
    preparePatch(1107, 109, 88, 89, [
      sway(1152, 163, 33, 47, .16),
    ]),
    // The lower row picks up the same cadence after the motifs above.
    preparePatch(56, 291, 218, 103, [
      drift(107, 344, 29, 47, 1.8, 5),
      drift(165, 344, 29, 47, 1.8, 5, .25),
      drift(221, 344, 29, 47, 1.8, 5, .5),
    ]),
    preparePatch(378, 277, 173, 131, [
      sway(464, 342, 65, 87, .24),
    ]),
    preparePatch(655, 283, 270, 120, [
      drift(750, 326, 28, 72, 3.2, 1.8),
      drift(843, 368, 37, 77, 5, 2.2, 1.3),
    ]),
    preparePatch(1020, 277, 185, 131, [
      sway(1140, 356, 50, 114, .28),
    ]),
  ];

  function preparePatch(left, top, w, h, fields, rigid = false) {
    const bitmap = output.createImageData(w, h);
    const weights = fields.map(() => new Float32Array(w * h));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const index = y * w + x;
        let strongest = 0;
        let owner = 0;
        fields.forEach((field, i) => {
          const radius = Math.hypot(left + x - field.x, top + y - field.y);
          const weight = smooth((field.edge - radius) / (field.edge - field.core));
          weights[i][index] = weight;
          if (weight > strongest) {
            strongest = weight;
            owner = i;
          }
        });
        const boundary = smooth(Math.min(x, y, w - 1 - x, h - 1 - y) / 12);
        // Feather rigid rotations by opacity so the teeth retain their shape.
        if (rigid && strongest) {
          weights.forEach((weight, i) => { weight[index] = Number(i === owner); });
        }
        bitmap.data[index * 4 + 3] = 255 * boundary * (rigid ? strongest : smooth(strongest * 3));
      }
    }
    return { left, top, w, h, fields, weights, bitmap };
  }

  function render(time) {
    renderLensLight(time);
    for (const { left, top, w, h, fields, weights, bitmap } of patches) {
      const transforms = fields.map((field) => field.at(time));
      const data = bitmap.data;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const index = y * w + x;
          const pixel = index * 4;
          const baseX = left + x;
          const baseY = top + y;
          if (!data[pixel + 3]) continue;
          let srcX = baseX;
          let srcY = baseY;
          for (let i = 0; i < fields.length; i++) {
            const weight = weights[i][index];
            if (!weight) continue;
            const { dx, dy, cosine, sine, stretchY } = transforms[i];
            const localX = baseX - fields[i].x;
            const localY = baseY - fields[i].y;
            srcX += weight * (localX * cosine + localY * sine - dx);
            srcY += weight * (localY * (cosine + stretchY) - localX * sine - dy);
          }
          const sx = Math.max(0, Math.min(width - 2, Math.floor(srcX)));
          const sy = Math.max(0, Math.min(height - 2, Math.floor(srcY)));
          const fx = Math.max(0, Math.min(1, srcX - sx));
          const fy = Math.max(0, Math.min(1, srcY - sy));
          const start = (sy * width + sx) * 4;
          for (let c = 0; c < 3; c++) {
            const i = start + c;
            const a = pixels[i] + (pixels[i + 4] - pixels[i]) * fx;
            const b = pixels[i + width * 4] + (pixels[i + width * 4 + 4] - pixels[i + width * 4]) * fx;
            data[pixel + c] = a + (b - a) * fy;
          }
        }
      }
      output.putImageData(bitmap, left, top);
    }
    renderHillTracks(time);
  }

  function hillPoint(track, progress) {
    const { start, end, heights } = track;
    const index = Math.min(heights.length - 2, Math.floor(progress * (heights.length - 1)));
    const t = progress * (heights.length - 1) - index;
    const before = heights[Math.max(0, index - 1)];
    const current = heights[index];
    const next = heights[index + 1];
    const after = heights[Math.min(index + 2, heights.length - 1)];
    const y = current + .5 * t * (next - before + t * (2 * before - 5 * current + 4 * next - after
      + t * (3 * current - before - 3 * next + after)));
    return [start + (end - start) * progress, y];
  }

  function renderHillTracks(time) {
    output.save();
    output.beginPath();
    output.roundRect(655, 283, 270, 120, 12);
    output.clip();
    output.lineCap = "round";
    for (const track of hillTracks) {
      const progress = (time * 2 / 9 + track.phase) % 1;
      const start = Math.max(0, progress - .21);
      const end = Math.min(1, progress + .035);
      const alpha = .8 * smooth(time / 1.25) * smooth(progress / .13) * smooth((1 - progress) / .12);
      const from = hillPoint(track, start);
      const to = hillPoint(track, end);
      const paint = output.createLinearGradient(from[0], from[1], to[0], to[1]);
      paint.addColorStop(0, `rgba(${track.tint}, 0)`);
      paint.addColorStop(.8, `rgba(${track.tint}, ${alpha})`);
      paint.addColorStop(1, `rgba(${track.tint}, 0)`);
      output.strokeStyle = paint;
      output.beginPath();
      output.moveTo(...from);
      for (let step = 1; step <= 14; step++) {
        output.lineTo(...hillPoint(track, start + (end - start) * step / 14));
      }
      output.lineWidth = 4.2;
      output.globalAlpha = .21;
      output.stroke();
      output.lineWidth = 1.8;
      output.globalAlpha = 1;
      output.stroke();
    }
    output.restore();
  }

  function renderLensLight(time) {
    const centerX = 162.5;
    const centerY = 147.3;
    output.clearRect(142, 126, 42, 43);
    output.save();
    output.beginPath();
    output.ellipse(centerX, centerY, 18.4, 18.2, 0, 0, 2 * Math.PI);
    output.clip();

    const beat = time * cycle;
    const x = centerX + 14 * Math.sin(beat - .45);
    const y = centerY - 6 + 5 * Math.cos(beat - .75);
    const intensity = smooth(time / 1.25);
    const sweep = output.createLinearGradient(x - 8, y - 10, x + 9, y + 11);
    sweep.addColorStop(0, "rgba(240, 255, 248, 0)");
    sweep.addColorStop(.49, `rgba(242, 255, 252, ${.31 * intensity})`);
    sweep.addColorStop(1, "rgba(240, 255, 248, 0)");
    output.fillStyle = sweep;
    output.fillRect(144, 129, 37, 37);

    const glint = output.createRadialGradient(x, y, 0, x, y, 5.3);
    glint.addColorStop(0, `rgba(255, 247, 210, ${.85 * intensity})`);
    glint.addColorStop(.28, `rgba(255, 244, 199, ${.48 * intensity})`);
    glint.addColorStop(1, "rgba(255, 244, 199, 0)");
    output.fillStyle = glint;
    output.fillRect(x - 6, y - 6, 12, 12);
    output.restore();
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let playing = true;
  let visible = false;
  let time = 0;
  let lastFrame = 0;
  let frame = 0;
  let scrollTimer = 0;

  function animate(now) {
    if (now - lastFrame >= 30) {
      time += lastFrame ? Math.min((now - lastFrame) / 1000, .08) : 0;
      lastFrame = now;
      render(time);
    }
    frame = requestAnimationFrame(animate);
  }

  function updatePlayback() {
    toggle.textContent = playing ? "Pause animation" : "Play animation";
    if (playing && visible && !document.hidden && !scrollTimer) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  }).observe(canvas);
  toggle.addEventListener("click", () => {
    playing = !playing;
    updatePlayback();
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) playing = false;
    updatePlayback();
  });
  window.addEventListener("scroll", () => {
    if (!playing || !visible) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      scrollTimer = 0;
      updatePlayback();
    }, 150);
    if (frame) updatePlayback();
  }, { passive: true });
  document.addEventListener("visibilitychange", updatePlayback);
  toggle.hidden = false;
  updatePlayback();
}
