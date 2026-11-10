/**
 * ELM327 / SAE J1979 command building and response parsing — pure functions, no I/O.
 * Kept separate from the BLE transport (bleObd.ts) so this protocol logic can be unit-tested
 * without real hardware. Response formats follow the standard ELM327 datasheet.
 */

export const INIT_COMMANDS = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATSP0'];

export const PID_RPM = '010C';
export const PID_COOLANT_TEMP = '0105';
export const CMD_VOLTAGE = 'ATRV';
export const CMD_READ_DTC = '03';

function cleanHexResponse(raw: string): string {
  // Strips whitespace, the '>' prompt, "SEARCHING...", "NO DATA", echoes, etc. down to hex bytes.
  return raw
    .replace(/SEARCHING\.*/gi, '')
    .replace(/[\r\n>]/g, ' ')
    .trim()
    .toUpperCase();
}

function hexBytes(response: string): string[] {
  return cleanHexResponse(response)
    .split(/\s+/)
    .filter((tok) => /^[0-9A-F]{2}$/.test(tok));
}

/** "41 0C 1A F8" -> RPM = ((A*256)+B)/4 */
export function parseRpm(response: string): number | null {
  const bytes = hexBytes(response);
  const idx = bytes.indexOf('0C');
  if (idx === -1 || idx + 2 >= bytes.length) return null;
  const a = parseInt(bytes[idx + 1], 16);
  const b = parseInt(bytes[idx + 2], 16);
  return (a * 256 + b) / 4;
}

/** "41 05 5A" -> coolant temp (°C) = A - 40 */
export function parseCoolantTemp(response: string): number | null {
  const bytes = hexBytes(response);
  const idx = bytes.indexOf('05');
  if (idx === -1 || idx + 1 >= bytes.length) return null;
  return parseInt(bytes[idx + 1], 16) - 40;
}

/** ATRV replies with plain text like "12.6V" */
export function parseVoltage(response: string): number | null {
  const match = cleanHexResponse(response).match(/(\d+(?:\.\d+)?)\s*V/i);
  return match ? parseFloat(match[1]) : null;
}

const DTC_PREFIX = ['P', 'C', 'B', 'U'] as const;

function decodeDtcPair(a: number, b: number): string | null {
  if (a === 0 && b === 0) return null;
  const prefix = DTC_PREFIX[(a >> 6) & 0b11];
  const firstDigit = (a >> 4) & 0b11;
  const secondDigit = a & 0b1111;
  const rest = b.toString(16).padStart(2, '0').toUpperCase();
  return `${prefix}${firstDigit}${secondDigit.toString(16).toUpperCase()}${rest}`;
}

/** Mode 03 response ("43 01 33 00 00 ...") -> list of DTC codes, e.g. ["P0133"] */
export function parseDtcCodes(response: string): string[] {
  const bytes = hexBytes(response);
  if (bytes[0] === '43') bytes.shift(); // drop the mode-echo header only, not DTC bytes that happen to equal it
  const codes: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = decodeDtcPair(parseInt(bytes[i], 16), parseInt(bytes[i + 1], 16));
    if (code) codes.push(code);
  }
  return codes;
}
