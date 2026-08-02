import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { subscriptionApi } from '@/api/subscription.api';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const FREE_FEATURES = ['Full profile + linked socials', 'Appear in brand discovery', 'See how many brands viewed you'];
const PRO_FEATURES = ['See exactly which brands viewed & saved you', 'Boosted placement in discovery', 'A Pro badge on your profile', 'Repeat-visit insights & trends'];

function Feature({ text, on }: { text: string; on?: boolean }) {
  return (
    <View className="flex-row items-start mb-2">
      <Ionicons name={on ? 'sparkles' : 'checkmark'} size={16} color={on ? '#818cf8' : '#64748b'} style={{ marginTop: 2 }} />
      <Text className="text-surface-200 text-sm ml-2 flex-1">{text}</Text>
    </View>
  );
}

export default function PlanScreen() {
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: ['subscription', 'me'], queryFn: subscriptionApi.me });

  const checkout = useMutation({
    mutationFn: () => subscriptionApi.checkout('PRO'),
    onSuccess: async (res) => {
      if (res.checkoutUrl) {
        await WebBrowser.openBrowserAsync(res.checkoutUrl);
        qc.invalidateQueries({ queryKey: ['subscription', 'me'] });
        return;
      }
      Alert.alert('You’re on Pro 🎉', 'Enjoy your new insights.');
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['engagement'] });
    },
    onError: (e: unknown) =>
      Alert.alert('Upgrade failed', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please try again.'),
  });

  const cancel = useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: () => { Alert.alert('Switched to Free'); qc.invalidateQueries({ queryKey: ['subscription', 'me'] }); },
  });

  const isPro = plan.data?.isPro;

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#e2e8f0" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Your plan</Text>
      </View>

      {plan.isLoading ? <LoadingSpinner /> : (
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
          <Text className="text-surface-400 text-sm mb-5">
            Upgrade to Pro to see exactly which brands are interested in you — and get discovered more.
          </Text>

          {/* Free */}
          <View className={`rounded-2xl p-5 mb-4 border ${!isPro ? 'border-brand-500 bg-surface-800' : 'border-surface-700 bg-surface-800'}`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white text-lg font-bold">Free</Text>
              {!isPro && <View className="px-2 py-0.5 rounded-full bg-brand-900"><Text className="text-brand-300 text-[10px] font-bold">CURRENT</Text></View>}
            </View>
            <Text className="text-white text-2xl font-bold mb-3">$0<Text className="text-surface-400 text-sm font-normal">/mo</Text></Text>
            {FREE_FEATURES.map((f) => <Feature key={f} text={f} />)}
            {isPro && (
              <TouchableOpacity className="mt-3 rounded-xl py-3 items-center border border-surface-600" disabled={cancel.isPending} onPress={() => cancel.mutate()}>
                <Text className="text-surface-300 font-semibold">Switch to Free</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Pro */}
          <View className={`rounded-2xl p-5 border ${isPro ? 'border-brand-500' : 'border-brand-500/50'} bg-brand-900/30`}>
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={18} color="#818cf8" />
                <Text className="text-white text-lg font-bold ml-1.5">Pro</Text>
              </View>
              {isPro && <View className="px-2 py-0.5 rounded-full bg-brand-500"><Text className="text-white text-[10px] font-bold">CURRENT</Text></View>}
            </View>
            <Text className="text-white text-2xl font-bold mb-3">$12<Text className="text-surface-400 text-sm font-normal">/mo</Text></Text>
            {PRO_FEATURES.map((f) => <Feature key={f} text={f} on />)}
            {!isPro && (
              <TouchableOpacity
                className={`mt-3 rounded-xl py-3 items-center ${checkout.isPending ? 'bg-surface-700' : 'bg-brand-500'}`}
                disabled={checkout.isPending}
                onPress={() => checkout.mutate()}
                activeOpacity={0.85}
              >
                <Text className="text-white font-semibold">{checkout.isPending ? 'Starting…' : 'Upgrade to Pro'}</Text>
              </TouchableOpacity>
            )}
            {isPro && plan.data?.currentPeriodEnd && (
              <Text className="text-surface-400 text-xs mt-3">Renews {new Date(plan.data.currentPeriodEnd).toLocaleDateString()}</Text>
            )}
          </View>

          <View className="flex-row items-start mt-5 bg-surface-800 rounded-xl p-4">
            <Ionicons name="chatbubbles-outline" size={16} color="#94a3b8" style={{ marginTop: 2 }} />
            <Text className="text-surface-400 text-sm ml-2 flex-1">
              <Text className="text-white font-semibold">Coming soon: </Text>
              a higher tier that lets you message brands directly to pitch your interest.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
