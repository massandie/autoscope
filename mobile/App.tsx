import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DashboardScreen from './src/screens/DashboardScreen';
import { registerBackgroundSync } from './src/services/backgroundSync';

export default function App() {
  useEffect(() => {
    registerBackgroundSync();
  }, []);

  return (
    <SafeAreaProvider>
      <DashboardScreen />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
