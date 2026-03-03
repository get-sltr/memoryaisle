import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useBlogStore } from '../../src/stores/blogStore';
import { blogService, type BlogPost, BLOG_CATEGORIES } from '../../src/services/blog';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BlogScreen() {
  const {
    posts,
    isLoading,
    hasMore,
    selectedCategory,
    initialize,
    loadMore,
    setCategory,
  } = useBlogStore();

  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [postContent, setPostContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const handleOpenPost = async (post: BlogPost) => {
    setSelectedPost(post);
    if (post.content_url) {
      setLoadingContent(true);
      const result = await blogService.getPostContent(post.content_url);
      setPostContent(result.content || null);
      setLoadingContent(false);
    }
  };

  const handleClosePost = () => {
    setSelectedPost(null);
    setPostContent(null);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  };

  const renderCategoryTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryScroll}
      contentContainerStyle={styles.categoryContent}
    >
      {BLOG_CATEGORIES.map((cat) => (
        <Pressable
          key={cat.id}
          style={[
            styles.categoryTab,
            selectedCategory === cat.id && styles.categoryTabActive,
          ]}
          onPress={() => setCategory(cat.id)}
        >
          <Text
            style={[
              styles.categoryLabel,
              selectedCategory === cat.id && styles.categoryLabelActive,
            ]}
          >
            {cat.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderPostCard = ({ item }: { item: BlogPost }) => (
    <Pressable style={styles.postCard} onPress={() => handleOpenPost(item)}>
      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.4)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.postCardBorder} />

      {item.cover_image_url ? (
        <Image source={{ uri: item.cover_image_url }} style={styles.postCover} />
      ) : (
        <View style={[styles.postCover, styles.postCoverPlaceholder]}>
          <LinearGradient
            colors={[COLORS.gold.lightest, COLORS.gold.light]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.postCoverEmoji}>📖</Text>
        </View>
      )}

      <View style={styles.postCardContent}>
        <View style={styles.postMeta}>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>
              {BLOG_CATEGORIES.find(c => c.id === item.category)?.label || item.category}
            </Text>
          </View>
          {item.published_at && (
            <Text style={styles.postDate}>
              {new Date(item.published_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          )}
        </View>
        <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
        {item.excerpt && (
          <Text style={styles.postExcerpt} numberOfLines={3}>{item.excerpt}</Text>
        )}
        <Text style={styles.readMore}>Read more →</Text>
      </View>
    </Pressable>
  );

  // Article detail view
  if (selectedPost) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleClosePost}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.backText}>{'\u2039'} Blog</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.articleScroll}
          contentContainerStyle={styles.articleContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedPost.cover_image_url && (
            <Image
              source={{ uri: selectedPost.cover_image_url }}
              style={styles.articleCover}
            />
          )}

          <Text style={styles.articleTitle}>{selectedPost.title}</Text>

          <View style={styles.articleMeta}>
            <Text style={styles.articleAuthor}>By {selectedPost.author}</Text>
            {selectedPost.published_at && (
              <Text style={styles.articleDate}>
                {new Date(selectedPost.published_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>

          {selectedPost.tags.length > 0 && (
            <View style={styles.tagRow}>
              {selectedPost.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {loadingContent ? (
            <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.xl }} />
          ) : postContent ? (
            <View style={styles.articleBody}>
              {postContent.split('\n').map((line, i) => {
                if (line.startsWith('# ')) {
                  return <Text key={i} style={styles.mdH1}>{line.slice(2)}</Text>;
                }
                if (line.startsWith('## ')) {
                  return <Text key={i} style={styles.mdH2}>{line.slice(3)}</Text>;
                }
                if (line.startsWith('### ')) {
                  return <Text key={i} style={styles.mdH3}>{line.slice(4)}</Text>;
                }
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <View key={i} style={styles.mdListItem}>
                      <Text style={styles.mdBullet}>•</Text>
                      <Text style={styles.mdListText}>{line.slice(2)}</Text>
                    </View>
                  );
                }
                if (line.trim() === '') {
                  return <View key={i} style={{ height: SPACING.sm }} />;
                }
                return <Text key={i} style={styles.mdParagraph}>{line}</Text>;
              })}
            </View>
          ) : selectedPost.excerpt ? (
            <Text style={styles.articleExcerpt}>{selectedPost.excerpt}</Text>
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // Blog feed view
  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Blog</Text>
          <Text style={styles.subtitle}>Recipes, Tips & Stories</Text>
        </View>
      </View>

      {/* Category Tabs */}
      {renderCategoryTabs()}

      {/* Post Feed */}
      {posts.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>Coming Soon</Text>
          <Text style={styles.emptyText}>
            We're cooking up delicious content — seasonal recipes, meal prep guides, holiday planning, and more!
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostCard}
          contentContainerStyle={styles.feedContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isLoading ? (
              <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.lg }} />
            ) : null
          }
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Category Tabs
  categoryScroll: {
    maxHeight: 44,
    marginBottom: SPACING.sm,
  },
  categoryContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  categoryTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.3)',
  },
  categoryTabActive: {
    backgroundColor: `${COLORS.gold.base}20`,
    borderColor: COLORS.gold.base,
  },
  categoryLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  categoryLabelActive: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  // Post Cards
  feedContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
    gap: SPACING.md,
  },
  postCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  postCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  postCover: {
    width: '100%',
    height: 180,
  },
  postCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCoverEmoji: {
    fontSize: 48,
  },
  postCardContent: {
    padding: SPACING.md,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  categoryChip: {
    backgroundColor: `${COLORS.gold.base}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  postDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.tertiary,
  },
  postTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  postExcerpt: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  readMore: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Article Detail
  articleScroll: {
    flex: 1,
  },
  articleContent: {
    paddingHorizontal: SPACING.lg,
  },
  articleCover: {
    width: '100%',
    height: 220,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
  },
  articleTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xxl,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 30,
    marginBottom: SPACING.sm,
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  articleAuthor: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  articleDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.tertiary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  tag: {
    backgroundColor: `${COLORS.gold.base}10`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  tagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
  articleBody: {
    paddingTop: SPACING.sm,
  },
  articleExcerpt: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.secondary,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  // Markdown rendering
  mdH1: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  mdH2: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  mdH3: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  mdParagraph: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  mdListItem: {
    flexDirection: 'row',
    paddingLeft: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  mdBullet: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.base,
    marginRight: SPACING.sm,
    lineHeight: 24,
  },
  mdListText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
});
