"use client";

import { useEffect, useRef } from "react";

/**
 * Global ambient animation manager.
 * - Toggles `is-offscreen` on the aurora mesh blobs so they pause via
 *   `animation-play-state` when the user scrolls past the hero (they sit in a
 *   fixed layer that always repaints on transform, wasteful when content below).
 * - Observes marquee wrappers so infinite marquee tracks pause when their
 *   section leaves the viewport.
 */
export default function AmbientPause() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    let blobPaused = false;

    // Re-query blobs if they mount later (layout is static, so they exist here).
    const markBlobs = () => {
      document.querySelectorAll<HTMLElement>(".apple-mesh-blob").forEach((el) => {
        el.classList.add("offscreen-pausable");
      });
    };
    markBlobs();

    const applyBlobState = () => {
      document.querySelectorAll<HTMLElement>(".apple-mesh-blob").forEach((el) => {
        el.classList.toggle("is-offscreen", blobPaused);
      });
    };

    const handleScroll = () => {
      const shouldPause = window.scrollY > window.innerHeight * 1.6;
      if (shouldPause !== blobPaused) {
        blobPaused = shouldPause;
        applyBlobState();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // Observe marquee wrappers so infinite tracks pause when offscreen.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
        });
      },
      { threshold: 0.01, rootMargin: "300px 0px" }
    );

    const marquees = document.querySelectorAll<HTMLElement>(".marquee-fade");
    marquees.forEach((el) => observer.observe(el));

    cleanupRef.current = () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
      document.querySelectorAll<HTMLElement>(".apple-mesh-blob").forEach((el) => {
        el.classList.remove("is-offscreen", "offscreen-pausable");
      });
    };

    return () => cleanupRef.current?.();
  }, []);

  return null;
}
