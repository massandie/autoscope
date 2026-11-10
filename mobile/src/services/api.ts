import { IngestResult, ReadingPayload } from '../types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function sendReading(payload: ReadingPayload): Promise<IngestResult> {
  const response = await fetch(`${API_BASE_URL}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Échec de l'envoi (${response.status})`);
  }
  return response.json();
}
