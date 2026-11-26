"use strict";

{
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const readingSurface = document.querySelector(".reading-surface");
  const footer = document.querySelector(".footer");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(any-pointer: fine)");
  const desktopMotion = matchMedia("(min-width: 761px) and (prefers-reduced-motion: no-preference)");
  const scrollKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
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
  let lenis;
  let readingObserver;
  let observedInset = "";
  let headerAnimation;
  let readingAtHeader = false;
  let footerVisible = false;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function setReadingMode(reading, animate = false) {
    if (header.hasAttribute("data-reading") === reading) return;
    headerAnimation?.cancel();
    header.toggleAttribute("data-reading", reading);
    if (reading && animate && !reduced.matches && !header.querySelector(":focus-visible")) {
      headerAnimation = header.animate?.(
        [{ transform: "translateY(-100%)" }, { transform: "translateY(0)" }],
        { duration: 280, easing: "cubic-bezier(.2,.7,.25,1)" },
      );
    }
  }

  function updateReadingMode(animate) {
    setReadingMode(readingAtHeader && !footerVisible, animate);
  }

  function watchReadingSurface(headerHeight) {
    const line = Math.min(headerHeight + 14, Math.max(0, viewport - 2));
    const margin = `-${line}px 0px -${Math.max(0, viewport - line - 2)}px 0px`;
    if (margin === observedInset) return;
    observedInset = margin;
    readingObserver?.disconnect();
    const bounds = readingSurface.getBoundingClientRect();
    readingAtHeader = bounds.top < line + 2 && bounds.bottom > line;
    footerVisible = footer.getBoundingClientRect().top < viewport - 24;
    updateReadingMode(false);
    if ("IntersectionObserver" in window) {
      readingObserver = new IntersectionObserver(([entry]) => {
        readingAtHeader = entry.isIntersecting;
        updateReadingMode(true);
      }, { rootMargin: margin });
      readingObserver.observe(readingSurface);
    }
  }

  function syncLenis() {
    if (reduced.matches) headerAnimation?.cancel();
    if (reduced.matches || !finePointer.matches) {
      lenis?.destroy();
      lenis = undefined;
    } else if (!lenis && window.Lenis) {
      lenis = new window.Lenis({
        autoRaf: true,
        lerp: .32,
        prevent: (node) => node.matches(".benchmark-scroll, select, textarea, .citation-code pre"),
      });
    }
  }

  function stopMomentum() {
    if (lenis?.isScrolling !== "smooth") return;
    lenis.stop();
    lenis.start();
  }

  function update() {
    frame = 0;
    const y = window.scrollY;

    if (!readingObserver) {
      const bounds = readingSurface.getBoundingClientRect();
      const line = header.offsetHeight + 14;
      readingAtHeader = bounds.top < line + 2 && bounds.bottom > line;
      footerVisible = footer.getBoundingClientRect().top < viewport - 24;
      updateReadingMode(false);
    }

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
    const headerHeight = header.offsetHeight;
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
    watchReadingSurface(headerHeight);
    schedule();
  }

  if ("IntersectionObserver" in window) {
    const footerObserver = new IntersectionObserver(([entry]) => {
      footerVisible = entry.isIntersecting;
      updateReadingMode(true);
    }, { rootMargin: "0px 0px -24px 0px" });
    footerObserver.observe(footer);

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
  window.addEventListener("click", (event) => {
    if (event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
        event.target instanceof Element && event.target.closest('a[href^="#"]')) stopMomentum();
  });
  window.addEventListener("keydown", (event) => {
    if (scrollKeys.has(event.key) && event.target instanceof Element &&
        !event.target.closest("input, select, textarea, [contenteditable]")) stopMomentum();
  });
  window.addEventListener("popstate", stopMomentum);
  desktopMotion.addEventListener("change", schedule);
  reduced.addEventListener("change", syncLenis);
  finePointer.addEventListener("change", syncLenis);
  measure();
  syncLenis();
}
