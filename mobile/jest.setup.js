jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Points src/services/api.ts at the local backend used by the integration test
// in src/services/__tests__/offlineQueue.test.ts (start it with `uvicorn app.main:app --port 8010`).
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8010';
