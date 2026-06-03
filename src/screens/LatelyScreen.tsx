// Lately (`/lately`) — the relational overview (dock·LATELY). Three sections built from
// the local DB (src/data/lately.ts):
//   1. LAST FOUR WEEKS — a Mon-first calendar; days with a committed entry are marked
//      (dot scaled by length), today is filled. Tap a marked day → its entry.
//   2. CARRY OVER — forward-looking notes-to-self from recent entries → tap to the source.
//   3. QUIET FOR A WHILE — people not mentioned in 14+ days → tap to /people/:id.
// The ☰ opens Settings (where the People/Phrases libraries + account now live).

import React, { useCallback, useState } from 'react';
import { Text, ScrollView, View, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { useDockLayout } from '../components/dockLayout';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { monthYearLabel } from '../lib/format';
import { getLatelyData, type LatelyData, type CalDay } from '../data/lately';

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function LatelyScreen() {
  const { clearance } = useDockLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [data, setData] = useState<LatelyData>({ weeks: [], carryOvers: [], quiet: [] });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getLatelyData().then((d) => {
        if (alive) setData(d);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const openDay = (day: CalDay) => {
    if (day.entryId) navigation.navigate('Entry', { id: day.entryId });
  };

  const empty = data.weeks.every((w) => w.every((d) => !d.has)) && data.carryOvers.length === 0 && data.quiet.length === 0;

  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: clearance }}>
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.rule,
          }}>
          <Text style={[text.monoLabel, { color: colors.text }]}>NOTEBOOK · LATELY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[text.monoLabel]}>{monthYearLabel()}</Text>
            <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10} accessibilityLabel="Settings">
              <Icon name="hamburger" size={17} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <Text style={[text.body, { color: colors.textSoft, marginTop: 12, lineHeight: 20, fontSize: 13 }]}>
          who you’ve been thinking about — and who’s waiting.
        </Text>

        {/* calendar */}
        <SectionLabel label="LAST FOUR WEEKS" trailing={monthYearLabel()} />
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {WD.map((l, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.mono.regular, fontSize: 9, color: colors.mutedSoft, letterSpacing: 0.9 }}>
              {l}
            </Text>
          ))}
        </View>
        {data.weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {week.map((day) => (
              <DayCell key={day.date} day={day} onPress={() => openDay(day)} />
            ))}
          </View>
        ))}

        {/* carry over */}
        <SectionLabel
          label="CARRY OVER"
          trailing={data.carryOvers.length ? `${data.carryOvers.length} TO BRING` : ''}
        />
        {data.carryOvers.length === 0 ? (
          <Hint>notes-to-self from your entries (“ask about…”, “remember…”) gather here.</Hint>
        ) : (
          data.carryOvers.map((c) => (
            <Pressable
              key={c.entryId}
              onPress={() => navigation.navigate('Entry', { id: c.entryId })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 11,
                borderTopWidth: 1,
                borderTopColor: colors.ruleSoft,
                opacity: pressed ? 0.6 : 1,
              })}>
              <Text style={{ width: 44, fontFamily: fonts.mono.regular, fontSize: 10, color: colors.muted, paddingTop: 2 }}>
                {c.date.slice(8)}.{c.date.slice(5, 7)}
              </Text>
              <View style={{ flex: 1 }}>
                {!!c.personName && (
                  <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10.5, color: colors.accent, marginBottom: 3 }}>
                    → [{c.personName.toLowerCase()}]
                  </Text>
                )}
                <Text style={[text.body, { fontSize: 13.5, lineHeight: 19 }]}>{c.text}</Text>
              </View>
              <Icon name="chev" size={13} color={colors.mutedSoft} />
            </Pressable>
          ))
        )}

        {/* quiet for a while */}
        <SectionLabel label="QUIET FOR A WHILE" trailing="" />
        <Hint>no nudge. just a held door.</Hint>
        {data.quiet.length === 0 ? (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, paddingVertical: 8, textTransform: 'none' }]}>
            no one’s gone quiet — nice.
          </Text>
        ) : (
          data.quiet.map((q) => (
            <Pressable
              key={q.person.id}
              onPress={() => navigation.navigate('PersonDetail', { id: q.person.id })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 11,
                borderTopWidth: 1,
                borderTopColor: colors.ruleSoft,
                opacity: pressed ? 0.6 : 1,
              })}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[text.body]} numberOfLines={1}>
                  {q.person.name}
                </Text>
                {!!q.lastNote && (
                  <Text style={[text.monoMicro, { fontSize: 10.5, textTransform: 'none', marginTop: 2 }]} numberOfLines={1}>
                    last note · {q.lastNote}
                  </Text>
                )}
              </View>
              <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>
                {q.daysSince}d
              </Text>
            </Pressable>
          ))
        )}

        {empty && (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center', textTransform: 'none', lineHeight: 16 }]}>
            write a few entries and mention people — your relational overview builds itself here.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function DayCell({ day, onPress }: { day: CalDay; onPress: () => void }) {
  const dotSize = day.has ? Math.round(4 + day.weight * 6) : 0;
  return (
    <Pressable
      onPress={onPress}
      disabled={!day.has}
      style={{
        flex: 1,
        aspectRatio: 1,
        borderRadius: radius.sm,
        backgroundColor: day.isToday ? colors.accent : day.has ? colors.surface : 'transparent',
        borderWidth: day.isToday ? 0 : 1,
        borderColor: day.has ? colors.rule : colors.ruleSoft,
        padding: 4,
        justifyContent: 'space-between',
      }}>
      <Text
        style={{
          fontFamily: fonts.mono.regular,
          fontSize: 10,
          color: day.isToday ? '#fff' : day.has ? colors.text : colors.mutedSoft,
        }}>
        {String(day.d).padStart(2, '0')}
      </Text>
      {day.has && !day.isToday && (
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colors.accent, alignSelf: 'flex-end' }} />
      )}
      {day.isToday && (
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 7.5, color: '#fff', alignSelf: 'flex-end', opacity: 0.85, letterSpacing: 0.6 }}>
          NOW
        </Text>
      )}
    </Pressable>
  );
}

function SectionLabel({ label, trailing }: { label: string; trailing?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginTop: 22,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.rule,
      }}>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.text, letterSpacing: tracking(10, 0.14), textTransform: 'uppercase' }}>
        {label}
      </Text>
      {!!trailing && <Text style={[text.monoMicro, { fontSize: 10 }]}>{trailing}</Text>}
    </View>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.body.regular, fontSize: 11.5, color: colors.muted, lineHeight: 17, marginTop: 6 }}>
      {children}
    </Text>
  );
}
