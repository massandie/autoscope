import { gridKey, parseMaxSpeedKmh, SpeedLimitResolver } from '../speedLimit';

describe('parseMaxSpeedKmh', () => {
  it('parses a plain number as km/h', () => {
    expect(parseMaxSpeedKmh('50')).toBe(50);
  });

  it('parses an explicit km/h unit', () => {
    expect(parseMaxSpeedKmh('90 km/h')).toBe(90);
    expect(parseMaxSpeedKmh('90kmh')).toBe(90);
  });

  it('converts mph to km/h', () => {
    expect(parseMaxSpeedKmh('30 mph')).toBe(48); // 30 * 1.60934 ≈ 48.28 → rounded
  });

  it('returns null for non-numeric OSM values', () => {
    expect(parseMaxSpeedKmh('signals')).toBeNull();
    expect(parseMaxSpeedKmh('none')).toBeNull();
    expect(parseMaxSpeedKmh('walk')).toBeNull();
  });

  it('returns null for empty/missing input', () => {
    expect(parseMaxSpeedKmh('')).toBeNull();
    expect(parseMaxSpeedKmh(undefined)).toBeNull();
    expect(parseMaxSpeedKmh(null)).toBeNull();
  });
});

describe('gridKey', () => {
  it('groups nearby coordinates into the same cell', () => {
    expect(gridKey(5.5601, -0.2101)).toBe(gridKey(5.56009, -0.21011));
  });

  it('separates distant coordinates into different cells', () => {
    expect(gridKey(5.56, -0.21)).not.toBe(gridKey(5.6, -0.25));
  });
});

describe('SpeedLimitResolver', () => {
  const samplePosition = { lat: 5.56, lon: -0.21 };

  beforeEach(() => {
    (globalThis as any).fetch = jest.fn();
  });

  it('returns the parsed limit from the Overpass response', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [{ tags: { maxspeed: '60' } }] }),
    });

    const resolver = new SpeedLimitResolver();
    const limit = await resolver.getSpeedLimit(samplePosition.lat, samplePosition.lon, 50);

    expect(limit).toBe(60);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('caches the result and does not refetch for a nearby position', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [{ tags: { maxspeed: '70' } }] }),
    });

    const resolver = new SpeedLimitResolver();
    await resolver.getSpeedLimit(samplePosition.lat, samplePosition.lon, 50);
    const second = await resolver.getSpeedLimit(samplePosition.lat + 0.00001, samplePosition.lon, 50);

    expect(second).toBe(70);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default limit when the request fails', async () => {
    (globalThis as any).fetch.mockRejectedValue(new Error('network down'));

    const resolver = new SpeedLimitResolver();
    const limit = await resolver.getSpeedLimit(samplePosition.lat, samplePosition.lon, 50);

    expect(limit).toBe(50);
  });

  it('falls back to the default limit when no road data is found', async () => {
    (globalThis as any).fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [] }),
    });

    const resolver = new SpeedLimitResolver();
    const limit = await resolver.getSpeedLimit(samplePosition.lat, samplePosition.lon, 50);

    expect(limit).toBe(50);
  });
});
