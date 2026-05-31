// /welcome — the typographic cover (§4). Begin → Register, Sign in → SignIn, and a
// "use without an account" path (the brief's skippable, local-first entry — the mock
// has no skip button, so this is an on-brand addition; noted as a resolved ambiguity).

import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { kv, KV } from '../lib/storage';

export function WelcomeScreen() {
  const navigation = useNavigation();

  const useWithoutAccount = () => {
    kv.set(KV.onboarded, true);
    navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
  };

  return (
    <Screen padTop>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* breadcrumb */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.rule,
          }}>
          <Text style={[text.monoLabel, { color: colors.text }]}>NOTEBOOK</Text>
          <Text style={[text.monoLabel]}>v · 0.1</Text>
        </View>

        {/* cover */}
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 24 }}>
          <Text style={{ fontFamily: fonts.display.semibold, fontSize: 56, lineHeight: 56, letterSpacing: -2, color: colors.text }}>
            Notebook.
          </Text>
          <Text style={[text.monoLabel, { color: colors.accent, marginTop: 18 }]}>WHAT IT’S FOR</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: 17, color: colors.textSoft, lineHeight: 25, marginTop: 10 }}>
            Write to remember.{'\n'}Remember to ask.{'\n'}Ask to listen.
          </Text>
          <View style={{ marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.rule }}>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: 13, color: colors.muted, lineHeight: 20 }}>
              A quiet journal for the people in your life — and the words you’re learning to meet them in.
            </Text>
          </View>
        </View>

        {/* actions */}
        <View>
          <Button label="BEGIN A NEW NOTEBOOK" onPress={() => navigation.navigate('Register' as never)} />
          <Button label="SIGN IN" variant="outline" height={48} style={{ marginTop: 10 }} onPress={() => navigation.navigate('SignIn' as never)} />
          <Text onPress={useWithoutAccount} style={[text.monoMicro, { fontSize: 10, textAlign: 'center', marginTop: 16, color: colors.muted }]}>
            USE WITHOUT AN ACCOUNT →
          </Text>
          <Text style={[text.monoMicro, { fontSize: 9.5, textAlign: 'center', marginTop: 12 }]}>
            NO TRACKERS · LOCAL FIRST · EXPORT ANYTIME
          </Text>
        </View>
      </View>
    </Screen>
  );
}
