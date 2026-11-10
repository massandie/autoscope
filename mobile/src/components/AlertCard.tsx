import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { AlertDTO } from '../types';
import { categoryIcon, colors, radius, severityTheme, spacing } from '../theme';

const categoryLabel: Record<string, string> = {
  diagnostic: 'Diagnostic',
  behavioral: 'Comportement',
  predictive: 'Prédictif',
  maintenance: 'Entretien',
};

export default function AlertCard({ alert }: { alert: AlertDTO }) {
  const severity = severityTheme[alert.severity];

  return (
    <View style={styles.card}>
      <View style={[styles.iconBadge, { backgroundColor: severity.bg }]}>
        <MaterialCommunityIcons name={severity.icon as any} size={20} color={severity.fg} />
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.categoryPill}>
            <MaterialCommunityIcons
              name={(categoryIcon[alert.category] ?? 'information') as any}
              size={12}
              color={colors.textSecondary}
            />
            <Text style={styles.categoryText}>{categoryLabel[alert.category] ?? alert.category}</Text>
          </View>
        </View>

        <Text style={styles.message}>{alert.message}</Text>

        {alert.recommended_action && (
          <View style={styles.actionRow}>
            <MaterialCommunityIcons name="arrow-right-circle" size={14} color={colors.textMuted} />
            <Text style={styles.action}>{alert.recommended_action}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: { flex: 1 },
  headerRow: { flexDirection: 'row', marginBottom: 4 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    gap: 4,
  },
  categoryText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  message: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', lineHeight: 19 },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  action: { fontSize: 12.5, color: colors.textMuted, flexShrink: 1 },
});
