"use strict";

{
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const hero = document.querySelector(".hero");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(any-pointer: fine)");
  const scrollingKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const nav = [...header.querySelectorAll('.main-nav a[href^="#"]')].flatMap((link) => {
    const section = document.getElementById(link.hash.slice(1));
    return section ? [{ link, section, top: 0 }] : [];
  });
  let range = 1;
  let readingInset = 0;
  let heroEnd = 0;
  let frame = 0;
  let current;
  let lenis;

  function update() {
    frame = 0;
    const y = window.scrollY;
    header.style.setProperty("--reading-progress", Math.min(1, Math.max(0, y / range)).toFixed(4));
    header.toggleAttribute("data-past-hero", y >= heroEnd);
    let active;
    for (const { link, top } of nav) {
      if (y + readingInset >= top) active = link;
    }
    if (active !== current) {
      current?.removeAttribute("aria-current");
      active?.setAttribute("aria-current", "location");
      current = active;
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function measure() {
    const headerHeight = header.getBoundingClientRect().height;
    const y = window.scrollY;
    range = Math.max(1, root.scrollHeight - root.clientHeight);
    readingInset = headerHeight + Math.min(120, innerHeight * .2);
    heroEnd = y + hero.getBoundingClientRect().bottom - headerHeight;
    for (const entry of nav) entry.top = y + entry.section.getBoundingClientRect().top;
    root.style.setProperty("--anchor-inset", `${Math.ceil(headerHeight) + 14}px`);
    root.style.setProperty("--hero-header-height", `${headerHeight}px`);
    schedule();
  }

  function syncScroll() {
    if (reduced.matches || !finePointer.matches) {
      lenis?.destroy();
      lenis = undefined;
    } else if (!lenis && window.Lenis) {
      lenis = new window.Lenis({
        autoRaf: true,
        lerp: .32,
        prevent: (node) => node.matches(".benchmark-scroll, select, textarea"),
      });
    }
  }

  function stopMomentum() {
    if (lenis?.isScrolling !== "smooth") return;
    lenis.stop();
    lenis.start();
  }

  window.addEventListener("click", (event) => {
    if (event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
        event.target instanceof Element && event.target.closest('a[href^="#"]')) stopMomentum();
  });
  window.addEventListener("keydown", (event) => {
    if (scrollingKeys.has(event.key) && event.target instanceof Element &&
        !event.target.closest("input, select, textarea, [contenteditable]")) stopMomentum();
  });
  window.addEventListener("popstate", stopMomentum);
  reduced.addEventListener("change", syncScroll);
  finePointer.addEventListener("change", syncScroll);

  const reveals = new Set();
  if ("IntersectionObserver" in window && "animate" in Element.prototype) {
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        if (reduced.matches || target.matches(":focus-within")) continue;
        const animation = target.animate(
          [{ opacity: .86, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 200, easing: "ease-out" },
        );
        reveals.add(animation);
        animation.finished.then(() => reveals.delete(animation), () => reveals.delete(animation));
      }
    }, { threshold: .08 });
    for (const target of document.querySelectorAll(".section-heading, .level-card, .future-grid")) {
      observer.observe(target);
    }
    reduced.addEventListener("change", () => {
      if (reduced.matches) for (const animation of reveals) animation.cancel();
    });
  }

  // Recompute offsets when chapter content changes, then reuse them on scroll.
  if ("ResizeObserver" in window) {
    const layout = new ResizeObserver(measure);
    for (const node of [document.body, header, ...Array.from(document.querySelectorAll("main > section"))]) {
      layout.observe(node);
    }
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  root.classList.add("has-scroll-feedback");
  measure();
  syncScroll();
}
