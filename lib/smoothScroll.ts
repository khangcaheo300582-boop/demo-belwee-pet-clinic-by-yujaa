import type { MouseEvent } from "react";

const HEADER_OFFSET = 96;

export function scrollToHash(hash: string) {
  if (typeof window === "undefined" || !hash.startsWith("#")) return;

  const id = hash.slice(1);
  if (!id) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const target = document.getElementById(id);
  if (!target) return;

  const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  window.scrollTo({ top, behavior: "smooth" });
}

export function handleAnchorClick(
  e: MouseEvent<HTMLAnchorElement>,
  href: string,
  onNavigate?: () => void
) {
  if (!href.startsWith("#")) return;

  e.preventDefault();
  scrollToHash(href);
  onNavigate?.();
}
