import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

jest.mock('expo-router', () => ({
  // Home is focused for the whole test.
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(effect, []);
  },
}));

import { AiSphere } from '../AiSphere';

/** The bits of a rendered node these tests read. */
type SvgNode = { props: Record<string, unknown> };

function outline(tree: ReturnType<typeof render>): string {
  // The first <Path> is the shell; its `d` is the deformed outline.
  return tree.UNSAFE_root.findAll((n: SvgNode) => n.props?.d && n.props?.fill === 'url(#shell)')[0]
    .props.d;
}

describe('AiSphere', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws the shell, rim bloom, rim and two inner membranes', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const tree = render(<AiSphere size={150} />);
    const paths = tree.UNSAFE_root.findAll(
      (n: SvgNode) => typeof n.props?.d === 'string' && n.props.d.startsWith('M'),
    );
    // react-native-svg renders each Path through a couple of host layers;
    // count distinct outlines instead of nodes.
    expect(new Set(paths.map((p: SvgNode) => p.props.d)).size).toBe(3);
    expect(outline(tree)).toMatch(/Z$/);
  });

  it('keeps moving, so it reads as alive rather than a static badge', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const tree = render(<AiSphere size={150} />);
    const before = outline(tree);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(outline(tree)).not.toBe(before);
  });

  it('holds still when the OS asks to reduce motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const tree = render(<AiSphere size={150} />);
    await act(async () => {});
    const before = outline(tree);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(outline(tree)).toBe(before);
  });
});
