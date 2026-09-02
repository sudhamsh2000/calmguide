import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from './ThemeContext';

interface Props {
  children: string;
  fontSize?: number;
  lineHeight?: number;
}

interface Token {
  type: 'paragraph' | 'bullet' | 'ordered';
  content: string;
  index?: number;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const lines = text.split('\n');
  let i = 0;
  let orderedIndex = 1;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines between blocks
    if (line === '') {
      i++;
      continue;
    }

    // Unordered list item
    if (/^[-*•]\s+/.test(line)) {
      tokens.push({ type: 'bullet', content: line.replace(/^[-*•]\s+/, '') });
      i++;
      continue;
    }

    // Ordered list item
    const orderedMatch = /^(\d+)\.\s+(.+)/.exec(line);
    if (orderedMatch) {
      tokens.push({ type: 'ordered', content: orderedMatch[2], index: orderedIndex++ });
      i++;
      continue;
    }

    // Paragraph: collect consecutive non-list lines
    const parts: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (next === '' || /^[-*•]\s+/.test(next) || /^\d+\.\s+/.test(next)) break;
      parts.push(next);
      i++;
    }
    tokens.push({ type: 'paragraph', content: parts.join(' ') });
  }

  return tokens;
}

// Renders inline markdown: **bold**, *italic*, `code`
function InlineText({
  text,
  color,
  fontSize,
  lineHeight,
}: {
  text: string;
  color: string;
  fontSize: number;
  lineHeight: number;
}) {
  // Split on bold (**...**), italic (*...*), code (`...`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  if (parts.length === 1) {
    return (
      <Text style={{ color, fontSize, lineHeight }} selectable>
        {text}
      </Text>
    );
  }

  return (
    <Text style={{ color, fontSize, lineHeight }} selectable>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
          return (
            <Text key={i} style={{ fontWeight: '700', color }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (/^\*[^*]+\*$/.test(part)) {
          return (
            <Text key={i} style={{ fontStyle: 'italic', color }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (/^`[^`]+`$/.test(part)) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: 'monospace',
                fontSize: fontSize - 1,
                color,
                backgroundColor: color + '15',
                borderRadius: 3,
              }}
            >
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export function SimpleMarkdown({ children, fontSize = 15, lineHeight = 23 }: Props) {
  const { colors } = useTheme();
  const tokens = tokenize(children ?? '');

  if (tokens.length === 0) return null;

  return (
    <View style={{ gap: 6 }}>
      {tokens.map((token, i) => {
        if (token.type === 'bullet') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ color: colors.mutedForeground, fontSize, lineHeight, marginTop: 1 }}>
                •
              </Text>
              <View style={{ flex: 1 }}>
                <InlineText
                  text={token.content}
                  color={colors.foreground}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                />
              </View>
            </View>
          );
        }

        if (token.type === 'ordered') {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize,
                  lineHeight,
                  minWidth: 18,
                  marginTop: 1,
                }}
              >
                {token.index}.
              </Text>
              <View style={{ flex: 1 }}>
                <InlineText
                  text={token.content}
                  color={colors.foreground}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                />
              </View>
            </View>
          );
        }

        return (
          <InlineText
            key={i}
            text={token.content}
            color={colors.foreground}
            fontSize={fontSize}
            lineHeight={lineHeight}
          />
        );
      })}
    </View>
  );
}
