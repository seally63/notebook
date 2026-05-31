// /signin — email + password (§4). Success → enter the app (Home). FORGOT PASSWORD
// is a Phase 4 screen (stubbed here). BEGIN ONE → Register.

import React, { useState } from 'react';
import { View, Text, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { AuthField } from '../components/AuthField';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { useAuth } from '../auth/AuthContext';
import { kv, KV } from '../lib/storage';

export function SignInScreen() {
  const navigation = useNavigation();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!configured) {
      Alert.alert('Sync not configured', 'This build has no Supabase config; you can still use the app locally.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await signIn(email.trim(), password);
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    kv.set(KV.onboarded, true);
    navigation.reset({ index: 0, routes: [{ name: 'Home' as never }] });
  };

  return (
    <Screen>
      <ScreenHeader title="SIGN IN" leading="back" onLeading={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Text style={{ fontFamily: fonts.display.semibold, fontSize: 30, color: colors.text, letterSpacing: -0.6, marginTop: 8 }}>
            Welcome back.
          </Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 6 }}>
            Pick up where you left off — your entries and people are waiting.
          </Text>

          <View style={{ marginTop: 8 }}>
            <AuthField label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
            <AuthField label="PASSWORD" value={password} onChangeText={setPassword} secure placeholder="your password" />
            <Text
              onPress={() => Alert.alert('Forgot password', 'Password recovery arrives in Phase 4.')}
              style={[text.monoMicro, { fontSize: 10, color: colors.accent, textAlign: 'right', marginTop: 16 }]}>
              FORGOT PASSWORD ↗
            </Text>
            {error && <Text style={{ fontFamily: fonts.body.regular, fontSize: 12, color: colors.accent, marginTop: 14 }}>{error}</Text>}
          </View>

          <View style={{ flex: 1 }} />

          <View style={{ paddingBottom: 26 }}>
            <Button label={busy ? 'SIGNING IN…' : 'SIGN IN'} disabled={busy} onPress={onSubmit} />
            <Text style={[text.monoMicro, { fontSize: 10.5, textAlign: 'center', marginTop: 14 }]}>
              NO NOTEBOOK YET?{' '}
              <Text onPress={() => navigation.navigate('Register' as never)} style={{ color: colors.accent }}>
                BEGIN ONE ↗
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
