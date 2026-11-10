import { computeDrivingScore, DrivingMonitor } from '../driving';

describe('DrivingMonitor — détection de fatigue', () => {
  function monitorStartedAt(clock: () => number, startedAt: number): DrivingMonitor {
    const monitor = new DrivingMonitor(clock);
    (monitor as any).startedAt = startedAt;
    return monitor;
  }

  it("n'alerte pas avant le seuil de 2h de conduite continue", () => {
    let now = 60 * 60 * 1000; // 1h écoulée
    const monitor = monitorStartedAt(() => now, 0);
    expect(monitor.collectSample().events).not.toContain('risque_fatigue');
  });

  it('alerte une fois le seuil de 2h franchi', () => {
    const now = 2 * 60 * 60 * 1000 + 1;
    const monitor = monitorStartedAt(() => now, 0);
    expect(monitor.collectSample().events).toContain('risque_fatigue');
  });

  it("ne répète pas l'alerte avant la fin de la fenêtre de 30min", () => {
    let now = 2 * 60 * 60 * 1000 + 1;
    const monitor = monitorStartedAt(() => now, 0);
    expect(monitor.collectSample().events).toContain('risque_fatigue');

    now += 10 * 60 * 1000; // +10min : toujours dans la fenêtre
    expect(monitor.collectSample().events).not.toContain('risque_fatigue');

    now += 25 * 60 * 1000; // dépasse la fenêtre de 30min
    expect(monitor.collectSample().events).toContain('risque_fatigue');
  });

  it("n'alerte jamais si aucune session n'a démarré", () => {
    const monitor = new DrivingMonitor(() => 999 * 60 * 60 * 1000);
    expect(monitor.collectSample().events).not.toContain('risque_fatigue');
  });
});

describe('computeDrivingScore', () => {
  it('retourne 100 sans événement', () => {
    expect(computeDrivingScore([])).toBe(100);
  });

  it('pénalise un freinage brusque', () => {
    expect(computeDrivingScore(['freinage_brusque'])).toBe(92);
  });

  it('cumule les pénalités de plusieurs événements', () => {
    expect(computeDrivingScore(['freinage_brusque', 'virage_gauche', 'exces_de_vitesse'])).toBe(78);
  });

  it('ne descend jamais sous 0', () => {
    const manyEvents = Array(20).fill('exces_de_vitesse');
    expect(computeDrivingScore(manyEvents)).toBe(0);
  });
});
