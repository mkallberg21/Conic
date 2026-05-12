import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { authApi } from '@/api/auth.api';

type Role = 'BRAND' | 'CREATOR';

export default function RegisterScreen() {
  const [role, setRole] = useState<Role>('BRAND');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!firstName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      await authApi.register({ firstName, lastName, email: email.trim(), password, role });
      Alert.alert(
        'Account created',
        'Please check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: any) {
      Alert.alert(
        'Registration failed',
        err?.response?.data?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1 px-6 pt-10"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold text-white mb-1">Create account</Text>
          <Text className="text-surface-400 text-sm mb-8">Join the Conic creator network</Text>

          {/* Role selector */}
          <View className="mb-6">
            <Text className="text-surface-300 text-sm font-medium mb-2">I am a…</Text>
            <View className="flex-row gap-3">
              {(['BRAND', 'CREATOR'] as Role[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  className={`flex-1 py-3 rounded-xl items-center border ${
                    role === r
                      ? 'bg-brand-500 border-brand-500'
                      : 'border-surface-700 bg-surface-800'
                  }`}
                  onPress={() => setRole(r)}
                >
                  <Text className={`font-semibold text-sm ${role === r ? 'text-white' : 'text-surface-400'}`}>
                    {r === 'BRAND' ? '🏢  Brand' : '🎨  Creator'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="gap-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-surface-300 text-sm font-medium mb-1.5">First name</Text>
                <TextInput
                  className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
                  placeholder="Alex"
                  placeholderTextColor="#64748b"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
              <View className="flex-1">
                <Text className="text-surface-300 text-sm font-medium mb-1.5">Last name</Text>
                <TextInput
                  className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
                  placeholder="Johnson"
                  placeholderTextColor="#64748b"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <View>
              <Text className="text-surface-300 text-sm font-medium mb-1.5">Work email</Text>
              <TextInput
                className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
                placeholder="alex@company.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View>
              <Text className="text-surface-300 text-sm font-medium mb-1.5">Password</Text>
              <TextInput
                className="bg-surface-800 text-white rounded-xl px-4 py-3.5 text-base border border-surface-700"
                placeholder="Min 12 characters"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Text className="text-surface-500 text-xs mt-1.5">
                At least 12 chars with uppercase, lowercase, number, and special character.
              </Text>
            </View>

            <TouchableOpacity
              className="bg-brand-500 rounded-xl py-4 items-center mt-2"
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Create account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mt-8 items-center">
            <Text className="text-surface-400 text-sm">
              Already have an account?{' '}
              <Link href="/(auth)/login" className="text-brand-400 font-medium">
                Sign in
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
