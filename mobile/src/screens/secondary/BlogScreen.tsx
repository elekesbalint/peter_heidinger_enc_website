import React, { useEffect, useState } from 'react';
import { Animated, View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFadeIn } from '../../hooks/useFadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper, Text, Card } from '../../components/ui';
import { Colors, Gradients, Spacing, Fonts, Radius } from '../../theme';
import { getSettings } from '../../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'BlogList'>;
}

interface BlogPost {
  slug: string;
  title: string;
  excerpt?: string;
  date?: string;
  image?: string;
  category?: string;
}

function AnimatedPostItem({ children, delay }: { children: React.ReactNode; delay: number }) {
  const anim = useFadeIn(delay, 400);
  return <Animated.View style={anim}>{children}</Animated.View>;
}

export function BlogScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const headerAnim = useFadeIn(0);

  useEffect(() => {
    getSettings(['home_blog_posts_json']).then((s) => {
      try {
        const parsed = JSON.parse(s.home_blog_posts_json ?? '[]');
        setPosts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setPosts([]);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  return (
    <ScreenWrapper>
      <Animated.View style={[styles.header, headerAnim]}>
        <Text variant="h2">Hírek & Blog</Text>
        <Text variant="caption" style={{ marginTop: 4 }}>AdriaGo legfrissebb hírei</Text>
      </Animated.View>

      {posts.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📰</Text>
          <Text variant="caption" style={{ textAlign: 'center' }}>Nincsenek cikkek.</Text>
        </View>
      )}

      {posts.map((post, i) => (
        <AnimatedPostItem key={post.slug} delay={i * 60}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('BlogDetail', { slug: post.slug, title: post.title })}
          >
            <Card style={styles.postCard} padding={0}>
              {post.image && (
                <View style={styles.imagePlaceholder}>
                  <LinearGradient colors={Gradients.dark} style={styles.imagePlaceholder}>
                    <Text style={{ fontSize: 32 }}>📰</Text>
                  </LinearGradient>
                </View>
              )}
              <View style={styles.postContent}>
                {post.category && (
                  <Text variant="label" style={styles.category}>{post.category}</Text>
                )}
                <Text semibold style={styles.postTitle}>{post.title}</Text>
                {post.excerpt && (
                  <Text variant="caption" numberOfLines={2} style={{ marginTop: 4 }}>
                    {post.excerpt}
                  </Text>
                )}
                {post.date && (
                  <Text variant="label" style={styles.date}>{post.date}</Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        </AnimatedPostItem>
      ))}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: Spacing.md, marginBottom: Spacing.lg },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.sm },
  postCard: { marginBottom: 14 },
  imagePlaceholder: {
    height: 140,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postContent: { padding: 16 },
  category: { marginBottom: 4, color: Colors.accent },
  postTitle: { fontSize: Fonts.sizes.md },
  date: { marginTop: 10, color: Colors.textTertiary },
});
