'use client';

import { useEffect, useRef } from 'react';

/**
 * The Moment Coach orb.
 *
 * Not a particle globe — a soft-bodied membrane whose outline is a sum of
 * slow sine harmonics, so the silhouette is always rounded but never quite
 * a circle and never repeats. Hollow through the middle: the fill is a
 * radial gradient that stays transparent to ~55% of the radius and only
 * lights up toward the edge, with a bright stroke on the outline. What you
 * see is a lit shell with darkness inside it.
 *
 * That shape carries the "agentic" read better than dots on a sphere: a
 * rotating lattice looks like data being displayed, a body that deforms
 * looks like something alive and attending. Motion is slow and fluid on
 * purpose — this sits on the screen a caregiver opens mid-crisis, so it
 * should look like it is listening, not working.
 *
 * Canvas 2D, no dependency, three filled paths per frame.
 */

const SEGMENTS = 168; // points around the outline; enough that it reads smooth
const BREATH_MS = 4200;

/** Harmonics: [frequency, amplitude, angular speed, phase, amplitude-cycle].
 *  Frequencies are deliberately non-integer multiples of each other so the
 *  silhouette never settles into a repeating pattern, and each amplitude
 *  swings on its own period — so sometimes the 2-lobe dominates and it goes
 *  oval, sometimes the 5 does and it goes softly faceted. That variety is
 *  what stops it reading as one looping wobble. */
const HARMONICS: Array<[number, number, number, number, number]> = [
  [2, 0.072, 0.00165, 0.0, 5200],
  [3, 0.055, -0.00128, 1.7, 6900],
  [5, 0.032, 0.00101, 3.1, 4300],
  [7, 0.019, -0.00074, 5.2, 8100],
];

/** Each harmonic's lobes also rotate round the blob at their own rate, so
 *  the bulges arrive from different directions instead of always swelling
 *  in the same places. Slow, and counter-running, so it never looks like
 *  the whole thing is simply spinning. */
const LOBE_DRIFT = [0.00013, -0.00009, 0.00018, -0.00006];

export interface AiSphereProps {
  className?: string;
}

export function AiSphere({ className = '' }: AiSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    /** Radius at angle `a`, deformed by the harmonics at time `t`. */
    const radiusAt = (a: number, t: number, gain: number) => {
      let r = 1;
      for (let h = 0; h < HARMONICS.length; h++) {
        const [freq, amp, speed, phase, ampCycle] = HARMONICS[h];
        // 0.35..1 — never fully mutes a harmonic, so the shape stays
        // organic rather than snapping between two distinct silhouettes.
        const swing = 0.675 + 0.325 * Math.sin((t / ampCycle) * Math.PI * 2 + phase);
        const drift = t * LOBE_DRIFT[h];
        r += Math.sin((a + drift) * freq + t * speed + phase) * amp * gain * swing;
      }
      return r;
    };

    /** Trace the deformed outline as a closed path. */
    const traceBlob = (cx: number, cy: number, radius: number, t: number, gain: number) => {
      ctx.beginPath();
      for (let i = 0; i <= SEGMENTS; i++) {
        const a = (i / SEGMENTS) * Math.PI * 2;
        const r = radius * radiusAt(a, t, gain);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    /** 0.45..1.35. Three incommensurate periods, so the pattern of busy and
     *  calm never repeats — the thing that makes it read as considering
     *  something rather than idling on a loop. */
    const activityAt = (t: number) =>
      0.9 +
      0.24 * Math.sin(t / 2600) +
      0.14 * Math.sin(t / 1700 + 2.1) +
      0.07 * Math.sin(t / 900 + 4.4);

    const draw = (t: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const activity = activityAt(t);
      // Morph time runs on the envelope, so busier spells genuinely change
      // shape faster rather than just deforming further.
      const mt = t * (0.55 + activity * 0.85);
      const breath = Math.sin((t / BREATH_MS) * Math.PI * 2);
      const base = Math.min(width, height) * 0.315 * (1 + breath * 0.045);

      ctx.clearRect(0, 0, width, height);

      // No outer halo: it read as a blue cast sitting behind the form
      // rather than light coming off it. The rim carries the luminosity now.

      // The shell. Transparent through the middle, brightening only near
      // the rim — this is what makes it hollow rather than a solid disc.
      traceBlob(cx, cy, base, mt, activity);
      const shell = ctx.createRadialGradient(cx, cy, base * 0.2, cx, cy, base * 1.02);
      shell.addColorStop(0, 'rgba(10, 20, 34, 0)');
      shell.addColorStop(0.46, 'rgba(32, 104, 170, 0.07)');
      shell.addColorStop(0.7, 'rgba(45, 146, 220, 0.42)');
      shell.addColorStop(0.88, 'rgba(86, 186, 245, 0.92)');
      shell.addColorStop(0.97, 'rgba(168, 222, 255, 0.98)');
      shell.addColorStop(1, 'rgba(206, 238, 255, 0.7)');
      ctx.fillStyle = shell;
      ctx.fill();

      // Bright edge, with bloom.
      ctx.save();
      // A tight bloom on the edge only — this is light coming off the rim,
      // not a glow parked behind the shape.
      ctx.shadowColor = 'rgba(150, 210, 252, 0.7)';
      ctx.shadowBlur = base * 0.1;
      traceBlob(cx, cy, base, mt, activity);
      ctx.strokeStyle = `rgba(198, 232, 255, ${(0.75 + breath * 0.12).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();

      // A second membrane just inside, drifting on its own phase. Two
      // offset edges read as depth — a body with an inside — where one
      // outline alone reads as a sticker.
      traceBlob(cx, cy, base * 0.84, mt * 1.3 + 2100, activity * 1.15);
      ctx.strokeStyle = `rgba(122, 190, 240, ${(0.3 + breath * 0.08).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Innermost trace, fainter still, so the hollow has some structure to
      // it instead of being an empty hole.
      traceBlob(cx, cy, base * 0.64, -mt * 0.95 + 800, activity * 1.25);
      ctx.strokeStyle = 'rgba(96, 166, 220, 0.18)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    };

    if (reduceMotion) {
      draw(BREATH_MS / 4);
      const onResizeStatic = () => {
        resize();
        draw(BREATH_MS / 4);
      };
      window.addEventListener('resize', onResizeStatic);
      return () => window.removeEventListener('resize', onResizeStatic);
    }

    let raf = 0;
    let running = false;
    let t = 0;
    let last = performance.now();

    // Paint immediately, so the canvas is never an empty hole before the
    // observer below opens the gate (e.g. loaded in a background tab).
    draw(t);

    const frame = (now: number) => {
      const dt = Math.min(now - last, 64); // clamp so a stalled tab resumes smoothly
      last = now;
      t += dt;
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    // Viewport visibility only. Deliberately NOT `document.hidden` as well:
    // browsers already withhold rAF from background tabs, and embedded
    // contexts (preview panes, webviews) report `hidden` while the user is
    // watching — which froze the previous version on a single frame.
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.01 },
    );
    observer.observe(canvas);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
