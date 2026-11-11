import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { AlertDTO, ReadingPayload } from '../types';
import { MockOBDConnector, OBDConnector } from '../services/obd';
import { computeDrivingScore, DrivingMonitor } from '../services/driving';
import { enqueueReading, flushQueue, queueLength } from '../services/offlineQueue';
import { API_BASE_URL } from '../services/api';
import AlertCard from '../components/AlertCard';
import { colors, radius, scoreColor, spacing } from '../theme';

const VEHICLE_ID = 'DEMO-VEHICLE-001';
const TICK_INTERVAL_MS = 5000;

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const obdRef = useRef<OBDConnector>(new MockOBDConnector());
  const monitorRef = useRef(new DrivingMonitor());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      monitorRef.current.stop();
    };
  }, []);

  async function handleConnect() {
    setConnectionState('connecting');
    setStatusMessage(null);
    try {
      await obdRef.current.connect();
      await monitorRef.current.start();
    } catch (err) {
      setConnectionState('disconnected');
      setStatusMessage(`Échec de connexion : ${(err as Error).message}`);
      return;
    }
    setConnectionState('connected');

    tickRef.current = setInterval(async () => {
      try {
        const obd = await obdRef.current.readSnapshot();
        const sample = monitorRef.current.collectSample();
        const drivingScore = computeDrivingScore(sample.events);
        setScore(drivingScore);

        const payload: ReadingPayload = {
          vehicle_id: VEHICLE_ID,
          timestamp: new Date().toISOString(),
          location: { lat: sample.lat, lon: sample.lon, speed: sample.speedKmh },
          driving_score: drivingScore,
          events: sample.events,
          obd,
        };

        await enqueueReading(payload);
        const syncedCount = await flushQueue((result) => {
          if (result.alerts.length > 0) {
            setAlerts((prev) => [...result.alerts, ...prev].slice(0, 50));
          }
        });
        if (syncedCount > 0) setStatusMessage(`${syncedCount} trajet(s) synchronisé(s)`);
        setPendingSync(await queueLength());
      } catch (err) {
        setStatusMessage(`Erreur capteurs : ${(err as Error).message}`);
      }
    }, TICK_INTERVAL_MS);
  }

  function handleOpenMechanicPortal() {
    Linking.openURL(`${API_BASE_URL}/portal/mechanic/`).catch(() =>
      setStatusMessage("Impossible d'ouvrir le portail mécanicien"),
    );
  }

  async function handleDisconnect() {
    if (tickRef.current) clearInterval(tickRef.current);
    monitorRef.current.stop();
    await obdRef.current.disconnect();
    setConnectionState('disconnected');
    setStatusMessage(null);
  }

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <MaterialCommunityIcons name="car-connected" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.brand}>Autoscope</Text>
              <Text style={styles.vehicleId}>{VEHICLE_ID}</Text>
            </View>
          </View>

          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? '#4ade80' : isConnecting ? '#fbbf24' : '#94a3b8' },
              ]}
            />
            <Text style={styles.statusPillText}>
              {isConnected ? 'Connecté' : isConnecting ? 'Connexion…' : 'Déconnecté'}
            </Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: score !== null ? scoreColor(score) : colors.textMuted }]}>
              {score ?? '—'}
            </Text>
            <Text style={styles.scoreUnit}>/100</Text>
          </View>
          <View style={styles.scoreCaption}>
            <Text style={styles.scoreLabel}>Score de conduite</Text>
            <Text style={styles.scoreHint}>
              {score === null
                ? 'En attente de données…'
                : score >= 75
                ? 'Conduite prudente'
                : score >= 50
                ? 'Quelques écarts détectés'
                : 'Conduite à risque'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.content, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.connectButton, isConnected ? styles.connectButtonDanger : styles.connectButtonPrimary]}
          onPress={isConnected ? handleDisconnect : handleConnect}
          disabled={isConnecting}
        >
          <MaterialCommunityIcons
            name={isConnected ? 'bluetooth-off' : 'bluetooth-connect'}
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.connectButtonText}>
            {isConnected ? 'Déconnecter le dongle' : isConnecting ? 'Connexion en cours…' : 'Connecter le dongle OBD-II'}
          </Text>
        </TouchableOpacity>

        {statusMessage && (
          <View style={styles.toast}>
            <MaterialCommunityIcons name="sync" size={14} color={colors.textSecondary} />
            <Text style={styles.toastText}>{statusMessage}</Text>
          </View>
        )}

        {pendingSync > 0 && (
          <View style={styles.pendingBanner}>
            <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={colors.warning} />
            <Text style={styles.pendingText}>{pendingSync} trajet(s) en attente de synchronisation</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Alertes</Text>
          {alerts.length > 0 && (
            <View style={[styles.countBadge, criticalCount > 0 && styles.countBadgeCritical]}>
              <Text style={styles.countBadgeText}>{alerts.length}</Text>
            </View>
          )}
        </View>

        <FlatList
          style={styles.alertsList}
          data={alerts}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={alerts.length === 0 ? styles.emptyContainer : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="shield-check-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucune alerte pour le moment</Text>
              <Text style={styles.emptySubtext}>Connectez le dongle pour commencer la surveillance</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity activeOpacity={0.7} style={styles.portalLink} onPress={handleOpenMechanicPortal}>
          <MaterialCommunityIcons name="wrench-outline" size={15} color={colors.textMuted} />
          <Text style={styles.portalLinkText}>Portail mécanicien</Text>
          <MaterialCommunityIcons name="open-in-new" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  vehicleId: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, gap: spacing.lg },
  scoreCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  scoreValue: { fontSize: 28, fontWeight: '800' },
  scoreUnit: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
  scoreCaption: { flex: 1 },
  scoreLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scoreHint: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 2 },

  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },

  connectButton: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  connectButtonPrimary: { backgroundColor: colors.primary },
  connectButtonDanger: { backgroundColor: colors.critical },
  connectButtonText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },

  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  toastText: { color: colors.textSecondary, fontSize: 12.5 },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  pendingText: { color: colors.warning, fontSize: 12.5, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeCritical: { backgroundColor: colors.criticalBg },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  alertsList: { flex: 1 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: 4 },
  emptyText: { color: colors.textSecondary, fontSize: 14.5, fontWeight: '600', marginTop: spacing.sm },
  emptySubtext: { color: colors.textMuted, fontSize: 12.5 },

  portalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  portalLinkText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
});
