import { OBDSnapshot } from '../types';

export interface OBDConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  readSnapshot(): Promise<OBDSnapshot>;
}

/**
 * Simulates an ELM327 OBD-II dongle over Bluetooth.
 * Swap for a real connector (e.g. react-native-ble-plx talking PID requests to
 * an ELM327 dongle) once running in a dev client / bare build — Expo Go cannot
 * load that native BLE module.
 */
export class MockOBDConnector implements OBDConnector {
  private connected = false;
  private tickCount = 0;

  async connect(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async readSnapshot(): Promise<OBDSnapshot> {
    if (!this.connected) {
      throw new Error('OBD non connecté');
    }
    this.tickCount += 1;

    const rpm = 800 + Math.random() * 1200;
    const coolant_temp = 85 + Math.random() * 15;
    const battery_voltage = 11.5 + Math.random() * 1.3;
    const dtc = this.tickCount % 12 === 0 ? ['P0301'] : [];

    return { rpm, dtc, coolant_temp, battery_voltage };
  }
}
