export const colors = {
  background: '#f1f5f9',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  border: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',
  success: '#16a34a',
  successBg: '#dcfce7',
  warning: '#d97706',
  warningBg: '#fef3c7',
  critical: '#dc2626',
  criticalBg: '#fee2e2',
  info: '#2563eb',
  infoBg: '#dbeafe',
};

export const severityTheme: Record<'info' | 'warning' | 'critical', { fg: string; bg: string; icon: string }> = {
  info: { fg: colors.info, bg: colors.infoBg, icon: 'information' },
  warning: { fg: colors.warning, bg: colors.warningBg, icon: 'alert' },
  critical: { fg: colors.critical, bg: colors.criticalBg, icon: 'alert-octagon' },
};

export const categoryIcon: Record<string, string> = {
  diagnostic: 'engine',
  behavioral: 'steering',
  predictive: 'chart-line',
  maintenance: 'wrench',
};

export function scoreColor(score: number): string {
  if (score >= 75) return colors.success;
  if (score >= 50) return colors.warning;
  return colors.critical;
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
