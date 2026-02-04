// Privacy Policy Screen
// Full legal document for App Store compliance

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/themeStore';

const LAST_UPDATED = 'February 4, 2026';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.background.start, colors.background.end]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => Linking.openURL('https://memoryaisle.app/privacy')}
        >
          <Text style={styles.linkIcon}>↗</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <Section title="Introduction">
          <Paragraph>
            Welcome to MemoryAisle. Your privacy is important to us. This Privacy Policy explains how SLTR Digital LLC ({'"'}we,{'"'} {'"'}us,{'"'} or {'"'}our{'"'}) collects, uses, and protects your personal information when you use the MemoryAisle mobile application ({'"'}App{'"'}).
          </Paragraph>
          <Paragraph>
            By using MemoryAisle, you agree to the collection and use of information in accordance with this policy.
          </Paragraph>
        </Section>

        <Section title="Information We Collect">
          <Paragraph>
            We collect the following types of information to provide and improve our services:
          </Paragraph>

          <SubSection title="Account Information">
            <BulletList items={[
              'Name and email address',
              'Phone number (if provided for authentication)',
              'Account preferences and settings',
            ]} />
          </SubSection>

          <SubSection title="Family & Household Data">
            <BulletList items={[
              'Family member names and profiles',
              'Dietary preferences and restrictions',
              'Food allergies and intolerances',
            ]} />
          </SubSection>

          <SubSection title="App Usage Data">
            <BulletList items={[
              'Grocery lists and items',
              'Meal plans and recipes',
              'Purchase history and shopping patterns',
              'Favorite items and stores',
            ]} />
          </SubSection>

          <SubSection title="Location Data">
            <BulletList items={[
              'Store locations for geofencing features',
              'Location data is used only for store arrival/departure notifications',
              'Location is never tracked or stored beyond the active session',
            ]} />
          </SubSection>

          <SubSection title="Receipt Data">
            <BulletList items={[
              'Receipt images you choose to scan',
              'Processed for price extraction only',
              'Stored securely in your account',
            ]} />
          </SubSection>
        </Section>

        <Section title="Mira AI Data Collection">
          <Paragraph>
            Mira, our AI assistant, collects and processes the following data to provide personalized recommendations:
          </Paragraph>
          <BulletList items={[
            'Conversation history with Mira',
            'Meal preferences and dietary information',
            'Family dietary restrictions and allergies',
            'Shopping patterns and favorite items',
          ]} />
          <Paragraph>
            <Text style={styles.bold}>Important:</Text> Mira{"'"}s data is used solely to improve your in-app experience. Conversations may be processed by AI providers (OpenAI/Anthropic) but are NOT used to train their models. No personal data is shared beyond what{"'"}s needed for generating AI responses.
          </Paragraph>
          <Paragraph>
            You can clear Mira{"'"}s conversation history at any time through the app settings.
          </Paragraph>
          <Paragraph>
            Contact the Mira team: mira@memoryaisle.app
          </Paragraph>
        </Section>

        <Section title="How We Use Your Information">
          <Paragraph>
            We use your information to:
          </Paragraph>
          <BulletList items={[
            'Provide and maintain the App\'s functionality',
            'Personalize your shopping and meal planning experience',
            'Send store arrival/departure notifications via geofencing',
            'Generate AI-powered recommendations through Mira',
            'Process and track prices from scanned receipts',
            'Communicate with you about your account and the App',
            'Improve and develop new features',
          ]} />
        </Section>

        <Section title="Data Sharing and Disclosure">
          <View style={styles.highlight}>
            <Text style={styles.highlightTitle}>Our Commitment</Text>
            <Text style={styles.highlightText}>
              WE DO NOT SELL, SHARE, OR DISTRIBUTE YOUR PERSONAL DATA TO ANY THIRD PARTY FOR MARKETING OR ADVERTISING PURPOSES.
            </Text>
          </View>

          <Paragraph>
            We only share data with the following service providers who help us operate the App:
          </Paragraph>
          <BulletList items={[
            'Supabase - Secure database storage and authentication',
            'OpenAI/Anthropic - AI processing for Mira (conversations only, not used for training)',
            'Apple - Payment processing for subscriptions',
          ]} />
          <Paragraph>
            We may disclose information if required by law or to protect our rights, property, or safety.
          </Paragraph>
        </Section>

        <Section title="Data Retention">
          <View style={styles.highlight}>
            <Text style={styles.highlightTitle}>Minimal Data Retention</Text>
            <Text style={styles.highlightText}>
              WE DO NOT HOLD OR RETAIN DATA BEYOND WHAT IS NECESSARY TO PROVIDE THE SERVICE.
            </Text>
          </View>

          <Paragraph>
            Your data is retained only while your account is active. When you delete your account, all associated data is permanently removed from our systems.
          </Paragraph>
        </Section>

        <Section title="Data Security">
          <Paragraph>
            We take the security of your data seriously:
          </Paragraph>
          <BulletList items={[
            'All data is stored securely in Supabase with encryption at rest and in transit',
            'We use industry-standard security practices',
            'Access to user data is strictly controlled',
            'We regularly review and update our security measures',
          ]} />
          <Paragraph>
            While we strive to protect your data, no method of transmission over the Internet is 100% secure.
          </Paragraph>
        </Section>

        <Section title="Your Rights and Choices">
          <Paragraph>
            You have the following rights regarding your data:
          </Paragraph>
          <BulletList items={[
            'Access - View your data through the App',
            'Correction - Update your information at any time',
            'Deletion - Delete your account and all associated data through Settings',
            'Export - Contact us to request a copy of your data',
            'Opt-out - Disable location services and notifications in your device settings',
          ]} />
        </Section>

        <Section title="Children's Privacy">
          <Paragraph>
            MemoryAisle is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </Paragraph>
          <Paragraph>
            If you are a parent or guardian and believe we have collected information from a child under 13, please contact us immediately at legal@memoryaisle.app.
          </Paragraph>
        </Section>

        <Section title="Changes to This Policy">
          <Paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the App and updating the {'"'}Last updated{'"'} date.
          </Paragraph>
          <Paragraph>
            Your continued use of the App after changes constitutes acceptance of the updated policy.
          </Paragraph>
        </Section>

        <Section title="Contact Us">
          <Paragraph>
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </Paragraph>
          <BulletList items={[
            'Email: legal@memoryaisle.app',
            'Support: support@memoryaisle.app',
            'Mira AI: mira@memoryaisle.app',
            'Website: https://memoryaisle.app',
          ]} />
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            SLTR Digital LLC{'\n'}
            MemoryAisle - Family Grocery Planning
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Section Component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// SubSection Component
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.subSection}>
      <Text style={styles.subSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// Paragraph Component
function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

// Bullet List Component
function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletItem}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.end,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: COLORS.text.primary,
  },
  linkIcon: {
    fontSize: 20,
    color: COLORS.gold.dark,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  lastUpdated: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  subSection: {
    marginBottom: SPACING.md,
  },
  subSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold.dark,
    marginBottom: SPACING.sm,
  },
  paragraph: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  bold: {
    fontWeight: '700',
  },
  bulletList: {
    marginBottom: SPACING.md,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  bullet: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.base,
    marginRight: SPACING.sm,
    width: 16,
  },
  bulletText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
    flex: 1,
  },
  highlight: {
    backgroundColor: 'rgba(212, 165, 71, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold.base,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  highlightTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gold.dark,
    marginBottom: SPACING.xs,
  },
  highlightText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  footer: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
