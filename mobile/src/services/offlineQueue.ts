import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { IngestResult, ReadingPayload } from '../types';
import { sendReading } from './api';

const QUEUE_KEY = 'autoscope.offline_queue.v1';

async function readQueue(): Promise<ReadingPayload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: ReadingPayload[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Fonctionne hors ligne avec synchronisation en arrière-plan (spec §1). */
export async function enqueueReading(payload: ReadingPayload): Promise<void> {
  const queue = await readQueue();
  queue.push(payload);
  await writeQueue(queue);
}

export async function flushQueue(onResult?: (result: IngestResult) => void): Promise<number> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return 0;

  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: ReadingPayload[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    try {
      const result = await sendReading(item);
      syncedCount += 1;
      onResult?.(result);
    } catch {
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return syncedCount;
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}
