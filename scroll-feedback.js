"use strict";

{
  const root = document.documentElement;
  const header = document.querySelector(".header");
  const main = document.querySelector("main");
  const nav = [...header.querySelectorAll('.main-nav a[href^="#"]')].map((link) => ({
    link, section: document.getElementById(link.hash.slice(1)),
  }));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(any-pointer: fine)");
  const scrollingKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  let lenis;
  let headerHeight = 0;
  let updateFrame = 0;
  let activeLink;

  function updateFeedback() {
    updateFrame = 0;
    const scrollTop = window.scrollY;
    const range = Math.max(1, root.scrollHeight - root.clientHeight);
    const progress = Math.min(1, Math.max(0, scrollTop / range));
    const readingLine = headerHeight + Math.min(120, innerHeight * .2);
    let current;
    for (const { link, section } of nav) {
      if (section && section.getBoundingClientRect().top <= readingLine) current = link;
    }

    header.style.setProperty("--reading-progress", progress.toFixed(4));
    header.toggleAttribute("data-scrolled", scrollTop > 12);
    if (current !== activeLink) {
      activeLink?.removeAttribute("aria-current");
      current?.setAttribute("aria-current", "location");
      activeLink = current;
    }
  }

  function scheduleFeedback() {
    if (!updateFrame) updateFrame = requestAnimationFrame(updateFeedback);
  }

  function updateHeader() {
    headerHeight = header.getBoundingClientRect().height;
    root.style.setProperty("--anchor-inset", `${Math.ceil(headerHeight) + 14}px`);
    scheduleFeedback();
  }

  function syncScrollPreferences() {
    if (reduced.matches || !finePointer.matches) {
      lenis?.destroy();
      lenis = undefined;
      return;
    }
    if (!lenis && window.Lenis) {
      lenis = new window.Lenis({
        autoRaf: true,
        lerp: .09,
        prevent: (node) => node.matches(".benchmark-scroll, select, textarea"),
      });
    }
  }

  function stopWheelMomentum() {
    if (lenis?.isScrolling !== "smooth") return;
    lenis.stop();
    lenis.start();
  }

  // Cancel residual wheel motion before a native anchor jump or keyboard scroll.
  window.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('a[href^="#"]')) stopWheelMomentum();
  });
  window.addEventListener("keydown", (event) => {
    if (scrollingKeys.has(event.key) && !(event.target instanceof Element &&
        event.target.closest("input, select, textarea, [contenteditable]"))) stopWheelMomentum();
  });
  window.addEventListener("popstate", stopWheelMomentum);
  window.addEventListener("scroll", scheduleFeedback, { passive: true });
  window.addEventListener("resize", updateHeader, { passive: true });
  reduced.addEventListener("change", syncScrollPreferences);
  finePointer.addEventListener("change", syncScrollPreferences);
  if ("ResizeObserver" in window) {
    const dimensions = new ResizeObserver(updateHeader);
    dimensions.observe(header);
    dimensions.observe(main);
  }

  const reveals = new Set();
  if ("IntersectionObserver" in window && "animate" in Element.prototype) {
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        if (reduced.matches || target.matches(":focus-within")) continue;
        const animation = target.animate(
          [{ opacity: .6, transform: "translateY(9px)" }, { opacity: 1, transform: "translateY(0)" }],
          { duration: 370, easing: "cubic-bezier(.2,.65,.3,1)" },
        );
        reveals.add(animation);
        const remove = () => reveals.delete(animation);
        animation.addEventListener("finish", remove, { once: true });
        animation.addEventListener("cancel", remove, { once: true });
      }
    }, { threshold: .1 });
    for (const target of main.querySelectorAll(".section-heading, .level-card, .future-grid, .citation-inner")) {
      const bounds = target.getBoundingClientRect();
      if (bounds.top >= innerHeight || bounds.bottom <= 0) observer.observe(target);
    }
    reduced.addEventListener("change", () => {
      if (reduced.matches) for (const animation of reveals) animation.cancel();
    });
  }

  root.classList.add("has-scroll-feedback");
  updateHeader();
  syncScrollPreferences();
}
