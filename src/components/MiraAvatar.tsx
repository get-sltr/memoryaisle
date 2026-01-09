import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

type MiraState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface MiraAvatarProps {
  state: MiraState;
  size?: 'small' | 'medium' | 'large';
  colors: {
    primary: string;
    paperDark: string;
    ink: string;
  };
}

export function MiraAvatar({ state, size = 'medium', colors }: MiraAvatarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  const sizeMap = {
    small: 40,
    medium: 56,
    large: 80,
  };

  const avatarSize = sizeMap[size];
  const innerSize = avatarSize * 0.7;

  // Pulse animation for listening
  useEffect(() => {
    if (state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Rotate animation for thinking
  useEffect(() => {
    if (state === 'thinking') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state]);

  // Wave animation for speaking
  useEffect(() => {
    if (state === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [state]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const speakingScale = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  // Get emoji based on state
  const getEmoji = () => {
    switch (state) {
      case 'listening':
        return '👂';
      case 'thinking':
        return '🤔';
      case 'speaking':
        return '💬';
      default:
        return '✨';
    }
  };

  // Get ring color based on state
  const getRingColor = () => {
    switch (state) {
      case 'listening':
        return '#FF6B6B'; // Red for recording
      case 'thinking':
        return '#FFD93D'; // Yellow for processing
      case 'speaking':
        return '#6BCB77'; // Green for speaking
      default:
        return colors.primary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Outer ring (animated) */}
      <Animated.View
        style={[
          styles.outerRing,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            borderColor: getRingColor(),
            transform: [
              { scale: state === 'listening' ? pulseAnim : 1 },
              { rotate: state === 'thinking' ? rotation : '0deg' },
            ],
          },
        ]}
      />

      {/* Inner circle with gradient effect */}
      <Animated.View
        style={[
          styles.innerCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.paperDark,
            transform: [{ scale: state === 'speaking' ? speakingScale : 1 }],
          },
        ]}
      >
        <Text style={[styles.emoji, { fontSize: innerSize * 0.5 }]}>
          {getEmoji()}
        </Text>
      </Animated.View>

      {/* Sound waves for speaking */}
      {state === 'speaking' && (
        <View style={styles.soundWaves}>
          <SoundWave delay={0} color={getRingColor()} />
          <SoundWave delay={100} color={getRingColor()} />
          <SoundWave delay={200} color={getRingColor()} />
        </View>
      )}

      {/* Listening indicator dots */}
      {state === 'listening' && (
        <View style={styles.listeningDots}>
          <ListeningDot delay={0} color={getRingColor()} />
          <ListeningDot delay={150} color={getRingColor()} />
          <ListeningDot delay={300} color={getRingColor()} />
        </View>
      )}
    </View>
  );
}

// Sound wave component for speaking state
function SoundWave({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.soundWave,
        {
          backgroundColor: color,
          transform: [
            {
              scaleY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ],
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          }),
        },
      ]}
    />
  );
}

// Listening dot component
function ListeningDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.listeningDot,
        {
          backgroundColor: color,
          opacity: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1],
          }),
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.2],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  innerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emoji: {
    textAlign: 'center',
  },
  soundWaves: {
    position: 'absolute',
    right: -20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  soundWave: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  listeningDots: {
    position: 'absolute',
    bottom: -12,
    flexDirection: 'row',
    gap: 4,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
