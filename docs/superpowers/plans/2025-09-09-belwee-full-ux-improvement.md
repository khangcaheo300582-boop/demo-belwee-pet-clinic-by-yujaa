# Belwee Pet Clinic — Full UX Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the entire Belwee Pet Clinic website UX — fix routing, add page transitions, loading skeletons, optimize navbar/hamburger, video hero crossfade, scroll effects, knowledge carousel, featured activities, auth flows, staff pages, responsive, and performance.

**Architecture:** Next.js 14 App Router with GSAP/Framer Motion animations, Apple Liquid Glass design system, NextAuth + custom staff HMAC auth, MongoDB. All improvements preserve existing design language, brand colors, and functionality.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS 3, GSAP + ScrollTrigger, Framer Motion, NextAuth, MongoDB/Mongoose, lucide-react

**Spec:** User requirements document covering 19 sections of UX improvements

## Global Constraints

- Framework: Next.js 14.2.4 App Router — do NOT upgrade
- Must NOT install new dependencies unless absolutely necessary (prefer CSS/JS/React/GSAP already in project)
- All animations must respect `prefers-reduced-motion`
- No new npm packages — use existing gsap, framer-motion, tailwind, lucide-react
- Preserve all existing branding, colors, images, videos, content, and logic
- Build must pass (`npm run build`) after every task
- Lint must pass (`npm run lint`) after every task

---

## Phase 1: Routing, Page Transitions & Loading System

### Task 1: Create shared PageTransition wrapper and Skeleton components

**Files:**
- Create: `components/PageTransition.tsx`
- Create: `components/skeletons/PageSkeleton.tsx`
- Create: `components/skeletons/HomeSkeleton.tsx`
- Create: `components/skeletons/ServicesSkeleton.tsx`
- Create: `components/skeletons/ContentSkeleton.tsx`

- [ ] **Step 1:** Create `components/PageTransition.tsx` — a wrapper that uses framer-motion to animate page entrance (fade + slight y-offset). Replaces current `template.tsx` logic with a more controlled transition that fires on route change.

```tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2:** Create skeleton components for different page types (HomeSkeleton mimics hero+cards layout, ServicesSkeleton mimics service grid, ContentSkeleton is generic).

- [ ] **Step 3:** Replace `app/template.tsx` with the new PageTransition or integrate it into layout.tsx wrapping `{children}`.

- [ ] **Step 4:** Update `hooks/useTransitionNavigate.ts` to use `page-exit` CSS class more reliably (current implementation uses `setTimeout` with `PAGE_EXIT_MS = 260` — verify it works with the new transition system).

- [ ] **Step 5:** Build and lint.

### Task 2: Fix all navigation links to use transition system

**Files:**
- Modify: `components/SiteNavbar.tsx` (ensure all links use `transitionNavigate`)
- Modify: `components/Footer.tsx` (add Link components with transitions for footer links)
- Verify: All card links, button links across pages use `useTransitionNavigate`

- [ ] **Step 1:** Audit every `<Link>` and `<a>` in the codebase. Ensure client-side navigation uses `useTransitionNavigate()` hook instead of raw `<Link>` without onClick handling.

- [ ] **Step 2:** Fix Footer links — currently footer links are plain `<li>` elements with hover styling but no actual navigation. Add proper `<Link>` components or `<a>` tags to the footer service items and branch addresses.

- [ ] **Step 3:** Verify all `navigate()` calls in SiteNavbar correctly trigger transition before routing.

- [ ] **Step 4:** Build and lint.

### Task 3: Fix duplicate registration page

**Files:**
- Verify: `app/tao-tai-khoan/page.tsx` (already redirects to `/dang-nhap?mode=register`)
- Modify: Remove link to `/tao-tai-khoan` from `app/cap-lai-mat-khau/page.tsx` (line pointing to "Tạo tài khoản mới" goes to `/tao-tai-khoan` which redirects — this is fine but could be cleaner)
- Modify: `app/dang-nhap/page.tsx` — the "Tạo tài khoản riêng" link at bottom already points to `/tao-tai-khoan` which redirects back. Simplify this.

- [ ] **Step 1:** In `app/cap-lai-mat-khau/page.tsx`, change the "Tạo tài khoản mới" link from `/tao-tai-khoan` to `/dang-nhap?mode=register` directly.

- [ ] **Step 2:** In `app/dang-nhap/page.tsx`, the bottom "Tạo tài khoản riêng" link goes to `/tao-tai-khoan` which just redirects. Change to open register mode directly: the tab switch already handles this. Consider removing the separate link or making it toggle the tab.

- [ ] **Step 3:** Build and lint.

---

## Phase 2: Navbar & Hamburger Improvements

### Task 4: Improve navbar scroll state transitions

**Files:**
- Modify: `app/globals.css` (navbar CSS)
- Modify: `components/SiteNavbar.tsx` (scroll logic)

The current navbar already has good scroll behavior with `is-at-top`, `is-active`, `is-morph` states. Improvements needed:
- Smooth width expansion on scroll (currently uses scaleX which looks compressed)
- Ensure even distribution of elements at both states

- [ ] **Step 1:** In `globals.css`, update the morph transition to use width/padding change instead of scaleX (scaleX distorts text). The nav should expand horizontally with padding increase, not scale.

- [ ] **Step 2:** Verify navbar element spacing stays even at both top and scrolled states. Add `justify-content: space-between` consistently.

- [ ] **Step 3:** Add proper transition for the "Đặt lịch hẹn" button to appear/expand smoothly when scrolling.

- [ ] **Step 4:** Build and verify on multiple viewports (320px, 768px, 1280px, 1440px).

### Task 5: Improve hamburger menu overlay and close behavior

**Files:**
- Modify: `components/SiteNavbar.tsx` (hamburger logic)
- Modify: `app/globals.css` (hamburger CSS)

- [ ] **Step 1:** Verify overlay click-to-close works reliably.
- [ ] **Step 2:** Add body scroll lock when hamburger is open (already done via `body.hamburger-open` CSS class with `overflow: hidden` — verify it works).
- [ ] **Step 3:** Ensure Escape key closes the hamburger (already implemented in useEffect).
- [ ] **Step 4:** Test hamburger on 320px, 375px, 768px, 1024px viewports — verify the grid layout adapts (currently 3-col -> 2-col -> 1-col).
- [ ] **Step 5:** Build and lint.

---

## Phase 3: Video Hero & Intro Optimizations

### Task 6: Improve hero video crossfade between belwee-hero.mp4 and belwee-super.mp4

**Files:**
- Modify: `app/page.tsx` (hero video section)

Current implementation: Uses `transition-opacity duration-1000` CSS class to crossfade. When one video ends, `activeHeroVideo` state flips and opacity transitions. Issues to fix:
- Both videos play simultaneously (wasteful)
- Crossfade is not truly simultaneous — next video starts after current ends
- Need preloading of next video

- [ ] **Step 1:** Modify the video crossfade logic so both videos can play simultaneously during transition (the hidden video should be preloaded with `preload="metadata"` and have `currentTime = 0` set when it's about to be shown).

- [ ] **Step 2:** Start crossfade slightly before video ends (at ~95% progress using `timeupdate` event) to avoid black frame between videos.

- [ ] **Step 3:** Ensure `belwee-super.mp4` is also cached via `next.config.mjs` headers (currently only `belwee-intro.mp4` and `belwee-hero.mp4` have cache headers).

- [ ] **Step 4:** Build and lint.

### Task 7: Improve intro video error handling

**Files:**
- Modify: `components/IntroVideo.tsx`

- [ ] **Step 1:** The current `onError={finish}` handler already skips intro on error. Verify the safety timeout (14s) is sufficient.
- [ ] **Step 2:** Add `onWaiting` and `onStalled` handlers to show a "Bỏ qua" skip button earlier if video is stalling.
- [ ] **Step 3:** Build and lint.

---

## Phase 4: Scroll Effects

### Task 8: Improve scroll-triggered animations across homepage sections

**Files:**
- Modify: `app/page.tsx` (section reveal logic)
- Modify: `components/AnimationProvider.tsx` (data-reveal scanner)

Current system: Uses GSAP ScrollTrigger with `data-reveal` attributes. The `data-reveal-exit` attribute creates bidirectional fade (visible when in viewport, hidden when scrolled past).

- [ ] **Step 1:** Verify all sections on homepage have proper `data-reveal` or `data-reveal-exit` attributes. Currently: services section has it, vet section has it, knowledge section uses `<Reveal>` component, featured activities uses `data-reveal` and `data-reveal-group`.

- [ ] **Step 2:** Ensure scroll reveal uses `transform` and `opacity` only (no layout properties). Current implementation already uses `autoAlpha` (opacity) + `y` (translateY) which is optimal.

- [ ] **Step 3:** Verify IntersectionObserver cleanup in AnimationProvider (already has proper cleanup in useEffect return).

- [ ] **Step 4:** Add the hero video fade + background image reveal when scrolling past hero. This is already partially implemented via `bgRef` GSAP ScrollTrigger (opacity 0→1 on scroll from 0% to 60%). Verify it works smoothly.

- [ ] **Step 5:** Build and lint.

---

## Phase 5: Knowledge Carousel & Service/Doctor Cards

### Task 9: Improve knowledge section carousel with gradient edge masks

**Files:**
- Modify: `app/page.tsx` (knowledge section)

- [ ] **Step 1:** The knowledge section already has horizontal scroll. Add CSS `mask-image` gradient fade on left/right edges (similar to `marquee-fade` class already used). Apply to `knowledgeScrollRef` container.

- [ ] **Step 2:** Improve the left/right scroll buttons — add disabled state when at start/end of scroll. Use `scrollLeft` measurement to determine position.

- [ ] **Step 3:** On mobile, ensure one card at a time fits within viewport (current card width is `w-[300px] sm:w-[340px]` — verify this fits 375px mobile).

- [ ] **Step 4:** Build and lint.

### Task 10: Ensure marquee cards (services + vets) run smoothly without lag

**Files:**
- Verify: `app/page.tsx` marquee logic
- Verify: `app/globals.css` marquee performance CSS

The current marquee already has performance optimizations:
- `will-change: transform` on track
- `backface-visibility: hidden`
- `backdrop-filter: none` during animation, restored on hover
- IntersectionObserver pause when offscreen

- [ ] **Step 1:** Verify marquee doesn't cause layout shift. Check if `w-max` on track with `gap-6` cards creates any overflow issues.

- [ ] **Step 2:** Test marquee on mobile (375px) — ensure no horizontal overflow from the page. The `marquee-fade` class should clip it.

- [ ] **Step 3:** Build and lint.

---

## Phase 6: Featured Activities Section

### Task 11: Verify "Hoạt động nổi bật tại Belwee" section

**Files:**
- Verify: `app/page.tsx` (featured activities section already exists at lines 915-936)

The section already exists with:
- 4 activity cards in a grid
- `data-reveal` and `data-reveal-group` attributes
- Apple glass styling
- Responsive grid (1-col -> 2-col -> 4-col)

- [ ] **Step 1:** Verify the section renders correctly and animations work.
- [ ] **Step 2:** Verify responsive behavior at all breakpoints.
- [ ] **Step 3:** Build and lint.

---

## Phase 7: Auth System Improvements

### Task 12: Implement success modal for login/registration

**Files:**
- Create: `components/AuthSuccessModal.tsx`
- Modify: `app/dang-nhap/page.tsx`
- Modify: `app/cap-lai-mat-khau/page.tsx`

- [ ] **Step 1:** Create `components/AuthSuccessModal.tsx` — a centered modal with:
  - Semi-transparent backdrop
  - Small card in center
  - Loading spinner → green checkmark → text
  - Auto-redirect after showing success

```tsx
"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AuthSuccessModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onRedirect: () => void;
  redirectDelayMs?: number;
}

export default function AuthSuccessModal({ isOpen, title, subtitle, onRedirect, redirectDelayMs = 2500 }: AuthSuccessModalProps) {
  // Phase: loading -> checkmark -> redirecting
  // ...
}
```

- [ ] **Step 2:** Integrate into `app/dang-nhap/page.tsx` — replace the inline success `setMessage()` with modal display. On login success, show modal with "Đăng nhập thành công" → "Đang chuyển hướng" → redirect. On register success, show "Tạo tài khoản thành công" → "Đang đăng nhập tự động" → redirect.

- [ ] **Step 3:** Integrate into `app/cap-lai-mat-khau/page.tsx` — same pattern for password reset success.

- [ ] **Step 4:** Ensure form is disabled during modal display (prevent double submit).

- [ ] **Step 5:** Build and lint.

### Task 13: Improve terms of service modal

**Files:**
- Modify: `app/dang-nhap/page.tsx` (terms modal section)

- [ ] **Step 1:** Change the "Xác Nhận ->" button to "Tiếp theo" and add a back arrow button beside it.
- [ ] **Step 2:** Show step indicator as "Bước X/4" instead of "Thẻ X / 5".
- [ ] **Step 3:** Add back button functionality — when going back, `currentTerm` decrements.
- [ ] **Step 4:** Ensure next button is only enabled when the current term conditions are met (for the current implementation, each term is just text to read, so "enabled" means the term has been displayed).
- [ ] **Step 5:** Verify terms content is readable on mobile (text doesn't overflow, buttons don't obscure text).
- [ ] **Step 6:** Build and lint.

### Task 14: Apply Liquid Design styling to auth pages

**Files:**
- Modify: `app/dang-nhap/page.tsx`
- Modify: `app/cap-lai-mat-khau/page.tsx`

Current auth pages use a dark background (`bg-[#0a0f1c]`) with glass card styling. The Staff login uses a different dark gradient with emerald accents. The goal is to unify the design language.

- [ ] **Step 1:** Update the login page's card styling to use the same gradient border and glass effects as the staff login (rounded-3xl, border-white/15, bg-white/10, backdrop-blur-3xl, shadow-vision-glass).

- [ ] **Step 2:** Update form input focus states to match staff login (emerald-300/50 border focus with glow ring).

- [ ] **Step 3:** Update button styling (rounded-2xl with liquid glow effect).

- [ ] **Step 4:** Ensure form states (default, focus, filled, error, loading, disabled) are all properly styled.

- [ ] **Step 5:** Build and lint.

---

## Phase 8: Staff Page Improvements

### Task 15: Verify and fix staff pages

**Files:**
- Verify: `app/staff/login/page.tsx`
- Verify: `app/staff/dashboard/page.tsx`
- Verify: `app/staff/receipts/page.tsx`
- Verify: `components/staff/StaffLoginClient.tsx`
- Verify: `components/staff/StaffDashboard.tsx`
- Verify: `components/staff/ReceiptsClient.tsx`
- Verify: `middleware.ts` (route protection)

- [x] **Step 1:** Verify staff login flow: credentials → PIN → dashboard redirect. Check the API calls to `/api/staff/login` work correctly.
      _Verified: `verify-route-and-logout.cjs` drives the real 2-phase handshake (password → `stepToken` → PIN) and gets 200._

- [x] **Step 2:** Verify route protection: accessing `/staff/dashboard` without cookie redirects to `/staff/login`.
      _Verified: no cookie → non-200 redirect to `/staff/login`, and no booking data in the response body._

- [ ] **Step 3:** Verify staff logout works (cookie cleared, redirect to login).
      _Cookie is cleared and the expiry header is correct, but logout is **client-side only** — see
      `docs/staff-security-notes.md`. The old cookie still authenticates until its 12h TTL runs out._

- [ ] **Step 4:** Verify responsive layout of staff dashboard on mobile.

- [x] **Step 5:** Check staff pages don't affect normal user navigation (navbar should be hidden on staff pages).
      _Verified: `verify-chrome-gate.cjs` — navbar/footer/floating-contact are absent from `/staff/login` HTML
      while the homepage still renders all three (negative control). Staff pages are also `noindex`._

- [ ] **Step 6:** Build and lint. _Lint passes; the final `next build` is blocked on this machine (see `docs/staff-security-notes.md`)._

---

## Phase 9: Button Hover Effects

### Task 16: Verify/fix booking button particle effects on homepage

**Files:**
- Verify: `app/page.tsx` (spawnButtonParticles and spawnParticles functions)

The particle system already exists with:
- `spawnButtonParticles()` — creates 7-8 emoji particles exploding from button edges
- `spawnParticles()` — creates 10-14 particles for vet cards
- Canvas-based rendering with DPI awareness
- Proper cleanup on mouseLeave and unmount

- [ ] **Step 1:** Verify the particle effect triggers on hover of the hero CTA button and CTA section button.
- [ ] **Step 2:** Verify particles don't overflow or cause layout issues.
- [ ] **Step 3:** Verify `canvas.isConnected` check prevents orphan animation loops.
- [ ] **Step 4:** On mobile, verify buttons work without hover (touch should not trigger particle canvas).
- [ ] **Step 5:** Build and lint.

---

## Phase 10: Responsive Verification

### Task 17: Full responsive audit

- [ ] **Step 1:** Test at 320px, 375px, 390px, 430px (mobile), 768px (tablet), 1024px (laptop), 1280px (desktop), 1440px (large desktop).

- [ ] **Step 2:** Check each page:
  - Homepage: navbar, hero video, services marquee, vet marquee, knowledge carousel, featured activities, CTA
  - Login/Register: form layout, terms modal, success modal
  - Staff login: PIN inputs, credential form
  - Services page: card grid
  - About page: glass cards
  - Knowledge page: article cards, modal
  - Booking forms: all 4 variants
  - Profile page: tabs, info cards

- [ ] **Step 3:** Fix any overflow, z-index, or spacing issues found.

- [ ] **Step 4:** Build and lint.

---

## Phase 11: Performance Optimization

### Task 18: Performance audit and fixes

- [ ] **Step 1:** Check for unnecessary re-renders (verify React.memo usage on pure components).
- [ ] **Step 2:** Verify video preloading is appropriate (intro: auto, hero: metadata for first, none for second).
- [ ] **Step 3:** Verify IntersectionObserver cleanup in all components (SiteNavbar, AnimationProvider, page.tsx hero video observer).
- [ ] **Step 4:** Verify GSAP context cleanup (`ctx.revert()`) in all useEffect returns.
- [ ] **Step 5:** Check for memory leaks from canvas animation loops (verify `canvas.isConnected` check).
- [ ] **Step 6:** Run `npm run build` and check for any warnings.

---

## Phase 12: Final Build & Verification

### Task 19: Production build and full verification

- [ ] **Step 1:** Run `npm run build` — ensure 0 errors.
- [ ] **Step 2:** Run `npm run lint` — ensure 0 warnings.
- [ ] **Step 3:** Verify all routes return 200 (not 404):
  - `/`, `/gioi-thieu`, `/dich-vu`, `/kien-thuc-thu-y`, `/tuyen-dung`
  - `/dang-nhap`, `/tao-tai-khoan` (redirects), `/cap-lai-mat-khau`
  - `/staff/login`, `/staff/dashboard`, `/staff/receipts`
  - `/booking/[service]`, `/booking/spa-grooming`, `/booking/khach-san`, `/booking/tiem-ngua`
  - `/trang-ca-nhan`, `/client-portal`, `/care-schedule`
- [ ] **Step 4:** Verify page transitions work (click nav → content transitions smoothly).
- [ ] **Step 5:** Verify no console errors in development mode.
- [ ] **Step 6:** Document all changes made.

---

## Summary of Expected Changes

### Files Modified:
1. `app/template.tsx` — Updated page transition wrapper
2. `app/page.tsx` — Hero video crossfade, knowledge carousel improvements, scroll effects
3. `app/globals.css` — Navbar scroll states, additional responsive styles
4. `app/dang-nhap/page.tsx` — Success modal, terms modal improvements, liquid design
5. `app/cap-lai-mat-khau/page.tsx` — Success modal, link fixes
6. `components/SiteNavbar.tsx` — Navigation consistency
7. `components/Footer.tsx` — Working navigation links
8. `components/IntroVideo.tsx` — Error handling improvements
9. `next.config.mjs` — Cache headers for belwee-super.mp4

### Files Created:
1. `components/AuthSuccessModal.tsx` — Login/register success modal
2. `components/skeletons/PageSkeleton.tsx` — Reusable page skeleton
3. `components/skeletons/HomeSkeleton.tsx` — Homepage skeleton
4. `components/skeletons/ServicesSkeleton.tsx` — Services page skeleton
5. `components/skeletons/ContentSkeleton.tsx` — Generic content skeleton

### Dependencies: None new (all using existing gsap, framer-motion, tailwind, lucide-react)
