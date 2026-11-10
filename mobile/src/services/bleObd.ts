import { BleManager, Device } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

import { OBDConnector } from './obd';
import { OBDSnapshot } from '../types';
import { CMD_READ_DTC, CMD_VOLTAGE, INIT_COMMANDS, PID_COOLANT_TEMP, PID_RPM, parseCoolantTemp, parseDtcCodes, parseRpm, parseVoltage } from './elm327';

/**
 * Nordic UART Service UUIDs — used by most cheap ELM327 BLE clones (HM-10/HC-08-based boards).
 * Adjust these three constants to match the specific dongle you buy; check its datasheet or
 * scan it once with a generic BLE inspector app (e.g. nRF Connect) to confirm the UUIDs.
 */
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write (phone -> dongle)
const UART_RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify (dongle -> phone)

const COMMAND_TIMEOUT_MS = 3000;
const RESPONSE_TERMINATOR = '>';

/**
 * Real ELM327-over-BLE connector. NOT usable inside Expo Go — react-native-ble-plx is a native
 * module that requires `npx expo prebuild` and a custom dev client (or a production build), plus
 * actual OBD-II hardware to validate against. Written and protocol-tested (see elm327.test.ts)
 * but unverified end-to-end in this environment. See mobile/README.md before using it.
 */
export class BleOBDConnector implements OBDConnector {
  private manager = new BleManager();
  private device: Device | null = null;
  private responseBuffer = '';
  private pendingResolve: ((value: string) => void) | null = null;

  constructor(private readonly deviceNameFilter: (name: string | null) => boolean = (n) => !!n?.toUpperCase().includes('OBD')) {}

  async connect(): Promise<void> {
    const device = await this.scanForDevice();
    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    connected.monitorCharacteristicForService(
      UART_SERVICE_UUID,
      UART_RX_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const chunk = Buffer.from(characteristic.value, 'base64').toString('ascii');
        this.responseBuffer += chunk;
        if (this.responseBuffer.includes(RESPONSE_TERMINATOR) && this.pendingResolve) {
          const resolve = this.pendingResolve;
          const result = this.responseBuffer;
          this.pendingResolve = null;
          this.responseBuffer = '';
          resolve(result);
        }
      },
    );

    this.device = connected;

    for (const cmd of INIT_COMMANDS) {
      await this.sendCommand(cmd);
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.cancelConnection();
      this.device = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null;
  }

  async readSnapshot(): Promise<OBDSnapshot> {
    if (!this.device) throw new Error('OBD non connecté');

    const [rpmResponse, coolantResponse, voltageResponse, dtcResponse] = await Promise.all([
      this.sendCommand(PID_RPM),
      this.sendCommand(PID_COOLANT_TEMP),
      this.sendCommand(CMD_VOLTAGE),
      this.sendCommand(CMD_READ_DTC),
    ]);

    return {
      rpm: parseRpm(rpmResponse),
      coolant_temp: parseCoolantTemp(coolantResponse),
      battery_voltage: parseVoltage(voltageResponse),
      dtc: parseDtcCodes(dtcResponse),
    };
  }

  private async scanForDevice(): Promise<Device> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        reject(new Error('Aucun dongle OBD-II détecté (scan Bluetooth)'));
      }, 10000);

      this.manager.startDeviceScan([UART_SERVICE_UUID], null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (device && this.deviceNameFilter(device.name)) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  private sendCommand(command: string): Promise<string> {
    if (!this.device) throw new Error('OBD non connecté');

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      const timeout = setTimeout(() => {
        this.pendingResolve = null;
        reject(new Error(`Timeout en attente de réponse à la commande ${command}`));
      }, COMMAND_TIMEOUT_MS);

      const payload = Buffer.from(`${command}\r`, 'ascii').toString('base64');
      this.device!.writeCharacteristicWithResponseForService(UART_SERVICE_UUID, UART_TX_CHARACTERISTIC_UUID, payload)
        .then(() => {
          const originalResolve = this.pendingResolve;
          this.pendingResolve = (value) => {
            clearTimeout(timeout);
            originalResolve?.(value);
          };
        })
        .catch((err) => {
          clearTimeout(timeout);
          this.pendingResolve = null;
          reject(err);
        });
    });
  }
}
