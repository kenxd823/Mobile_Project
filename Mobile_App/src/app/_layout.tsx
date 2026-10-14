import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '@/hooks/use-auth';

export default function RootLayout() {
  return <AuthProvider><AppNavigation /></AuthProvider>;
}

function AppNavigation() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return (
    <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!session}>
      <Stack.Screen name="select-role" />
      <Stack.Screen name="elderly-home" />
      <Stack.Screen name="caregiver-home" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="elderly-profile" />
      <Stack.Screen name="caregiver-profile" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="food-log" />
      <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="auth/verify-otp" />
      </Stack.Protected>
    </Stack></>
  );
}
