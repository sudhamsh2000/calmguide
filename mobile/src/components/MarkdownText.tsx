import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

interface MarkdownTextProps {
  children: string;
  baseSize?: number;
  baseColor?: string;
  lineHeight?: number;
}

// Render inline bold/italic within a string segment
function InlineContent({ text, color, fontSize, lineHeight }: {
  text: string;
  color: string;
  fontSize: number;
  lineHeight: number;
}) {
  // Split on **bold** and *italic* patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <Text style={{ color, fontSize, lineHeight }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={{ fontWeight: '700', color, fontSize }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <Text key={i} style={{ fontStyle: 'italic', color, fontSize }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function MarkdownTextComponent({
  children,
  baseSize = 15,
  baseColor,
  lineHeight = 23,
}: MarkdownTextProps) {
  const { colors } = useTheme();
  const textColor = baseColor ?? colors.foreground;

  // Re-parsing markdown on every render is wasteful — during streaming this
  // component re-renders on each flush (MOBPERF-13). Memoize the parsed blocks
  // keyed on the content + the style inputs that affect output.
  const rendered = useMemo<React.ReactNode[]>(() => {
    // Split into blocks by blank lines
    const blocks = children.split(/\n{2,}/);

    const out: React.ReactNode[] = [];

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi].trim();
      if (!block) continue;

      const lines = block.split('\n');

      // Ordered list block: lines starting with `1.` `2.` etc
      const isOrderedList = lines.every((l) => /^\d+\.\s/.test(l.trim()));
      // Unordered list block: lines starting with `-` or `*`
      const isUnorderedList = lines.every((l) => /^[-*]\s/.test(l.trim()));

      if (isOrderedList) {
        out.push(
        <View key={bi} style={{ gap: 6, marginBottom: bi < blocks.length - 1 ? 8 : 0 }}>
          {lines.map((line, li) => {
            const match = /^\d+\.\s(.+)$/.exec(line.trim());
            const content = match ? match[1] : line;
            const num = li + 1;
            return (
              <View key={li} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Text style={{ color: textColor, fontSize: baseSize, lineHeight, fontWeight: '700', minWidth: 20 }}>
                  {num}.
                </Text>
                <View style={{ flex: 1 }}>
                  <InlineContent text={content} color={textColor} fontSize={baseSize} lineHeight={lineHeight} />
                </View>
              </View>
            );
          })}
        </View>
      );
    } else if (isUnorderedList) {
      out.push(
        <View key={bi} style={{ gap: 6, marginBottom: bi < blocks.length - 1 ? 8 : 0 }}>
          {lines.map((line, li) => {
            const content = line.trim().replace(/^[-*]\s/, '');
            return (
              <View key={li} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Text style={{ color: textColor, fontSize: baseSize, lineHeight, marginTop: 1 }}>•</Text>
                <View style={{ flex: 1 }}>
                  <InlineContent text={content} color={textColor} fontSize={baseSize} lineHeight={lineHeight} />
                </View>
              </View>
            );
          })}
        </View>
      );
    } else {
      // Regular paragraph — join lines with a space
      const combined = lines.join(' ');
      out.push(
        <View key={bi} style={{ marginBottom: bi < blocks.length - 1 ? 6 : 0 }}>
          <InlineContent text={combined} color={textColor} fontSize={baseSize} lineHeight={lineHeight} />
        </View>
      );
      }
    }

    return out;
  }, [children, baseSize, textColor, lineHeight]);

  return <View style={{ gap: 0 }}>{rendered}</View>;
}

/**
 * Memoized so that parent re-renders (e.g. theme reads, streaming flushes on
 * sibling components) don't re-run the markdown parse when props are unchanged.
 */
export const MarkdownText = React.memo(MarkdownTextComponent);
