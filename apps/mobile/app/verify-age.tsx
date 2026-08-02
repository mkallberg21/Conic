import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { verificationApi, AgeStartResult } from '@/api/verification.api';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function VerifyAgeScreen() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['verification', 'age'], queryFn: verificationApi.ageStatus });

  const start = useMutation({
    mutationFn: (method: 'ESTIMATION' | 'DOCUMENT') => verificationApi.ageStart(method),
    onSuccess: async (res: AgeStartResult) => {
      if (res.redirectUrl) {
        await WebBrowser.openBrowserAsync(res.redirectUrl);
      } else if (res.status === 'APPROVED') {
        Alert.alert('Age verified', 'You’re all set.');
      } else {
        Alert.alert('Verification started', 'We’ll update your status when it completes.');
      }
      qc.invalidateQueries({ queryKey: ['verification', 'age'] });
    },
    onError: (e: unknown) =>
      Alert.alert('Couldn’t start', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please try again.'),
  });

  const s = status.data;
  const badge = s?.ageVerified
    ? { label: `Verified${s.method === 'DOCUMENT' ? ' · ID' : ''}`, cls: 'bg-emerald-900', text: 'text-emerald-300' }
    : s?.current?.status === 'DECLINED'
      ? { label: 'Declined', cls: 'bg-red-900', text: 'text-red-300' }
      : s?.current?.status === 'PENDING' || s?.current?.status === 'REVIEW'
        ? { label: 'In review', cls: 'bg-amber-900', text: 'text-amber-300' }
        : { label: 'Not verified', cls: 'bg-surface-700', text: 'text-surface-300' };

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#e2e8f0" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Verify your age</Text>
      </View>

      {status.isLoading ? <LoadingSpinner /> : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
          <View className="flex-row items-center mb-4">
            <View className={`px-3 py-1 rounded-full ${badge.cls}`}>
              <Text className={`text-xs font-semibold ${badge.text}`}>{badge.label}</Text>
            </View>
          </View>

          <Text className="text-surface-400 text-sm mb-6">
            A quick age check lets you appear in discovery and sign agreements. A full ID check is required
            before you can receive a payout — and it keeps the platform safe for everyone.
          </Text>

          {s?.current?.status === 'DECLINED' && (
            <View className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4">
              <Text className="text-red-300 text-sm">Your last check was declined. You can try again below.</Text>
            </View>
          )}

          {!s?.ageVerified && (
            <View className="gap-3">
              <TouchableOpacity
                className={`rounded-xl p-4 flex-row items-center ${start.isPending ? 'bg-surface-700' : 'bg-brand-500'}`}
                disabled={start.isPending}
                onPress={() => start.mutate('ESTIMATION')}
                activeOpacity={0.85}
              >
                <Ionicons name="scan-outline" size={22} color="#fff" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-semibold">Quick age check</Text>
                  <Text className="text-white/70 text-xs">Fast — unlocks discovery &amp; signing</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className="rounded-xl p-4 flex-row items-center bg-surface-800 border border-surface-700"
                disabled={start.isPending}
                onPress={() => start.mutate('DOCUMENT')}
                activeOpacity={0.85}
              >
                <Ionicons name="card-outline" size={22} color="#818cf8" />
                <View className="ml-3 flex-1">
                  <Text className="text-white font-semibold">Full ID verification</Text>
                  <Text className="text-surface-400 text-xs">Required before payouts</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {s?.ageVerified && (
            <View className="flex-row items-center bg-surface-800 rounded-xl p-4">
              <Ionicons name="shield-checkmark" size={22} color="#34d399" />
              <Text className="text-surface-200 text-sm ml-3 flex-1">
                Your age is verified{s.method === 'ESTIMATION' ? '. Complete a full ID check when you’re ready for payouts.' : '.'}
              </Text>
            </View>
          )}
          {s?.ageVerified && s.method === 'ESTIMATION' && (
            <TouchableOpacity
              className="mt-3 rounded-xl p-4 flex-row items-center bg-surface-800 border border-surface-700"
              disabled={start.isPending}
              onPress={() => start.mutate('DOCUMENT')}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={22} color="#818cf8" />
              <Text className="text-white font-semibold ml-3">Complete full ID verification</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
