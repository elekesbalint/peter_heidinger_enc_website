import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme';

const { width, height } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

export function SplashAnimationScreen({ onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Fade in + zoom in the logo
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // 2. Tagline fades in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        delay: 100,
        useNativeDriver: true,
      }),
      // 3. Hold
      Animated.delay(700),
      // 4. Zoom into the text (scale up + fade out) — "belezoominolós" hatás
      Animated.parallel([
        Animated.timing(containerScale, {
          toValue: 6,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 420,
          delay: 130,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onDone();
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: containerOpacity, transform: [{ scale: containerScale }] },
      ]}
    >
      <LinearGradient colors={['#0D0D1A', '#070710']} style={StyleSheet.absoluteFill} />

      {/* Logo szöveg */}
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoRow}>
          <Animated.Text style={styles.logoAdria}>Adria</Animated.Text>
          <Animated.Text style={styles.logoGo}>Go</Animated.Text>
        </View>
        <Animated.View style={[styles.taglineWrap, { opacity: taglineOpacity }]}>
          <View style={styles.taglineLine} />
          <Animated.Text style={styles.tagline}>ELEKTRONIKUS ÚTDÍJ-FIZETÉS</Animated.Text>
          <View style={styles.taglineLine} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    zIndex: 999,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  logoAdria: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    includeFontPadding: false,
  },
  logoGo: {
    fontSize: 52,
    fontWeight: '700',
    color: '#6C63FF',
    letterSpacing: -1.5,
    includeFontPadding: false,
  },
  taglineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  taglineLine: {
    flex: 1,
    height: 1,
    width: 40,
    backgroundColor: 'rgba(108,99,255,0.45)',
  },
  tagline: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(108,99,255,0.85)',
    letterSpacing: 3,
  },
});
