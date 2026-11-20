/**
 * Performance measurement harness (production build only).
 *
 * Usage:
 *   node scripts/perf/measure.mjs before
 *   node scripts/perf/measure.mjs after
 *
 * Requires `npm run build && npm start -- -p 3001` first.
 *
 * What it records per scenario:
 *  - rAF frame intervals -> avg FPS, p95 frame time, dropped frames, stalls >50ms
 *  - PerformanceObserver longtask entries
 *  - CDP Performance counters (layout, recalc style, script, task)
 *  - Chrome trace aggregation: RecalculateStyle/Layout/Paint/CompositeLayers/...
 *  - static "cost inventory": every backdrop-filter / filter / infinite animation,
 *    sorted by painted area, plus every <video> element.
 *
 * Scenarios are run twice: once without tracing for honest FPS, once with tracing
 * for the event breakdown. Both passes replay the same interaction.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BASE = process.env.PERF_BASE || "http://localhost:3001";
const LABEL = process.argv[2] || "run";
const ONLY = process.argv.slice(3);
const OUT_DIR = path.resolve("docs", "perf");
const VIEWPORT = { width: 1440, height: 900 };

const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "cc",
  "gpu",
  "viz",
].join(",");

const INIT_SCRIPT = () => {
  // `start` at t=0 survives until reset(); it lets the cold-load scenario time
  // the whole document instead of trying to reset() on about:blank (where this
  // script has not run yet).
  window.__perf = {
    frames: [],
    longtasks: [],
    loaf: [],
    marks: [{ name: "start", t: 0 }],
  };
  let last = null;
  const tick = (t) => {
    if (last !== null) window.__perf.frames.push([t, t - last]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.longtasks.push({
          start: e.startTime,
          dur: e.duration,
          name: e.name,
          attribution: (e.attribution || []).map((a) => ({
            name: a.name,
            type: a.containerType,
            src: a.containerSrc,
          })),
        });
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* longtask unsupported */
  }
  // Long Animation Frames (>50ms) include style/layout time and attribute the
  // slow script — much closer to what a user perceives as a stutter than
  // longtask, which only sees JS.
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.loaf.push({
          start: e.startTime,
          dur: e.duration,
          blocking: e.blockingDuration,
          renderStart: e.renderStart,
          styleLayoutStart: e.styleAndLayoutStart,
          scripts: (e.scripts || []).slice(0, 4).map((s) => ({
            invoker: s.invoker,
            src: s.sourceURL,
            fn: s.sourceFunctionName,
            dur: s.duration,
            forced: s.forcedStyleAndLayoutDuration,
          })),
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    /* long-animation-frame unsupported */
  }
  window.__perf.mark = (name) => {
    window.__perf.marks.push({ name, t: performance.now() });
  };
  window.__perf.reset = () => {
    window.__perf.frames = [];
    window.__perf.longtasks = [];
    window.__perf.loaf = [];
    window.__perf.marks = [];
  };
};

async function launch() {
  return chromium.launch({
    headless: true,
    channel: "chromium", // full Chromium "new headless": real GPU (not SwiftShader)
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
      "--force-color-profile=srgb",
    ],
  });
}

async function openPage(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.addInitScript(INIT_SCRIPT);
  return { context, page };
}

async function waitIntroDone(page) {
  await page
    .waitForFunction(
      () => !document.querySelector(".intro-video-screen, .intro-overlay"),
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

async function gotoHome(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitIntroDone(page);
}

function marksToWindow(perf) {
  const get = (n) => perf.marks.find((m) => m.name === n)?.t;
  return { t0: get("start") ?? 0, t1: get("end") ?? Infinity };
}

function summarizePerf(perf) {
  const get = (n) => perf.marks.find((m) => m.name === n)?.t;
  if (get("end") == null) {
    return {
      error: `missing end mark (frames seen: ${perf.frames?.length ?? 0})`,
      frames: 0,
      avgFps: 0,
    };
  }
  const { t0, t1 } = marksToWindow(perf);
  const dts = perf.frames
    .filter(([t]) => t >= t0 && t <= t1)
    .map(([, dt]) => dt)
    .filter((dt) => dt > 0 && dt < 2000);
  const duration = Math.max(1, t1 - t0);
  const sorted = [...dts].sort((a, b) => a - b);
  const q = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
  const longtasks = perf.longtasks.filter((e) => e.start >= t0 && e.start <= t1);
  const loaf = (perf.loaf || []).filter((e) => e.start >= t0 && e.start <= t1);
  return {
    durationMs: Math.round(duration),
    frames: sorted.length,
    avgFps: +((sorted.length / duration) * 1000).toFixed(1),
    medianFrameMs: +q(0.5).toFixed(2),
    p95FrameMs: +q(0.95).toFixed(2),
    worstFrameMs: +(sorted[sorted.length - 1] || 0).toFixed(2),
    droppedFrames: sorted.reduce((n, dt) => n + Math.max(0, Math.round(dt / 16.667) - 1), 0),
    framesOver33ms: sorted.filter((dt) => dt > 33).length,
    framesOver50ms: sorted.filter((dt) => dt > 50).length,
    longtaskCount: longtasks.length,
    longtaskTotalMs: +longtasks.reduce((n, e) => n + e.dur, 0).toFixed(1),
    longestTaskMs: +Math.max(0, ...longtasks.map((e) => e.dur)).toFixed(1),
    topLongTasks: longtasks
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 5)
      .map((e) => ({
        startMs: +e.start.toFixed(0),
        durMs: +e.dur.toFixed(1),
        attribution: e.attribution?.[0]?.src || e.attribution?.[0]?.name || "",
      })),
    loafCount: loaf.length,
    loafTotalMs: +loaf.reduce((n, e) => n + e.dur, 0).toFixed(1),
    loafMaxMs: +Math.max(0, ...loaf.map((e) => e.dur)).toFixed(1),
    topLoaf: loaf
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 5)
      .map((e) => ({
        startMs: +e.start.toFixed(0),
        durMs: +e.dur.toFixed(1),
        blockingMs: +(e.blocking ?? 0).toFixed(1),
        styleLayoutMs:
          e.styleLayoutStart > 0 ? +(e.styleLayoutStart - e.renderStart).toFixed(1) : null,
        invoker: e.scripts?.[0]?.invoker || "",
        src: e.scripts?.[0]?.src || "",
      })),
  };
}

async function perfCounters(client) {
  const { metrics } = await client.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return {
    TaskDuration: m.TaskDuration,
    ScriptDuration: m.ScriptDuration,
    LayoutDuration: m.LayoutDuration,
    RecalcStyleDuration: m.RecalcStyleDuration,
    LayoutCount: m.LayoutCount,
    RecalcStyleCount: m.RecalcStyleCount,
    JSHeapUsedSize: m.JSHeapUsedSize,
  };
}

function deltaCounters(before, after) {
  const out = {};
  for (const k of Object.keys(after)) {
    out[k] = +(after[k] - (before[k] || 0)).toFixed(4);
  }
  out.LayoutCount = Math.round(out.LayoutCount);
  out.RecalcStyleCount = Math.round(out.RecalcStyleCount);
  out.JSHeapMB = +(out.JSHeapUsedSize / 1024 / 1024).toFixed(1);
  delete out.JSHeapUsedSize;
  for (const k of ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"]) {
    out[`${k}Ms`] = +(out[k] * 1000).toFixed(1);
    delete out[k];
  }
  return out;
}

function parseTrace(events) {
  const agg = new Map();
  for (const e of events) {
    if (e.ph !== "X" || typeof e.dur !== "number") continue;
    const cur = agg.get(e.name) || { name: e.name, dur: 0, count: 0, max: 0 };
    cur.dur += e.dur;
    cur.count += 1;
    if (e.dur > cur.max) cur.max = e.dur;
    agg.set(e.name, cur);
  }
  const rows = [...agg.values()]
    .map((r) => ({
      name: r.name,
      totalMs: +(r.dur / 1000).toFixed(1),
      count: r.count,
      maxMs: +(r.max / 1000).toFixed(1),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);
  return {
    topByTotalMs: rows.slice(0, 25),
    keyEvents: Object.fromEntries(
      rows
        .filter((r) =>
          /RecalculateStyle|UpdateLayoutTree|Layout|Paint|PrePaint|Layerize|CompositeLayers|Commit|UpdateLayerTree|RasterTask|DrawFrame|VideoFrame|GPUTask|Graphics\.Pipeline|HitTest|IntersectionObserver|FunctionCall|TimerFire|EventDispatch/i.test(
            r.name
          )
        )
        .map((r) => [r.name, { totalMs: r.totalMs, count: r.count, maxMs: r.maxMs }])
    ),
  };
}

async function withTrace(client, fn) {
  const events = [];
  client.on("Tracing.dataCollected", ({ value }) => {
    if (Array.isArray(value)) events.push(...value);
  });
  const complete = new Promise((resolve) => client.once("Tracing.tracingComplete", resolve));
  await client.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    transferMode: "ReportEvents",
  });
  await fn();
  await client.send("Tracing.end");
  await complete;
  return parseTrace(events);
}

/**
 * Run the interaction for real in both passes. Pass 1 (no tracing) is the one
 * whose frame timings count; pass 2 wraps the *same* interaction in a trace.
 * The earlier version only called `run()` when `trace` was true, so pass 1
 * measured an empty window and reported 0 FPS.
 */
async function runScenario(client, run, trace) {
  if (!trace) {
    await run();
    return null;
  }
  return withTrace(client, run);
}

const SCENARIOS = {
  // 1. Cold load of the home page, including the intro video, then 2s idle.
  async load(page, trace) {
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    // No reset() here: the page is still about:blank, where addInitScript has
    // not run. The new document starts with marks [{start,0}] from INIT_SCRIPT.
    const counters0 = await perfCounters(client);
    const run = async () => {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitIntroDone(page);
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.__perf.mark("end"));
    };
    const traceOut = await runScenario(client, run, trace);
    const counters1 = await perfCounters(client);
    const perf = await page.evaluate(() => window.__perf);
    return {
      ...summarizePerf(perf),
      counters: deltaCounters(counters0, counters1),
      trace: traceOut,
      introMs: perf.marks.find((m) => m.name === "end")?.t ?? null,
    };
  },

  // 2. Wheel-scroll from top to bottom in ~10s.
  async scroll(page, trace) {
    await gotoHome(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    const total = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    const steps = 120;
    const stepPx = Math.max(1, total / steps);
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.evaluate(() => window.__perf.reset());
    await page.evaluate(() => window.__perf.mark("start"));
    const counters0 = await perfCounters(client);
    const run = async () => {
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, stepPx);
        await page.waitForTimeout(83);
      }
      await page.waitForTimeout(300);
      await page.evaluate(() => window.__perf.mark("end"));
    };
    const traceOut = await runScenario(client, run, trace);
    const counters1 = await perfCounters(client);
    const perf = await page.evaluate(() => window.__perf);
    return {
      scrollHeight: Math.round(total),
      ...summarizePerf(perf),
      counters: deltaCounters(counters0, counters1),
      trace: traceOut,
    };
  },

  // 3. Hover every navbar link/action several times, at top of page.
  async "hover-navbar"(page, trace) {
    await gotoHome(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    const targets = page.locator(
      ".site-global-nav .site-global-link, .site-global-nav .site-global-logo, .site-global-nav .site-global-actions > *"
    );
    const count = await targets.count();
    const boxes = [];
    for (let i = 0; i < count; i++) {
      const b = await targets.nth(i).boundingBox();
      if (b) boxes.push(b);
    }
    await page.evaluate(() => window.__perf.reset());
    await page.evaluate(() => window.__perf.mark("start"));
    const counters0 = await perfCounters(client);
    const run = async () => {
      for (let round = 0; round < 3; round++) {
        for (const b of boxes) {
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
          await page.waitForTimeout(170);
        }
      }
      await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height - 100, { steps: 10 });
      await page.waitForTimeout(250);
      await page.evaluate(() => window.__perf.mark("end"));
    };
    const traceOut = await runScenario(client, run, trace);
    const counters1 = await perfCounters(client);
    const perf = await page.evaluate(() => window.__perf);
    return {
      targets: boxes.length,
      ...summarizePerf(perf),
      counters: deltaCounters(counters0, counters1),
      trace: traceOut,
    };
  },

  // 4. Open/close floating contact overlay, then open/close hamburger.
  async overlays(page, trace) {
    await gotoHome(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");
    await page.evaluate(() => window.__perf.reset());
    await page.evaluate(() => window.__perf.mark("start"));
    const counters0 = await perfCounters(client);
    const run = async () => {
      // Floating contact: open, hold, close.
      await page.locator(".floating-contact-main").click();
      await page.waitForTimeout(2600);
      await page.locator(".floating-contact-backdrop").click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(700);
      // Hamburger: open, hold, close.
      const burger = page.locator(".site-global-hamburger").first();
      await burger.click();
      await page.waitForTimeout(2600);
      await burger.click();
      await page.waitForTimeout(700);
      await page.evaluate(() => window.__perf.mark("end"));
    };
    const traceOut = await runScenario(client, run, trace);
    const counters1 = await perfCounters(client);
    const perf = await page.evaluate(() => window.__perf);
    return {
      ...summarizePerf(perf),
      counters: deltaCounters(counters0, counters1),
      trace: traceOut,
    };
  },
};

function selectorOf(el) {
  const bits = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = [...el.classList].slice(0, 3).map((c) => `.${c}`).join("");
  return `${bits}${id}${cls}`;
}

async function inventory(page) {
  await gotoHome(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const out = {
      backdrops: [],
      filters: [],
      animations: [],
      videos: [],
      fixedLayers: [],
    };
    const all = [...document.querySelectorAll("*")];
    const n = all.length;
    for (const el of all) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const area = Math.round(r.width * r.height);
      const base = {
        sel: (() => {
          const bits = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls = [...el.classList].slice(0, 3).map((c) => `.${c}`).join("");
          return `${bits}${id}${cls}`;
        })(),
        area,
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
      };
      if (cs.backdropFilter && cs.backdropFilter !== "none") {
        out.backdrops.push({ ...base, value: cs.backdropFilter });
      }
      if (cs.filter && cs.filter !== "none") {
        out.filters.push({ ...base, value: cs.filter });
      }
      if (cs.animationName && cs.animationName !== "none") {
        out.animations.push({
          ...base,
          value: `${cs.animationName} ${cs.animationDuration} ${cs.animationIterationCount}`,
        });
      }
      if ((cs.position === "fixed" || cs.position === "sticky") && area > 20000) {
        out.fixedLayers.push({ ...base, position: cs.position, z: cs.zIndex });
      }
      if (el.tagName === "VIDEO") {
        const v = el;
        out.videos.push({
          ...base,
          src: v.currentSrc || v.getAttribute("src"),
          w: v.videoWidth,
          h: v.videoHeight,
          paused: v.paused,
          readyState: v.readyState,
          playing: !v.paused && !v.ended,
        });
      }
    }
    for (const key of Object.keys(out)) {
      if (key === "videos") continue;
      out[key].sort((a, b) => b.area - a.area);
      out[key] = out[key].slice(0, 12);
    }
    return { elementCount: n, ...out };
  });
}

function relLum(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

async function navbarContrast(page) {
  const results = {};
  const parseColor = (s) => {
    const m = s.match(/[\d.]+/g);
    if (!m || m.length < 3) return [255, 255, 255];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const ratio = (a, b) => {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };

  await page.evaluate(() => {
    // scrollTo(0, 900) animates when scroll-behavior: smooth; force instant.
    document.documentElement.style.scrollBehavior = "auto";
    // Freeze the hero video so three samples measure one stable frame.
    document.querySelectorAll("video").forEach((v) => v.pause());
  });

  async function measure(state, scrollY, hoverLabel) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), scrollY);
    // Clear any hover left over from the previous measurement BEFORE the state
    // settles; otherwise the scrolled "normal" pass still reads the hover color
    // and the fading hover pill from the previous hover pass.
    await page.mouse.move(10, 500);
    await page.waitForTimeout(900);
    if (hoverLabel) {
      const hovered = page.locator(".site-global-nav .site-global-link", {
        hasText: hoverLabel,
      }).first();
      const hb = await hovered.boundingBox();
      if (!hb) return;
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      // 360ms pill transition + settle.
      await page.waitForTimeout(520);
    }

    const nav = page.locator(".site-global-nav");
    const navBox = await nav.boundingBox();
    if (!navBox) return;

    // Read the ACTUAL computed text color in this state — top is white, scrolled
    // is dark. Do it while the hover is active so :hover colors are included.
    const nodes = await page.evaluate((nb) => {
      return [...document.querySelectorAll(".site-global-nav .site-global-link")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            label: el.textContent.trim().slice(0, 24) || el.getAttribute("aria-label") || "?",
            current: el.classList.contains("is-current"),
            color: getComputedStyle(el).color,
            x: Math.round(r.left - nb.x),
            y: Math.round(r.top - nb.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter((b) => b.w > 8 && b.h > 8 && b.y >= 0 && b.y + b.h <= nb.height + 1);
    }, navBox);
    if (!nodes.length) return;

    // Make glyphs transparent but keep every background: the current link's pill
    // and the hover pill are exactly what sits behind the text. Hiding the whole
    // links group (old method) deleted those pills and measured a backdrop the
    // user never sees.
    await page.evaluate(() => {
      const s = document.createElement("style");
      s.id = "perf-nav-text-transparent";
      s.textContent =
        ".site-global-nav .site-global-link, .site-global-nav .site-global-link * { color: transparent !important; text-shadow: none !important; }";
      document.head.appendChild(s);
    });
    const shots = [];
    for (let i = 0; i < 3; i++) {
      shots.push(await page.screenshot({ clip: navBox }));
      await page.waitForTimeout(180);
    }
    await page.evaluate(() => {
      document.getElementById("perf-nav-text-transparent")?.remove();
    });

    const decoded = await Promise.all(
      shots.map(async (buf) => {
        const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
        return { data, info };
      })
    );

    const perLabel = [];
    for (const b of nodes) {
      const [tr, tg, tb] = parseColor(b.color);
      const textLum = relLum(tr, tg, tb);
      const samples = [];
      for (const { data, info } of decoded) {
        const ch = info.channels;
        for (let y = Math.max(0, b.y + 2); y < Math.min(info.height, b.y + b.h - 2); y += 2) {
          for (let x = Math.max(0, b.x + 2); x < Math.min(info.width, b.x + b.w - 2); x += 2) {
            const i = (y * info.width + x) * ch;
            samples.push(relLum(data[i], data[i + 1], data[i + 2]));
          }
        }
      }
      if (!samples.length) continue;
      samples.sort((a, b2) => a - b2);
      const p5 = samples[Math.floor(samples.length * 0.05)];
      const p95 = samples[Math.floor(samples.length * 0.95)];
      const mean = samples.reduce((n, v) => n + v, 0) / samples.length;
      // Light text fails on the LIGHTEST backdrop; dark text fails on the
      // DARKEST. Pick the percentile that produces the lower contrast.
      const worstBg = textLum > 0.5 ? p95 : p5;
      const worst = ratio(textLum, worstBg);
      perLabel.push({
        label: b.label,
        role:
          hoverLabel && b.label === hoverLabel
            ? "hover"
            : b.current
              ? "current"
              : "link",
        color: b.color,
        textLum: +textLum.toFixed(4),
        bgLum: { mean: +mean.toFixed(4), p5: +p5.toFixed(4), p95: +p95.toFixed(4) },
        contrastMean: ratio(textLum, mean),
        contrastWorst: worst,
        passesAA: worst >= 4.5,
      });
    }
    results[state] = {
      navTint: await page.evaluate(() => {
        const el = document.querySelector(".site-global-nav");
        const cs = getComputedStyle(el);
        return {
          className: el.className,
          backgroundImage: cs.backgroundImage.slice(0, 160),
          backdropFilter: cs.backdropFilter,
        };
      }),
      perLabel,
    };
  }

  await measure("top", 0, null);

  // Pick a visible non-current link for the hover-pill measurement.
  let hoverLabel = null;
  const links = page.locator(".site-global-nav .site-global-link");
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const el = links.nth(i);
    const box = await el.boundingBox();
    const cls = (await el.getAttribute("class")) || "";
    if (box && box.width > 8 && !cls.includes("is-current")) {
      hoverLabel = (await el.textContent())?.trim().slice(0, 24) || null;
      break;
    }
  }
  if (hoverLabel) await measure("top-hover", 0, hoverLabel);
  await measure("scrolled", 900, null);
  if (hoverLabel) await measure("scrolled-hover", 900, hoverLabel);
  return results;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await launch();
  const bcdp = await browser.newBrowserCDPSession();
  const sys = await bcdp.send("SystemInfo.getInfo");
  const gpu = {
    devices: (sys.gpu?.devices || []).map((d) => `${d.vendorString} / ${d.deviceString}`),
    glRenderer: sys.gpu?.auxAttributes?.glRenderer,
    compositing: sys.gpu?.featureStatus?.gpu_compositing,
    videoDecode: sys.gpu?.featureStatus?.video_decode,
  };

  const names = Object.keys(SCENARIOS).filter((n) => !ONLY.length || ONLY.includes(n));
  const out = {
    label: LABEL,
    ts: new Date().toISOString(),
    base: BASE,
    viewport: VIEWPORT,
    gpu,
    scenarios: {},
  };

  for (const name of names) {
    // Pass 1: honest frame timing, no tracing.
    let { context, page } = await openPage(browser);
    let fps;
    try {
      fps = await SCENARIOS[name](page, false);
    } catch (e) {
      fps = { error: String(e).slice(0, 500) };
    }
    await context.close();

    // Pass 2: trace breakdown (same interaction, tracing overhead accepted).
    ({ context, page } = await openPage(browser));
    let traced;
    try {
      traced = await SCENARIOS[name](page, true);
    } catch (e) {
      traced = { error: String(e).slice(0, 500) };
    }
    await context.close();

    out.scenarios[name] = { ...fps, trace: traced.trace || traced.error || null };
    console.log(
      `${name}: avgFps=${fps.avgFps} p95=${fps.p95FrameMs}ms longtasks=${fps.longtaskCount}/${fps.longtaskTotalMs}ms`
    );
  }

  if (!ONLY.length || ONLY.includes("inventory")) {
    const { context, page } = await openPage(browser);
    await gotoHome(page);
    out.inventory = await inventory(page);
    out.contrast = await navbarContrast(page);
    await context.close();
  }

  await browser.close();
  const file = path.join(OUT_DIR, `${LABEL}.json`);
  await fs.writeFile(file, JSON.stringify(out, null, 2), "utf8");
  console.log(`\nWrote ${file}`);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
