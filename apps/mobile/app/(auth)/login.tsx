import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/auth.api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const { accessToken, refreshToken, user } = await authApi.login(email.trim(), password);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      setAuth({ accessToken, user });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err?.response?.data?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    const savedRefreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!savedRefreshToken) {
      Alert.alert('No saved session', 'Please log in with your email and password first.');
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      Alert.alert('Biometrics unavailable', 'Your device does not support biometric authentication.');
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to Conic',
      fallbackLabel: 'Use passcode',
    });

    if (!result.success) return;

    try {
      setLoading(true);
      const { accessToken, user } = await authApi.refreshToken(savedRefreshToken);
      setAuth({ accessToken, user });
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Session expired', 'Please log in again.');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1 px-6 justify-center"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Logo / wordmark */}
        <View className="items-center mb-10">
          <Text className="text-4xl font-bold text-brand-400 tracking-tight">conic</Text>
          <Text className="text-surface-400 text-sm mt-1">Creator Partnership Platform</Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text className="text-surface-300 text-sm font-medium mb-1.5">Email</Text>
            <TextInput
              className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
              placeholder="you@company.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-surface-300 text-sm font-medium mb-1.5">Password</Text>
            <TextInput
              className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
              placeholder="••••••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            className="bg-brand-500 rounded-xl py-4 items-center mt-2"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Sign in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="border border-surface-700 rounded-xl py-4 items-center"
            onPress={handleBiometricLogin}
            disabled={loading}
          >
            <Text className="text-surface-300 font-medium text-base">
              Sign in with Face ID / Fingerprint
            </Text>
          </TouchableOpacity>
        </View>

        <View className="mt-8 items-center">
          <Text className="text-surface-400 text-sm">
            Don't have an account?{' '}
            <Link href="/(auth)/register" className="text-brand-400 font-medium">
              Request access
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
