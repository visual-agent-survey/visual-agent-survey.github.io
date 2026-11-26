"use strict";

{
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const nav = [...header.querySelectorAll('.main-nav a[href^="#"]')].flatMap((link) => {
    const section = document.getElementById(link.hash.slice(1));
    return section ? [{ link, section, top: 0 }] : [];
  });
  let range = 1;
  let readingInset = 0;
  let frame = 0;
  let current;

  function update() {
    frame = 0;
    const y = window.scrollY;
    header.style.setProperty("--reading-progress", Math.min(1, Math.max(0, y / range)).toFixed(4));
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
    for (const entry of nav) entry.top = y + entry.section.getBoundingClientRect().top;
    root.style.setProperty("--anchor-inset", `${Math.ceil(headerHeight) + 14}px`);
    schedule();
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
}
