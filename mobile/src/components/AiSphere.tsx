import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * The Moment Coach orb — the mobile twin of the web frontend's
 * features/home/AiSphere.tsx, drawn with react-native-svg instead of a canvas.
 *
 * A soft-bodied membrane whose outline is a sum of slow sine harmonics, so the
 * silhouette is always rounded but never quite a circle and never repeats.
 * Hollow through the middle: a radial gradient that stays transparent to about
 * half the radius and only lights up toward the rim, with a bright stroke on
 * the outline and two fainter membranes inside for depth. The canvas version's
 * rim bloom (a shadow blur) becomes a wide, faint stroke under the rim.
 *
 * Motion is slow on purpose — this is on the screen a caregiver opens
 * mid-crisis, so it should look like it's listening, not working. It runs at
 * ~30 fps, pauses when Home isn't focused or the app is backgrounded, and
 * holds a single still frame when the OS "reduce motion" setting is on.
 */

const SEGMENTS = 96; // fewer than the web's 168 — plenty at this size, cheaper per frame
const BREATH_MS = 4200;
const FRAME_MS = 33;

/** [frequency, amplitude, angular speed, phase, amplitude-cycle] — same as web. */
const HARMONICS: [number, number, number, number, number][] = [
  [2, 0.072, 0.00165, 0.0, 5200],
  [3, 0.055, -0.00128, 1.7, 6900],
  [5, 0.032, 0.00101, 3.1, 4300],
  [7, 0.019, -0.00074, 5.2, 8100],
];
const LOBE_DRIFT = [0.00013, -0.00009, 0.00018, -0.00006];

function radiusAt(a: number, t: number, gain: number): number {
  let r = 1;
  for (let h = 0; h < HARMONICS.length; h++) {
    const [freq, amp, speed, phase, ampCycle] = HARMONICS[h];
    const swing = 0.675 + 0.325 * Math.sin((t / ampCycle) * Math.PI * 2 + phase);
    const drift = t * LOBE_DRIFT[h];
    r += Math.sin((a + drift) * freq + t * speed + phase) * amp * gain * swing;
  }
  return r;
}

function blobPath(c: number, radius: number, t: number, gain: number): string {
  let d = '';
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const r = radius * radiusAt(a, t, gain);
    const x = (c + Math.cos(a) * r).toFixed(2);
    const y = (c + Math.sin(a) * r).toFixed(2);
    d += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }
  return `${d}Z`;
}

/** 0.45..1.35 — three incommensurate periods, so busy and calm never repeat. */
function activityAt(t: number): number {
  return (
    0.9 +
    0.24 * Math.sin(t / 2600) +
    0.14 * Math.sin(t / 1700 + 2.1) +
    0.07 * Math.sin(t / 900 + 4.4)
  );
}

export interface AiSphereProps {
  size: number;
}

export function AiSphere({ size }: AiSphereProps) {
  const [t, setT] = useState(BREATH_MS / 4);
  const [focused, setFocused] = useState(true);
  // Pause only on an explicit background/inactive state; an unknown state at
  // launch (currentState can be null) should still animate.
  const [active, setActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [reduceMotion, setReduceMotion] = useState(false);
  const clock = useRef(BREATH_MS / 4);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) =>
      setActive(state !== 'background' && state !== 'inactive'),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !focused || !active) return;
    let raf = 0;
    let last = Date.now();
    let sinceDraw = 0;
    const frame = () => {
      const now = Date.now();
      const dt = Math.min(now - last, 64); // clamp so a stalled frame resumes smoothly
      last = now;
      clock.current += dt;
      sinceDraw += dt;
      if (sinceDraw >= FRAME_MS) {
        sinceDraw = 0;
        setT(clock.current);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion, focused, active]);

  const c = size / 2;
  const activity = activityAt(t);
  const mt = t * (0.55 + activity * 0.85);
  const breath = Math.sin((t / BREATH_MS) * Math.PI * 2);
  const base = size * 0.315 * (1 + breath * 0.045);
  const outline = blobPath(c, base, mt, activity);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient
            id="shell"
            cx={c}
            cy={c}
            r={base * 1.02}
            fx={c}
            fy={c}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="rgb(10,20,34)" stopOpacity={0} />
            <Stop offset="0.46" stopColor="rgb(32,104,170)" stopOpacity={0.07} />
            <Stop offset="0.7" stopColor="rgb(45,146,220)" stopOpacity={0.42} />
            <Stop offset="0.88" stopColor="rgb(86,186,245)" stopOpacity={0.92} />
            <Stop offset="0.97" stopColor="rgb(168,222,255)" stopOpacity={0.98} />
            <Stop offset="1" stopColor="rgb(206,238,255)" stopOpacity={0.7} />
          </RadialGradient>
        </Defs>
        {/* The hollow shell. */}
        <Path d={outline} fill="url(#shell)" />
        {/* Rim bloom, standing in for the canvas shadow blur. */}
        <Path
          d={outline}
          fill="none"
          stroke="rgb(150,210,252)"
          strokeOpacity={0.22}
          strokeWidth={base * 0.09}
        />
        {/* Bright edge. */}
        <Path
          d={outline}
          fill="none"
          stroke="rgb(198,232,255)"
          strokeOpacity={0.75 + breath * 0.12}
          strokeWidth={1.6}
        />
        {/* A second membrane just inside, on its own phase — depth. */}
        <Path
          d={blobPath(c, base * 0.84, mt * 1.3 + 2100, activity * 1.15)}
          fill="none"
          stroke="rgb(122,190,240)"
          strokeOpacity={0.3 + breath * 0.08}
          strokeWidth={1}
        />
        {/* Innermost trace, fainter still. */}
        <Path
          d={blobPath(c, base * 0.64, -mt * 0.95 + 800, activity * 1.25)}
          fill="none"
          stroke="rgb(96,166,220)"
          strokeOpacity={0.18}
          strokeWidth={0.9}
        />
      </Svg>
    </View>
  );
}
