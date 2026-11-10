import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';

import { SpeedLimitResolver } from './speedLimit';

const HARSH_BRAKE_THRESHOLD_G = 0.5; // ~ -5 m/s^2
const SHARP_TURN_THRESHOLD_RAD_S = 2.0;
const SPEEDING_MARGIN_KMH = 10;
const DEFAULT_SPEED_LIMIT_KMH = 50;
const FATIGUE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // spec: "risque de fatigue (temps de conduite prolongée)"
const FATIGUE_REPEAT_INTERVAL_MS = 30 * 60 * 1000; // re-warn every 30min of continued driving, not every tick

export interface DrivingSample {
  events: string[];
  speedKmh: number | null;
  lat: number | null;
  lon: number | null;
}

export class DrivingMonitor {
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;
  private locationSub: Location.LocationSubscription | null = null;
  private pendingEvents: Set<string> = new Set();
  private lastLocation: Location.LocationObject | null = null;
  private startedAt: number | null = null;
  private lastFatigueAlertAt: number | null = null;

  constructor(
    private readonly clock: () => number = Date.now,
    private readonly speedLimitResolver: SpeedLimitResolver = new SpeedLimitResolver(),
  ) {}

  async start(fallbackSpeedLimitKmh = DEFAULT_SPEED_LIMIT_KMH): Promise<void> {
    await Location.requestForegroundPermissionsAsync();

    this.startedAt = this.clock();
    this.lastFatigueAlertAt = null;

    Accelerometer.setUpdateInterval(200);
    Gyroscope.setUpdateInterval(200);

    this.accelSub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > 1 + HARSH_BRAKE_THRESHOLD_G) {
        this.pendingEvents.add('freinage_brusque');
      }
    });

    this.gyroSub = Gyroscope.addListener(({ z }) => {
      if (Math.abs(z) > SHARP_TURN_THRESHOLD_RAD_S) {
        this.pendingEvents.add(z > 0 ? 'virage_gauche' : 'virage_droite');
      }
    });

    this.locationSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2000 },
      (loc) => {
        this.handleLocationUpdate(loc, fallbackSpeedLimitKmh);
      },
    );
  }

  private async handleLocationUpdate(loc: Location.LocationObject, fallbackSpeedLimitKmh: number): Promise<void> {
    this.lastLocation = loc;
    const speedKmh = (loc.coords.speed ?? 0) * 3.6;

    const speedLimitKmh = await this.speedLimitResolver.getSpeedLimit(
      loc.coords.latitude,
      loc.coords.longitude,
      fallbackSpeedLimitKmh,
    );
    if (speedKmh > speedLimitKmh + SPEEDING_MARGIN_KMH) {
      this.pendingEvents.add('exces_de_vitesse');
    }
  }

  stop(): void {
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.locationSub?.remove();
    this.accelSub = null;
    this.gyroSub = null;
    this.locationSub = null;
    this.startedAt = null;
    this.lastFatigueAlertAt = null;
  }

  /** Consomme les événements accumulés depuis le dernier appel et calcule un score. */
  collectSample(): DrivingSample {
    this.checkFatigue();

    const events = Array.from(this.pendingEvents);
    this.pendingEvents.clear();

    const speedKmh = this.lastLocation ? (this.lastLocation.coords.speed ?? 0) * 3.6 : null;

    return {
      events,
      speedKmh,
      lat: this.lastLocation?.coords.latitude ?? null,
      lon: this.lastLocation?.coords.longitude ?? null,
    };
  }

  private checkFatigue(): void {
    if (this.startedAt === null) return;

    const elapsed = this.clock() - this.startedAt;
    if (elapsed < FATIGUE_THRESHOLD_MS) return;

    const sinceLastAlert = this.lastFatigueAlertAt === null ? Infinity : this.clock() - this.lastFatigueAlertAt;
    if (sinceLastAlert < FATIGUE_REPEAT_INTERVAL_MS) return;

    this.pendingEvents.add('risque_fatigue');
    this.lastFatigueAlertAt = this.clock();
  }
}

export function computeDrivingScore(recentEvents: string[]): number {
  const penalties: Record<string, number> = {
    freinage_brusque: 8,
    virage_gauche: 4,
    virage_droite: 4,
    exces_de_vitesse: 10,
    risque_fatigue: 15,
  };
  const penalty = recentEvents.reduce((sum, e) => sum + (penalties[e] ?? 0), 0);
  return Math.max(0, 100 - penalty);
}
