import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

/**
 * Root index — redirect to tabs if authenticated, otherwise to the login screen.
 */
export default function Index() {
  const token = useAuthStore((s) => s.accessToken);
  return <Redirect href={token ? '/(tabs)' : '/(auth)/login'} />;
}
