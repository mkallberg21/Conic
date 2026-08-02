import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/auth.store';

interface SettingRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  rightElement?: React.ReactNode;
}

function SettingRow({ label, value, onPress, destructive, rightElement }: SettingRowProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-4 border-b border-surface-700"
      onPress={onPress}
      disabled={!onPress}
    >
      <Text className={`text-base ${destructive ? 'text-red-400' : 'text-white'}`}>{label}</Text>
      <View className="flex-row items-center gap-2">
        {value && <Text className="text-surface-400 text-sm">{value}</Text>}
        {rightElement}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('refreshToken');
          clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      >
        <Text className="text-white text-2xl font-bold mb-6">Profile</Text>

        {/* Avatar + name */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-brand-600 items-center justify-center mb-3">
            <Text className="text-white text-3xl font-bold">
              {user?.firstName?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text className="text-white text-lg font-semibold">
            {user?.firstName} {user?.lastName}
          </Text>
          <Text className="text-surface-400 text-sm">{user?.email}</Text>
          <View className="mt-2 px-3 py-1 bg-brand-900 rounded-full">
            <Text className="text-brand-300 text-xs font-medium capitalize">
              {user?.role?.toLowerCase()}
            </Text>
          </View>
        </View>

        {/* Insights (creators / athletes) */}
        {(user?.role === 'CREATOR' || user?.role === 'ATHLETE') && (
          <>
            <Text className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
              Your reach
            </Text>
            <View className="bg-surface-800 rounded-xl px-4 mb-6">
              <SettingRow
                label="Brand interest"
                value="Who viewed you"
                onPress={() => router.push('/insights')}
              />
              <SettingRow
                label="Verify your age"
                value="Identity"
                onPress={() => router.push('/verify-age')}
              />
            </View>
          </>
        )}

        {/* Account section */}
        <Text className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
          Account
        </Text>
        <View className="bg-surface-800 rounded-xl px-4 mb-6">
          <SettingRow label="Edit Profile" onPress={() => {}} />
          <SettingRow label="Change Password" onPress={() => {}} />
          <SettingRow
            label="Role"
            value={user?.role ?? ''}
          />
        </View>

        {/* Notifications */}
        <Text className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
          Notifications
        </Text>
        <View className="bg-surface-800 rounded-xl px-4 mb-6">
          <SettingRow
            label="Push Notifications"
            rightElement={<Switch trackColor={{ true: '#6366f1' }} value={true} />}
          />
          <SettingRow
            label="Email Digest"
            rightElement={<Switch trackColor={{ true: '#6366f1' }} value={false} />}
          />
        </View>

        {/* About */}
        <Text className="text-surface-400 text-xs font-semibold uppercase tracking-widest mb-2 ml-1">
          About
        </Text>
        <View className="bg-surface-800 rounded-xl px-4 mb-6">
          <SettingRow label="Terms of Service" onPress={() => {}} />
          <SettingRow label="Privacy Policy" onPress={() => {}} />
          <SettingRow label="Version" value="1.0.0" />
        </View>

        <TouchableOpacity
          className="bg-red-900/30 border border-red-800 rounded-xl py-4 items-center"
          onPress={handleLogout}
        >
          <Text className="text-red-400 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
