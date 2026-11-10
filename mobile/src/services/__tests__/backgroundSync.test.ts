import AsyncStorage from '@react-native-async-storage/async-storage';

import { enqueueReading } from '../offlineQueue';
import { runBackgroundSync } from '../backgroundSync';
import { ReadingPayload } from '../../types';

const samplePayload: ReadingPayload = {
  vehicle_id: 'TEST-BG',
  timestamp: new Date().toISOString(),
  location: { lat: 5.56, lon: -0.21, speed: 48 },
  driving_score: 60,
  events: [],
  obd: { rpm: 1500, dtc: [], coolant_temp: 90, battery_voltage: 12.5 },
};

describe('runBackgroundSync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('retourne Success et vide la file quand le backend répond', async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ reading: {}, alerts: [], predicted_issue: null }) }),
    );
    await enqueueReading(samplePayload);

    const result = await runBackgroundSync();

    expect(result).toBe('success');
    expect((globalThis as any).fetch).toHaveBeenCalled();
  });

  it('retourne success même file vide (rien à faire)', async () => {
    (globalThis as any).fetch = jest.fn();
    const result = await runBackgroundSync();
    expect(result).toBe('success');
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });
});
