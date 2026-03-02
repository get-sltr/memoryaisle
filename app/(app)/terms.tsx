// Terms of Use Screen
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
import { COLORS, SPACING, FONT_SIZES } from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/themeStore';

const LAST_UPDATED = 'February 4, 2026';

export default function TermsScreen() {
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
        <Text style={styles.headerTitle}>Terms of Use</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => Linking.openURL('https://memoryaisle.app/terms')}
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

        <Section title="1. Acceptance of Terms">
          <Paragraph>
            Welcome to MemoryAisle! By accessing or using the MemoryAisle mobile application ({'"'}App{'"'}), you agree to be bound by these Terms of Use ({'"'}Terms{'"'}). MemoryAisle is owned and operated by SLTR Digital LLC ({'"'}we,{'"'} {'"'}us,{'"'} or {'"'}our{'"'}).
          </Paragraph>
          <Paragraph>
            If you do not agree to these Terms, please do not use the App. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting.
          </Paragraph>
        </Section>

        <Section title="2. Eligibility">
          <Paragraph>
            You must be at least 13 years old to create an account and use MemoryAisle. By using the App, you represent and warrant that you meet this age requirement.
          </Paragraph>
          <Paragraph>
            If you are under 18, you must have your parent or legal guardian{"'"}s permission to use the App.
          </Paragraph>
        </Section>

        <Section title="3. Account Registration">
          <Paragraph>
            To access certain features of the App, you must register for an account. You agree to provide accurate, current, and complete information during registration and to keep your account information up to date.
          </Paragraph>
          <Paragraph>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use of your account.
          </Paragraph>
        </Section>

        <Section title="4. Subscription Terms">
          <Paragraph>
            MemoryAisle Premium is available as a monthly auto-renewable subscription at $9.99/month (prices may vary by region).
          </Paragraph>
          <BulletList items={[
            'Payment will be charged to your Apple ID account at confirmation of purchase.',
            'Subscription automatically renews unless canceled at least 24 hours before the end of the current period.',
            'Your account will be charged for renewal within 24 hours prior to the end of the current period.',
            'You can manage and cancel your subscription in your Apple ID account settings.',
            'No refunds will be provided for the unused portion of a subscription period.',
          ]} />
        </Section>

        <Section title="5. Mira AI Assistant">
          <Paragraph>
            Mira is an AI-powered assistant integrated into MemoryAisle. By using Mira, you acknowledge and agree to the following:
          </Paragraph>
          <BulletList items={[
            'Mira provides grocery suggestions, meal plans, and recipe recommendations for convenience only.',
            'Mira is NOT a medical or nutritional professional. Mira\'s suggestions should not replace professional dietary, medical, or nutritional advice.',
            'You should consult qualified healthcare providers for dietary and medical advice, especially regarding allergies, intolerances, or medical conditions.',
            'Mira learns your family preferences within the app to improve suggestions, but this data stays within your account.',
            'You can clear Mira\'s conversation history at any time through the app settings.',
            'Mira does not access external accounts, contacts, or data beyond what you provide in the app.',
          ]} />
          <Paragraph>
            For Mira-specific questions, contact: mira@memoryaisle.app
          </Paragraph>
        </Section>

        <Section title="6. User Content">
          <Paragraph>
            You retain ownership of all content you create in the App, including grocery lists, recipes, meal plans, and family profiles ({'"'}User Content{'"'}).
          </Paragraph>
          <Paragraph>
            By using the App, you grant us a limited, non-exclusive license to use, store, and process your User Content solely for the purpose of providing and improving the App{"'"}s services.
          </Paragraph>
        </Section>

        <Section title="7. Prohibited Conduct">
          <Paragraph>
            You agree not to:
          </Paragraph>
          <BulletList items={[
            'Use the App for any unlawful purpose or in violation of any applicable laws.',
            'Attempt to gain unauthorized access to the App or its related systems.',
            'Interfere with or disrupt the App or servers connected to the App.',
            'Upload or transmit viruses, malware, or other malicious code.',
            'Use the App to harass, abuse, or harm others.',
            'Share your account credentials with others.',
          ]} />
        </Section>

        <Section title="8. Account Suspension and Termination">
          <Paragraph>
            We reserve the right to suspend or terminate your account at any time if we believe you have violated these Terms. Upon termination, your right to use the App will immediately cease.
          </Paragraph>
          <Paragraph>
            You may delete your account at any time through the App settings. Account deletion will permanently remove all your data.
          </Paragraph>
        </Section>

        <Section title="9. Intellectual Property">
          <Paragraph>
            The App and its original content, features, and functionality are owned by SLTR Digital LLC and are protected by international copyright, trademark, and other intellectual property laws.
          </Paragraph>
        </Section>

        <Section title="10. Disclaimer of Warranties">
          <Paragraph>
            THE APP IS PROVIDED {'"'}AS IS{'"'} AND {'"'}AS AVAILABLE{'"'} WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </Paragraph>
          <Paragraph>
            We do not warrant that the App will be uninterrupted, secure, or error-free.
          </Paragraph>
        </Section>

        <Section title="11. Limitation of Liability">
          <Paragraph>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SLTR DIGITAL LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
          </Paragraph>
          <Paragraph>
            Our total liability for any claims arising from or relating to these Terms or the App shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
          </Paragraph>
        </Section>

        <Section title="12. Indemnification">
          <Paragraph>
            You agree to indemnify and hold harmless SLTR Digital LLC and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the App or violation of these Terms.
          </Paragraph>
        </Section>

        <Section title="13. Governing Law">
          <Paragraph>
            These Terms shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.
          </Paragraph>
        </Section>

        <Section title="14. Changes to Terms">
          <Paragraph>
            We may update these Terms from time to time. We will notify you of any material changes by posting the new Terms in the App. Your continued use of the App after such changes constitutes acceptance of the updated Terms.
          </Paragraph>
        </Section>

        <Section title="15. Contact Us">
          <Paragraph>
            If you have any questions about these Terms, please contact us:
          </Paragraph>
          <BulletList items={[
            'Email: legal@memoryaisle.app',
            'Support: support@memoryaisle.app',
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
  paragraph: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
    marginBottom: SPACING.md,
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
