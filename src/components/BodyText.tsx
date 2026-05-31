// Renders a BodyNode[] as the read view: text + inline [name] refs flow inside Text
// paragraphs; phrase / phrase_stub nodes break out as block cards.
// person/phrase rows are resolved at render time (passed in as maps) so a renamed
// person updates everywhere.

import React from 'react';
import { View, Text, type TextStyle } from 'react-native';
import type { BodyNode, PersonRow } from '../db/schema';
import type { PhraseRow } from '../db/schema';
import { PersonRef } from './PersonRef';
import { PhraseCard, PhraseStubCard } from './PhraseCard';
import { text as textStyles } from '../theme/typography';

/** One-line(ish) preview for list rows: text + inline [name] refs, phrase nodes omitted. */
export function SnippetText({
  nodes,
  people,
  numberOfLines = 3,
  style,
}: {
  nodes: BodyNode[];
  people: Record<string, PersonRow>;
  numberOfLines?: number;
  style?: TextStyle;
}) {
  const inline: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (n.type === 'text') inline.push(<Text key={i}>{n.text}</Text>);
    else if (n.type === 'person') inline.push(<PersonRef key={i} name={people[n.person_id]?.name ?? '…'} />);
  });
  return (
    <Text numberOfLines={numberOfLines} style={[textStyles.body, { lineHeight: 21 }, style]}>
      {inline}
    </Text>
  );
}

interface BodyTextProps {
  nodes: BodyNode[];
  people: Record<string, PersonRow>;
  phrases: Record<string, PhraseRow>;
  textStyle?: TextStyle;
  onPersonPress?: (id: string) => void;
  onPhrasePlay?: (id: string) => void;
}

export function BodyText({ nodes, people, phrases, textStyle, onPersonPress, onPhrasePlay }: BodyTextProps) {
  const blocks: React.ReactNode[] = [];
  let inline: React.ReactNode[] = [];

  const flush = () => {
    if (inline.length === 0) return;
    blocks.push(
      <Text key={`p${blocks.length}`} style={[textStyles.body, { lineHeight: 22 }, textStyle]}>
        {inline}
      </Text>,
    );
    inline = [];
  };

  nodes.forEach((n, i) => {
    if (n.type === 'text') {
      inline.push(<Text key={i}>{n.text}</Text>);
    } else if (n.type === 'person') {
      const p = people[n.person_id];
      inline.push(
        <PersonRef key={i} name={p?.name ?? '…'} onPress={onPersonPress ? () => onPersonPress(n.person_id) : undefined} />,
      );
    } else if (n.type === 'phrase') {
      flush();
      const ph = phrases[n.phrase_id];
      if (ph) {
        const taggedName = ph.for_person ? people[ph.for_person]?.name : undefined;
        blocks.push(
          <PhraseCard
            key={i}
            phrase={ph}
            taggedName={taggedName}
            onPlay={onPhrasePlay ? () => onPhrasePlay(n.phrase_id) : undefined}
          />,
        );
      }
    } else if (n.type === 'phrase_stub') {
      flush();
      blocks.push(<PhraseStubCard key={i} en={n.en} />);
    }
  });
  flush();

  return <View>{blocks}</View>;
}
