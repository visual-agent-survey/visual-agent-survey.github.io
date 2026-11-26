"use strict";

{
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const desktopMotion = matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)");
  const chapters = [...header.querySelectorAll('.main-nav a[href^="#"]')].flatMap((link) => {
    const section = document.getElementById(link.hash.slice(1));
    return section ? [{ link, section, top: 0 }] : [];
  });
  const scenes = [...document.querySelectorAll("[data-scroll-stage]")].flatMap((stage) => {
    const layer = stage.querySelector("[data-scroll-layer]");
    return layer ? [{ stage, layer, kind: layer.dataset.scrollLayer, top: 0, height: 0, offset: 0 }] : [];
  });
  const visible = new Set();
  let chapterInset = 0;
  let viewport = 0;
  let frame = 0;
  let current;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function update() {
    frame = 0;
    const y = window.scrollY;

    let active;
    for (const { link, top } of chapters) {
      if (y + chapterInset >= top) active = link;
    }
    if (active !== current) {
      current?.removeAttribute("aria-current");
      active?.setAttribute("aria-current", "location");
      current = active;
    }

    if (!desktopMotion.matches) return;
    for (const scene of visible) {
      const center = scene.top - y + scene.height / 2;
      const travel = scene.kind === "hero"
        ? -Math.min(20, scene.height * .045) * clamp(y / (scene.top + scene.height), 0, 1)
        : -10 * clamp((center - viewport / 2) / (viewport / 2 + scene.height / 2), -1, 1);
      const offset = Math.round(travel * 10) / 10;
      if (offset === scene.offset) continue;
      scene.offset = offset;
      scene.layer.style.setProperty("--scene-y", `${offset}px`);
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function measure() {
    const headerHeight = header.getBoundingClientRect().height;
    const y = window.scrollY;
    viewport = innerHeight;
    chapterInset = headerHeight + Math.min(120, viewport * .2);
    for (const chapter of chapters) chapter.top = y + chapter.section.getBoundingClientRect().top;
    for (const scene of scenes) {
      const bounds = scene.stage.getBoundingClientRect();
      scene.top = y + bounds.top;
      scene.height = bounds.height;
    }
    root.style.setProperty("--anchor-inset", `${Math.ceil(headerHeight) + 14}px`);
    schedule();
  }

  if ("IntersectionObserver" in window) {
    const byStage = new Map(scenes.map((scene) => [scene.stage, scene]));
    const visibility = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const scene = byStage.get(target);
        if (isIntersecting) visible.add(scene);
        else visible.delete(scene);
      }
      schedule();
    }, { rootMargin: "90px 0px" });
    for (const { stage } of scenes) visibility.observe(stage);
  }

  if ("ResizeObserver" in window) {
    const layout = new ResizeObserver(measure);
    for (const node of [header, ...document.querySelectorAll("main section")]) layout.observe(node);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  desktopMotion.addEventListener("change", schedule);
  measure();
}
