import { isRunningInExpoGo } from 'expo';

import { flushQueue } from './offlineQueue';

export const BACKGROUND_SYNC_TASK = 'autoscope-background-sync';

/**
 * The actual unit of work run by the OS when it wakes the app in the background.
 * Kept free of any expo-background-task import so it stays testable without that native module
 * (see registerBackgroundSync below for why that import must be deferred).
 */
export async function runBackgroundSync(): Promise<'success' | 'failed'> {
  try {
    await flushQueue();
    return 'success';
  } catch {
    return 'failed';
  }
}

/**
 * Registers the OS-level periodic sync (survives the app being closed/backgrounded).
 *
 * expo-background-task's native module does not exist in Expo Go: merely importing the package
 * throws synchronously during module evaluation (confirmed by a live crash on device — it is not
 * limited to calling its functions, as the package's own docs imply). So the import is deferred
 * here and skipped entirely in Expo Go, instead of sitting at the top of this file where it would
 * crash the whole app on launch. Needs a dev client / standalone build to actually run.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (isRunningInExpoGo()) return false;

  try {
    const TaskManager = await import('expo-task-manager');
    const BackgroundTask = await import('expo-background-task');

    if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
      TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        const result = await runBackgroundSync();
        return result === 'success' ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
      });
    }

    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15, // minutes; the OS decides the actual cadence from here
    });
    return true;
  } catch (err) {
    console.warn(`Synchronisation en arrière-plan indisponible : ${(err as Error).message}`);
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  if (isRunningInExpoGo()) return;

  try {
    const BackgroundTask = await import('expo-background-task');
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch {
    // not registered — nothing to do
  }
}
