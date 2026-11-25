"use strict";

{
  const canvas = document.querySelector("#cover-motion");
  const toggle = document.querySelector("#cover-motion-toggle");
  const image = canvas?.previousElementSibling;
  if (image instanceof HTMLImageElement && toggle && canvas.getContext("2d")) {
    if (image.complete && image.naturalWidth) startCoverMotion(canvas, image, toggle);
    else image.addEventListener("load", () => startCoverMotion(canvas, image, toggle), { once: true });
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

  function orbit(x, y, phase, radius, speed) {
    return {
      x, y, core: 12, edge: 38,
      at(time) {
        const angle = time * speed + phase;
        const amplitude = radius * smooth(time / .9);
        return {
          dx: amplitude * Math.cos(angle), dy: amplitude * .8 * Math.sin(angle),
          cosine: 0, sine: 0,
        };
      },
    };
  }

  function rotation(x, y, core, edge, angleAt) {
    return {
      x, y, core, edge,
      at(time) {
        const angle = angleAt(time);
        return { dx: 0, dy: 0, cosine: Math.cos(angle) - 1, sine: Math.sin(angle) };
      },
    };
  }

  // The three nodes move at different rates. Overlapping motion fields bend
  // the connecting strokes, while each node's core translates as a unit.
  const patches = [
    preparePatch(245, 84, 150, 122, [
      orbit(276, 141, .1, 10, .97),
      orbit(315, 169, 2.3, 11, 1.18),
      orbit(347, 123, 4.1, 9, .82),
    ]),
    preparePatch(872, 86, 111, 94, [
      rotation(898, 153, 21, 26, (t) => -t * 1.13),
      rotation(942, 126, 29, 35, (t) => t * .75),
    ], true),
    preparePatch(378, 277, 173, 131, [
      rotation(464, 342, 65, 87, (t) => .26 * Math.sin(t * 1.1)),
    ]),
    preparePatch(1020, 277, 185, 131, [
      rotation(1140, 356, 50, 114, (t) => .32 * Math.sin(t * .83)),
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
            const { dx, dy, cosine, sine } = transforms[i];
            const localX = baseX - fields[i].x;
            const localY = baseY - fields[i].y;
            srcX += weight * (localX * cosine + localY * sine - dx);
            srcY += weight * (localY * cosine - localX * sine - dy);
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
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduced.matches;
  let visible = false;
  let time = 0;
  let lastFrame = 0;
  let frame = 0;

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
    if (playing && visible && !document.hidden) {
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
    playing = !reduced.matches;
    updatePlayback();
  });
  document.addEventListener("visibilitychange", updatePlayback);
  toggle.hidden = false;
  updatePlayback();
}
