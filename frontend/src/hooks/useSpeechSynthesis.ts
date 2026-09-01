"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseSpeechSynthesisOptions {
  locale?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
}

/**
 * Warmer, calmer delivery than the browser's raw defaults (rate 1 / pitch 1
 * reads flat and clinical — exactly the "system voiceover" feel we don't
 * want for a caregiver at 3am). Subtle on purpose: slowed down slightly for
 * a calm pace, pitch nudged up just enough to sound friendly rather than
 * flat, without tipping into cartoonish.
 */
const SPEECH_RATE = 0.95;
const SPEECH_PITCH = 1.05;

/**
 * Name fragments (case-insensitive) of voices that are known to sound
 * natural rather than robotic, roughly in preference order, across the
 * platforms CalmGuide actually ships on (macOS/iOS Safari, Chrome/Edge on
 * Windows and Android). The Web Speech API gives no reliable quality
 * signal — `localService` doesn't correlate with quality consistently
 * across platforms — so this is a maintained allowlist rather than a
 * heuristic. Falls back to the platform default for the locale if none of
 * these are installed.
 *
 * "Samantha" for English is confirmed good (tested, not flagged) and stays
 * top priority so this change doesn't touch a voice nobody complained
 * about. "Mónica" for Spanish was tested and reported as not friendly
 * enough, so for es specifically, Apple's newer cross-language voice set
 * (macOS Ventura+ / iOS 16+, shipped under the same names in every
 * language — a generation newer and generally warmer than the classic
 * single-name voices) gets a chance to win instead, ahead of Mónica as a
 * fallback. Skipped "Grandma"/"Grandpa" from that same newer set on
 * purpose — warm, but age-codes the voice in a way that doesn't fit every
 * response.
 */
const PREFERRED_VOICE_NAMES = [
  // macOS / iOS Safari classic high-quality voices, per language
  "Ava", "Samantha", "Allison", "Susan", "Zoe", "Nicky", // en
  // Newer cross-language voice set — currently only tried for es (Mónica
  // wasn't warm enough); see note above before widening this to other
  // locales without it being requested.
  "Reed", "Shelley", "Flo",
  "Mónica", "Paulina", // es fallback
  // Chrome/Edge network-backed voices, notably better than local ones
  "Google US English", "Google UK English Female", "Google español",
  "Microsoft Aria", "Microsoft Jenny", "Microsoft Sonia",
];

function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | undefined {
  const localeMatches = voices.filter((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase()));
  if (localeMatches.length === 0) return undefined;

  for (const preferred of PREFERRED_VOICE_NAMES) {
    const match = localeMatches.find((v) => v.name.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }

  // No known-good voice installed — prefer a network-backed voice over a
  // compact on-device one where the platform actually tells us which is
  // which (Chrome does; Safari reports everything as local).
  return localeMatches.find((v) => !v.localService) ?? localeMatches[0];
}

export function useSpeechSynthesis(
  options: UseSpeechSynthesisOptions = {},
): UseSpeechSynthesisReturn {
  const { locale } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const supported = typeof window !== "undefined" && !!window.speechSynthesis;
    setIsSupported(supported);
    if (!supported) return;

    // Chrome (and some other browsers) return an empty voice list until
    // they've asynchronously loaded the platform's voices and fired
    // `voiceschanged` — calling getVoices() once here warms that cache so
    // the first real speak() call already has the full list to choose
    // from, instead of silently falling back to whatever default voice
    // happens to be active before loading finishes.
    window.speechSynthesis.getVoices();
  }, []);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.rate = SPEECH_RATE;
      utterance.pitch = SPEECH_PITCH;

      if (locale) {
        const voices = window.speechSynthesis.getVoices();
        const match = pickVoice(voices, locale);
        if (match) utterance.voice = match;
        utterance.lang = locale;
      }

      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onpause = () => setIsPaused(true);
      utterance.onresume = () => setIsPaused(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, locale],
  );

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis?.cancel();
    };
  }, [isSupported]);

  return { speak, stop, pause, resume, isSpeaking, isPaused, isSupported };
}
