import React, { useEffect, useState } from 'react';
import { Animated, View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFadeIn } from '../../hooks/useFadeIn';
import { Text } from '../../components/ui';
import { Colors, Fonts, Gradients, Radius, Spacing } from '../../theme';
import { getSettings } from '../../lib/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'BlogDetail'>;
  route: { params: { slug: string; title: string } };
}

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image_url: string;
};

function formatDate(iso: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Egyszerű szöveg renderelő: üres sorok = bekezdés */
function PlainContent({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return (
      <View>
        {lines.map((line, i) => (
          <Text key={i} style={styles.paragraph}>{line}</Text>
        ))}
      </View>
    );
  }
  return (
    <View>
      {paragraphs.map((para, i) => (
        <Text key={i} style={styles.paragraph}>{para}</Text>
      ))}
    </View>
  );
}

export function BlogDetailScreen({ navigation, route }: Props) {
  const { slug } = route.params;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const contentAnim = useFadeIn(0);

  useEffect(() => {
    getSettings(['home_blog_posts_json']).then((s) => {
      try {
        const parsed = JSON.parse(s.home_blog_posts_json ?? '[]') as BlogPost[];
        const found = Array.isArray(parsed) ? parsed.find((p) => p.slug === slug) : null;
        if (found) {
          setPost(found);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      }
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </LinearGradient>
    );
  }

  if (notFound || !post) {
    return (
      <LinearGradient colors={Gradients.bg} style={styles.center}>
        <Text style={styles.notFoundText}>A cikk nem található.</Text>
      </LinearGradient>
    );
  }

  const bodyText = (post.content || post.excerpt || '').trim();

  return (
    <LinearGradient colors={Gradients.bg} style={styles.bg}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={contentAnim}>
          {/* Meta sor */}
          {post.date ? (
            <Text variant="label" style={styles.dateLine}>
              {formatDate(post.date)}
            </Text>
          ) : null}

          {/* Cím */}
          <Text style={styles.title}>{post.title}</Text>

          {/* Kivonat ha van */}
          {post.excerpt && post.content && post.excerpt !== post.content ? (
            <View style={styles.excerptBox}>
              <Text style={styles.excerptText}>{post.excerpt}</Text>
            </View>
          ) : null}

          {/* Elválasztó vonal */}
          <View style={styles.divider} />

          {/* Tartalom */}
          {bodyText ? (
            <PlainContent text={bodyText} />
          ) : (
            <Text variant="caption" style={styles.noContent}>
              A cikk tartalma hamarosan.
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: Colors.textSecondary, fontSize: Fonts.sizes.base },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 48,
  },
  dateLine: {
    color: Colors.accent,
    marginBottom: 10,
  },
  title: {
    fontSize: Fonts.sizes.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  excerptBox: {
    backgroundColor: Colors.bgSurface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  excerptText: {
    fontSize: Fonts.sizes.base,
    color: Colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  paragraph: {
    fontSize: Fonts.sizes.base,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  noContent: {
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
