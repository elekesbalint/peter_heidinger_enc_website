import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Returns an Animated.Value that fades + slides in from below on mount.
 * Use with `animatedStyle` on an Animated.View.
 *
 * @param delay - optional delay in ms before animation starts
 * @param duration - animation duration in ms (default 400)
 */
export function useFadeIn(delay = 0, duration = 350) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return {
    opacity,
    transform: [{ translateY }],
  };
}
