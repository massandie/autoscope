import AsyncStorage from '@react-native-async-storage/async-storage';

import { enqueueReading, flushQueue, queueLength } from '../offlineQueue';
import { ReadingPayload } from '../../types';

/**
 * Test d'intégration réel : parle au backend FastAPI local (pas de mock HTTP).
 * Démarrer le backend avant d'exécuter : voir backend/README.md (port 8010 attendu,
 * cf. EXPO_PUBLIC_API_URL dans jest.setup.js). Les tests sont sautés si le backend
 * n'est pas joignable.
 */
async function backendIsUp(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const samplePayload = (vehicleId: string): ReadingPayload => ({
  vehicle_id: vehicleId,
  timestamp: new Date().toISOString(),
  location: { lat: 5.56, lon: -0.21, speed: 48 },
  driving_score: 40,
  events: ['freinage_brusque'],
  obd: { rpm: 1700, dtc: ['P0301'], coolant_temp: 98, battery_voltage: 11.2 },
});

describe('offlineQueue (intégration backend réel)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('met en file hors-ligne puis vide la file vers le backend au retour réseau', async () => {
    const up = await backendIsUp();
    if (!up) {
      console.warn('Backend non joignable sur ' + process.env.EXPO_PUBLIC_API_URL + ' — test sauté.');
      return;
    }

    const vehicleId = `TEST-${Date.now()}`;
    await enqueueReading(samplePayload(vehicleId));
    expect(await queueLength()).toBe(1);

    const results: any[] = [];
    const syncedCount = await flushQueue((result) => results.push(result));

    expect(syncedCount).toBe(1);
    expect(await queueLength()).toBe(0);
    expect(results).toHaveLength(1);
    expect(results[0].alerts.length).toBeGreaterThan(0);
    expect(results[0].alerts.some((a: any) => a.message.includes('P0301'))).toBe(true);
  });
});
