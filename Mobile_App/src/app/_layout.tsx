import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="select-role" />
      <Stack.Screen name="elderly-home" />
      <Stack.Screen name="caregiver-home" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="auth/verify-otp" />
    </Stack>
  );
}