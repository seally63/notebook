// /register — name + email + password (§4). On success, enter the app locally; if the
// project requires email confirmation, we tell the user and still let them in (sync
// activates after they confirm + sign in). SIGN IN → SignIn.

import React, { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { AuthField } from '../components/AuthField';
import { Button } from '../components/Button';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { useAuth } from '../auth/AuthContext';
import { kv, KV } from '../lib/storage';

export function RegisterScreen() {
  const navigation = useNavigation();
  const { signUp, configured } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = () => {
    kv.set(KV.onboarded, true);
    navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
  };

  const onSubmit = async () => {
    if (!configured) {
      // local-first: no sync config → just enter and write locally
      enter();
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least eight characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e, needsConfirmation } = await signUp(email.trim(), password, name.trim() || undefined);
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    if (needsConfirmation) {
      Alert.alert(
        'Confirm your email',
        'We sent a confirmation link to your email. Your notebook works now; sync turns on once you confirm and sign in.',
        [{ text: 'OK', onPress: enter }],
      );
      return;
    }
    enter();
  };

  return (
    <Screen>
      <ScreenHeader title="NEW NOTEBOOK" leading="back" onLeading={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: fonts.display.semibold, fontSize: 30, color: colors.text, letterSpacing: -0.6, marginTop: 8 }}>
            Begin.
          </Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 6 }}>
            Three small things, and you’re writing. We keep this on your device. Sync is optional, always.
          </Text>

          <AuthField label="YOUR NAME" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <AuthField label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
          <AuthField label="PASSWORD" value={password} onChangeText={setPassword} secure placeholder="at least eight characters" />

          <View style={{ marginTop: 18, padding: 12, backgroundColor: colors.accentSoft, borderRadius: radius.sm, flexDirection: 'row' }}>
            <Text style={[text.monoMicro, { fontSize: 9.5, color: colors.accent, marginRight: 6 }]}>NOTE</Text>
            <Text style={{ flex: 1, fontFamily: fonts.body.regular, fontSize: 12, color: colors.textSoft, lineHeight: 18 }}>
              This is a quiet app. We don’t do streaks, prompts, or notifications you didn’t ask for.
            </Text>
          </View>

          {error && <Text style={{ fontFamily: fonts.body.regular, fontSize: 12, color: colors.accent, marginTop: 14 }}>{error}</Text>}

          <View style={{ flex: 1 }} />

          <View style={{ paddingBottom: 26 }}>
            <Button label={busy ? 'OPENING…' : 'OPEN MY NOTEBOOK'} disabled={busy} onPress={onSubmit} />
            <Text style={[text.monoMicro, { fontSize: 10.5, textAlign: 'center', marginTop: 14 }]}>
              ALREADY HAVE ONE?{' '}
              <Text onPress={() => navigation.navigate('SignIn' as never)} style={{ color: colors.accent }}>
                SIGN IN ↗
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
