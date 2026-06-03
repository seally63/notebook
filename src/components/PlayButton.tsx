// A play ▶ control bound to the shared audio player. Shows a spinner while a phrase is
// still synthesising (pending_audio) and a muted/disabled state when there's no audio
// (e.g. English-only or TTS not yet configured). Tapping toggles play/stop.

import React, { useEffect, useState } from 'react';
import { Pressable, ActivityIndicator, View, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, radius } from '../theme/tokens';
import { playAudio, subscribePlayer } from '../services/player';

export function PlayButton({
  audioRef,
  pending = false,
  size = 'sm',
  iconColor = colors.text,
}: {
  audioRef: string | null | undefined;
  pending?: boolean;
  size?: 'sm' | 'md';
  iconColor?: string;
}) {
  const [playingRef, setPlayingRef] = useState<string | null>(null);
  useEffect(() => subscribePlayer(setPlayingRef), []);

  const dim = size === 'md' ? 30 : 24;
  const box: ViewStyle = {
    width: dim,
    height: dim,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (pending) {
    return (
      <View style={box}>
        <ActivityIndicator size="small" color={colors.mutedSoft} />
      </View>
    );
  }

  const hasAudio = !!audioRef;
  const isPlaying = hasAudio && playingRef === audioRef;

  return (
    <Pressable
      onPress={() => hasAudio && playAudio(audioRef)}
      disabled={!hasAudio}
      hitSlop={8}
      style={({ pressed }) => [box, { opacity: hasAudio ? (pressed ? 0.5 : 1) : 0.35 }]}>
      <Icon
        name={isPlaying ? 'close' : 'play'}
        size={size === 'md' ? 11 : 9}
        color={hasAudio ? iconColor : colors.mutedSoft}
      />
    </Pressable>
  );
}
