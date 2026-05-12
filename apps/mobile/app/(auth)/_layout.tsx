import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function AuthLayout() {
  const token = useAuthStore((s) => s.accessToken);

  // If already authenticated, push straight to the app.
  if (token) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
        animation: 'fade',
      }}
    />
  );
}
