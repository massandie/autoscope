import { MockOBDConnector } from '../obd';

describe('MockOBDConnector', () => {
  it('refuse une lecture avant connexion', async () => {
    const obd = new MockOBDConnector();
    await expect(obd.readSnapshot()).rejects.toThrow('OBD non connecté');
  });

  it('se connecte puis renvoie un relevé plausible', async () => {
    const obd = new MockOBDConnector();
    await obd.connect();
    expect(obd.isConnected()).toBe(true);

    const snapshot = await obd.readSnapshot();
    expect(snapshot.rpm).toBeGreaterThanOrEqual(800);
    expect(snapshot.rpm).toBeLessThanOrEqual(2000);
    expect(snapshot.coolant_temp).toBeGreaterThanOrEqual(85);
    expect(snapshot.battery_voltage).toBeGreaterThanOrEqual(11.5);
    expect(Array.isArray(snapshot.dtc)).toBe(true);
  });

  it('se déconnecte correctement', async () => {
    const obd = new MockOBDConnector();
    await obd.connect();
    await obd.disconnect();
    expect(obd.isConnected()).toBe(false);
    await expect(obd.readSnapshot()).rejects.toThrow();
  });
});
