// Renders a BodyNode[] as the read view. Text + inline [name] refs + inline «phrase»
// refs all flow inside the paragraph. Tapping a «phrase» toggles a reveal panel
// (translation + romanisation + ▶) right after that paragraph. person/phrase rows are
// resolved at render time (passed in as maps) so a rename/translation updates everywhere.

import React, { useState } from 'react';
import { View, Text, type TextStyle } from 'react-native';
import type { BodyNode, PersonRow, PhraseRow } from '../db/schema';
import { PersonRef } from './PersonRef';
import { PhraseRef } from './PhraseRef';
import { PhraseReveal } from './PhraseReveal';
import { text as textStyles } from '../theme/typography';

/** One-line(ish) preview for list rows: text + inline [name] refs; phrases shown as
 *  their English «…» so the row still reads naturally. */
export function SnippetText({
  nodes,
  people,
  phrases,
  numberOfLines = 3,
  style,
  onPersonPress,
}: {
  nodes: BodyNode[];
  people: Record<string, PersonRow>;
  phrases?: Record<string, PhraseRow>;
  numberOfLines?: number;
  style?: TextStyle;
  onPersonPress?: (id: string) => void;
}) {
  // A preview reads as continuous text — collapse newlines + runs of whitespace to single
  // spaces so multi-line / blank-line entries don't look cluttered in the TODAY/list rows.
  const inline: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (n.type === 'text') inline.push(<Text key={i}>{n.text.replace(/\s+/g, ' ')}</Text>);
    else if (n.type === 'person')
      inline.push(
        <PersonRef
          key={i}
          name={people[n.person_id]?.name ?? '…'}
          onPress={onPersonPress ? () => onPersonPress(n.person_id) : undefined}
        />,
      );
    else if (n.type === 'phrase') inline.push(<PhraseRef key={i} en={phrases?.[n.phrase_id]?.en ?? '…'} />);
    else if (n.type === 'phrase_stub') inline.push(<PhraseRef key={i} en={n.en} muted />);
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
}

export function BodyText({ nodes, people, phrases, textStyle, onPersonPress }: BodyTextProps) {
  // which phrase ids have their reveal panel open
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  // We split into LINES (on '\n') so a tapped phrase's reveal panel renders right under
  // the line it sits on — not at the bottom of the whole entry. Each line is one <Text>;
  // after a line, render reveal panels for any open phrases that appeared in it.
  const out: React.ReactNode[] = [];
  let inline: React.ReactNode[] = [];
  let linePhraseIds: string[] = [];
  let key = 0;

  const flushLine = () => {
    out.push(
      <Text key={`p${key++}`} style={[textStyles.body, { lineHeight: 22 }, textStyle]}>
        {inline.length ? inline : ' '}
      </Text>,
    );
    for (const pid of linePhraseIds) {
      if (open[pid] && phrases[pid]) {
        const ph = phrases[pid];
        const taggedName = ph.for_person ? people[ph.for_person]?.name : undefined;
        out.push(<PhraseReveal key={`r${key++}`} phrase={ph} taggedName={taggedName} />);
      }
    }
    inline = [];
    linePhraseIds = [];
  };

  nodes.forEach((n, i) => {
    if (n.type === 'text') {
      // split on newlines: each '\n' ends the current line (and its reveals)
      const parts = n.text.split('\n');
      parts.forEach((part, pi) => {
        if (pi > 0) flushLine(); // newline boundary
        if (part) inline.push(<Text key={`${i}-${pi}`}>{part}</Text>);
      });
    } else if (n.type === 'person') {
      const p = people[n.person_id];
      inline.push(
        <PersonRef key={i} name={p?.name ?? '…'} onPress={onPersonPress ? () => onPersonPress(n.person_id) : undefined} />,
      );
    } else if (n.type === 'phrase') {
      const ph = phrases[n.phrase_id];
      inline.push(<PhraseRef key={i} en={ph?.en ?? '…'} onPress={() => toggle(n.phrase_id)} />);
      linePhraseIds.push(n.phrase_id);
    } else if (n.type === 'phrase_stub') {
      inline.push(<PhraseRef key={i} en={n.en} muted />);
    }
  });
  flushLine();

  return <View>{out}</View>;
}
