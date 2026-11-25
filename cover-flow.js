"use strict";

{
  const canvas = document.querySelector("#cover-flow");
  const toggle = document.querySelector("#cover-flow-toggle");
  const context = canvas?.getContext("2d");
  if (context && toggle) startCoverFlow(canvas, context, toggle);
}

function startCoverFlow(canvas, context, toggle) {
  const tau = 2 * Math.PI;
  const fraction = (value) => value - Math.floor(value);

  // Interpolate the landmarks on each painted ribbon in image coordinates.
  function ribbon(heights) {
    return (progress, offset, time) => {
      const x = fraction(progress);
      const position = x * (heights.length - 1);
      const index = Math.floor(position);
      const t = fraction(position);
      const a = heights[Math.max(0, index - 1)];
      const b = heights[index];
      const c = heights[index + 1];
      const d = heights[Math.min(index + 2, heights.length - 1)];
      const y = b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * b - a - 3 * c + d)));
      return [x, y + offset + .009 * Math.sin(tau * (2 * x - .18 * time))];
    };
  }

  function drift(from, to, height, lift) {
    return (progress, offset) => {
      const t = fraction(progress);
      return [from + (to - from) * t, height + offset - lift * Math.sin(Math.PI * t)];
    };
  }

  const lanes = [
    { count: 36, speed: .097, spread: .065, color: "#338888", path: ribbon([.36, .24, .32, .18, .21, .38, .22, .15, .32, .29, .16, .06, .15]) },
    { count: 35, speed: .075, spread: .073, color: "#477e67", path: ribbon([.42, .48, .32, .29, .20, .17, .34, .17, .26, .17, .08, .12, .29]) },
    { count: 11, speed: .15, spread: .002, color: "#a5782f", path: (t, offset) => [.017 + .976 * fraction(t), .598 + offset] },
    { count: 11, speed: .27, spread: .038, color: "#487f79", path: drift(.025, .235, .821, .056) },
    { count: 12, speed: .24, spread: .035, color: "#5f8457", closed: true,
      path: (t, offset) => [.371 + (.058 + offset / 3) * Math.cos(tau * t), .806 + (.117 + offset) * Math.sin(tau * t)] },
    { count: 12, speed: .27, spread: .076, color: "#a87b3b", path: drift(.503, .726, .832, .085) },
    { count: 13, speed: .23, spread: .14, color: "#438370",
      path: (t, offset) => {
        const progress = fraction(t);
        const angle = tau * (1.4 * progress + offset * 2.5);
        const radius = (1 - progress) * (.83 + 2 * offset);
        return [.891 + .075 * radius * Math.cos(angle), .837 + .148 * radius * Math.sin(angle)];
      } },
  ];
  const particles = lanes.flatMap((lane, laneIndex) => Array.from({ length: lane.count }, (_, index) => {
    const sample = (salt) => fraction(Math.sin((index + 1) * 83.19 + laneIndex * 53.73 + salt * 127.1) * 41253.31);
    return {
      lane, index,
      phase: (index + sample(1)) / lane.count,
      rate: lane.speed * (.76 + .48 * sample(2)),
      offset: lane.spread * (sample(3) - .5),
      opacity: .58 + .37 * sample(4),
      tail: .15 + .28 * sample(5),
    };
  }));

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let playing = !reduced.matches;
  let visible = false;
  let width = 0;
  let height = 0;
  let time = 0;
  let lastFrame = 0;
  let frame = 0;

  function render() {
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    const compact = width < 640;
    const radius = Math.max(.7, Math.min(1.85, width / 630));
    for (const { lane, index, phase, rate, offset, opacity, tail } of particles) {
      if (compact && index % 2) continue;
      const t = fraction(phase + time * rate);
      const fade = lane.closed ? 1 : Math.min(1, t / .065, (1 - t) / .075);
      const [x, y] = lane.path(t, offset, time);
      context.strokeStyle = lane.color;
      context.lineWidth = radius * 1.13;
      for (let step = 4; step > 0; step--) {
        const back = t - rate * tail * step / 4;
        if (!lane.closed && back < 0) continue;
        const [fromX, fromY] = lane.path(back, offset, time - tail * step / 4);
        const [toX, toY] = lane.path(back + rate * tail / 4, offset, time - tail * (step - 1) / 4);
        context.globalAlpha = fade * opacity * (5 - step) * .12;
        context.beginPath();
        context.moveTo(fromX * width, fromY * height);
        context.lineTo(toX * width, toY * height);
        context.stroke();
      }
      context.globalAlpha = opacity * fade;
      context.fillStyle = lane.color;
      context.beginPath();
      context.arc(x * width, y * height, radius, 0, tau);
      context.fill();
      context.globalAlpha *= .78;
      context.fillStyle = "#fff9df";
      context.beginPath();
      context.arc(x * width, y * height, radius * .52, 0, tau);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function animate(now) {
    if (lastFrame) time += Math.min((now - lastFrame) / 1000, .045);
    lastFrame = now;
    render();
    frame = requestAnimationFrame(animate);
  }

  function updatePlayback() {
    toggle.textContent = playing ? "Pause animation" : "Play animation";
    if (playing && visible && !document.hidden && width && height) {
      if (!frame) frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    }
  }

  new ResizeObserver(([entry]) => {
    ({ width, height } = entry.contentRect);
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (time) render();
    updatePlayback();
  }).observe(canvas);

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
