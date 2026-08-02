import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { marketplaceApi, Brief } from '@/api/marketplace.api';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/store/auth.store';

const money = (c: number, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(c / 100);

export default function OpportunitiesScreen() {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isInfluencer = role === 'CREATOR' || role === 'ATHLETE';

  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [applyFor, setApplyFor] = useState<Brief | null>(null);
  const [pitch, setPitch] = useState('');
  const [rate, setRate] = useState('');

  const briefs = useQuery({ queryKey: ['marketplace', 'briefs'], queryFn: marketplaceApi.browse, enabled: isInfluencer });
  const mine = useQuery({ queryKey: ['marketplace', 'mine'], queryFn: marketplaceApi.myApplications, enabled: isInfluencer });

  const apply = useMutation({
    mutationFn: () =>
      marketplaceApi.apply(applyFor!.id, { pitch, proposedRateCents: rate ? Math.round(parseFloat(rate) * 100) : undefined }),
    onSuccess: () => {
      setApplyFor(null); setPitch(''); setRate('');
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      Alert.alert('Application sent', 'The brand will see your pitch.');
    },
    onError: (e: unknown) =>
      Alert.alert('Couldn’t apply', (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please try again.'),
  });

  if (!isInfluencer) {
    return (
      <SafeAreaView className="flex-1 bg-surface-900 items-center justify-center px-8">
        <Ionicons name="briefcase-outline" size={40} color="#64748b" />
        <Text className="text-surface-400 text-center text-sm mt-3">
          Opportunities are for creators and athletes to find paid work.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-1">Opportunities</Text>
        <Text className="text-surface-400 text-sm mb-4">Apply to open briefs — no minimum following.</Text>
        <View className="flex-row bg-surface-800 rounded-xl p-1 border border-surface-700">
          {(['open', 'mine'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 rounded-lg py-2 ${tab === t ? 'bg-brand-500' : ''}`}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text className={`text-center text-sm font-semibold ${tab === t ? 'text-white' : 'text-surface-400'}`}>
                {t === 'open' ? 'Open briefs' : 'My applications'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'open' ? (
        briefs.isLoading ? <LoadingSpinner /> : (
          <FlatList
            data={briefs.data ?? []}
            keyExtractor={(b) => b.id}
            contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={briefs.isRefetching} onRefresh={briefs.refetch} tintColor="#6366f1" />}
            ListEmptyComponent={<View className="items-center py-16"><Text className="text-surface-400 text-sm">No open opportunities right now.</Text></View>}
            renderItem={({ item }) => (
              <View className="bg-surface-800 rounded-xl p-4 mb-3 border border-surface-700">
                <View className="flex-row justify-between items-start mb-1">
                  <Text className="text-white font-semibold text-base flex-1 mr-2" numberOfLines={2}>{item.title}</Text>
                  <Text className="text-emerald-400 font-bold text-sm">{money(item.budgetCents, item.currency)}</Text>
                </View>
                <Text className="text-surface-400 text-xs mb-2">{item.brand.companyName}{item.brand.industry ? ` · ${item.brand.industry}` : ''}</Text>
                <Text className="text-surface-300 text-sm mb-3" numberOfLines={3}>{item.description}</Text>
                {item.myApplicationStatus ? (
                  <View className="flex-row"><StatusBadge status={item.myApplicationStatus} /></View>
                ) : (
                  <TouchableOpacity
                    className="bg-brand-500 rounded-lg py-2.5 items-center"
                    onPress={() => { setApplyFor(item); setPitch(''); setRate(''); }}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-semibold text-sm">Apply</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )
      ) : (
        <FlatList
          data={mine.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={mine.isRefetching} onRefresh={mine.refetch} tintColor="#6366f1" />}
          ListEmptyComponent={<View className="items-center py-16"><Text className="text-surface-400 text-sm">You haven’t applied to anything yet.</Text></View>}
          renderItem={({ item }) => (
            <View className="bg-surface-800 rounded-xl p-4 mb-3 border border-surface-700 flex-row items-center">
              <View className="flex-1 mr-2">
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>{item.brief.title}</Text>
                <Text className="text-surface-400 text-xs">{item.brief.brand.companyName} · {money(item.brief.budgetCents)}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>
          )}
        />
      )}

      {/* Apply modal */}
      <Modal visible={!!applyFor} transparent animationType="slide" onRequestClose={() => setApplyFor(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface-900 rounded-t-3xl p-5 border-t border-surface-700">
            <ScrollView keyboardShouldPersistTaps="handled">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white text-lg font-bold flex-1 mr-2" numberOfLines={1}>Apply — {applyFor?.title}</Text>
                <TouchableOpacity onPress={() => setApplyFor(null)}><Ionicons name="close" size={24} color="#94a3b8" /></TouchableOpacity>
              </View>
              <Text className="text-surface-400 text-xs mb-1">Your pitch</Text>
              <TextInput
                className="bg-surface-800 text-white rounded-xl px-4 py-3 text-sm border border-surface-700 mb-3"
                placeholder="Why you’re a great fit, links to relevant work…"
                placeholderTextColor="#64748b"
                value={pitch} onChangeText={setPitch} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
              <Text className="text-surface-400 text-xs mb-1">Your rate (optional, $)</Text>
              <TextInput
                className="bg-surface-800 text-white rounded-xl px-4 py-3 text-sm border border-surface-700 mb-4"
                placeholder="e.g. 500" placeholderTextColor="#64748b" keyboardType="numeric" value={rate} onChangeText={setRate}
              />
              <TouchableOpacity
                className={`rounded-xl py-3 items-center ${!pitch || apply.isPending ? 'bg-surface-700' : 'bg-brand-500'}`}
                disabled={!pitch || apply.isPending}
                onPress={() => apply.mutate()}
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold">{apply.isPending ? 'Sending…' : 'Send application'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
