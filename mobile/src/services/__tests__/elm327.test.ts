import { parseCoolantTemp, parseDtcCodes, parseRpm, parseVoltage } from '../elm327';

describe('elm327 response parsing', () => {
  it('parse le RPM depuis une réponse mode 01 PID 0C', () => {
    // (0x1A*256 + 0xF8) / 4 = 1726
    expect(parseRpm('41 0C 1A F8\r\n>')).toBe(1726);
  });

  it('retourne null si la réponse ne concerne pas le PID RPM', () => {
    expect(parseRpm('NO DATA\r\n>')).toBeNull();
  });

  it('parse la température du liquide de refroidissement', () => {
    // 0x5A - 40 = 50
    expect(parseCoolantTemp('41 05 5A\r\n>')).toBe(50);
  });

  it('parse la tension batterie (ATRV)', () => {
    expect(parseVoltage('12.6V\r\n>')).toBeCloseTo(12.6);
  });

  it('décode un code DTC connu (P0301) depuis une réponse mode 03', () => {
    expect(parseDtcCodes('43 03 01 00 00 00 00\r\n>')).toEqual(['P0301']);
  });

  it('ignore les paires 00 00 (padding, pas de code)', () => {
    expect(parseDtcCodes('43 00 00 00 00\r\n>')).toEqual([]);
  });

  it('décode plusieurs codes dans une seule réponse', () => {
    // P0301 (03 01) puis C0123 (41 23 : prefix C=01, 2e caractère=00, 3e caractère=0001)
    expect(parseDtcCodes('43 03 01 41 23\r\n>')).toEqual(['P0301', 'C0123']);
  });

  it("ne confond pas un octet de code valant 0x43 avec l'en-tête de réponse", () => {
    // C0323 (43 23) juste après un premier code : le 0x43 ici fait partie du code, pas de l'en-tête
    expect(parseDtcCodes('43 03 01 43 23\r\n>')).toEqual(['P0301', 'C0323']);
  });
});
