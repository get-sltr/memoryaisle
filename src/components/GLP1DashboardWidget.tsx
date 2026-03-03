// GLP-1 Dashboard Widget — compact glass card for home screen
// Only renders when GLP-1 is active

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useGLP1Store } from '../stores/glp1Store';
import { MEDICATIONS } from '../services/glp1Engine';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../constants/theme';

interface GLP1DashboardWidgetProps {
  onCheckin: () => void;
  onLogInjection: () => void;
}

export function GLP1DashboardWidget({ onCheckin, onLogInjection }: GLP1DashboardWidgetProps) {
  const { isActive, profile, cycleInfo, todaysLog } = useGLP1Store();

  if (!isActive || !profile || !cycleInfo) return null;

  const medInfo = MEDICATIONS[profile.medication];

  return (
    <View style={styles.container}>
      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.border} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.phaseIndicator, { backgroundColor: cycleInfo.color + '20' }]}>
            <Text style={styles.phaseEmoji}>{cycleInfo.emoji}</Text>
          </View>
          <View>
            <Text style={styles.phaseLabel}>{cycleInfo.label}</Text>
            <Text style={styles.cycleDay}>
              Day {cycleInfo.dayInCycle + 1} of {cycleInfo.totalCycleDays} — {medInfo.brand}
            </Text>
          </View>
        </View>
      </View>

      {/* Guidance */}
      <Text style={styles.guidance}>{cycleInfo.guidance}</Text>

      {/* Portion Scale Bar */}
      <View style={styles.portionRow}>
        <Text style={styles.portionLabel}>Portions</Text>
        <View style={styles.portionBarBg}>
          <View
            style={[
              styles.portionBarFill,
              {
                width: `${cycleInfo.portionScale * 100}%`,
                backgroundColor: cycleInfo.color,
              },
            ]}
          />
        </View>
        <Text style={styles.portionValue}>{Math.round(cycleInfo.portionScale * 100)}%</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onCheckin}>
          <LinearGradient
            colors={[cycleInfo.color + '30', cycleInfo.color + '15']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.actionText}>
            {todaysLog ? '\u2713 Checked In' : 'Check In'}
          </Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onLogInjection}>
          <LinearGradient
            colors={['rgba(212, 165, 71, 0.15)', 'rgba(212, 165, 71, 0.08)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.actionText}>Log Injection</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOWS.glass,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  phaseIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseEmoji: {
    fontSize: 20,
  },
  phaseLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  cycleDay: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 1,
  },
  guidance: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  portionLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    width: 52,
  },
  portionBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  portionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  portionValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    width: 36,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  actionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
});
