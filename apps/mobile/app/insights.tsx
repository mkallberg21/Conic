import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { engagementApi, Viewer } from '@/api/engagement.api';
import { subscriptionApi } from '@/api/subscription.api';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function InsightsScreen() {
  const insights = useQuery({ queryKey: ['engagement', 'insights'], queryFn: engagementApi.insights });
  const plan = useQuery({ queryKey: ['subscription', 'me'], queryFn: subscriptionApi.me });
  const viewers = useQuery({
    queryKey: ['engagement', 'viewers'],
    queryFn: engagementApi.viewers,
    enabled: !!plan.data?.isPro,
  });

  const refetchAll = () => { insights.refetch(); plan.refetch(); if (plan.data?.isPro) viewers.refetch(); };
  const s = insights.data;

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#e2e8f0" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Brand interest</Text>
      </View>

      {insights.isLoading ? <LoadingSpinner /> : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={insights.isRefetching} onRefresh={refetchAll} tintColor="#6366f1" />}
        >
          {/* Stat cards */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            <StatCard label="Profile views" value={s?.profileViews ?? 0} color="brand" />
            <StatCard label="Views this week" value={s?.viewsThisWeek ?? 0} color="violet" />
            <StatCard label="Brands reached" value={s?.uniqueBrands ?? 0} color="emerald" />
            <StatCard label="Times saved" value={s?.savedByBrands ?? 0} color="amber" />
          </View>

          {/* Which brands viewed you */}
          <View className="flex-row items-center mb-3">
            <Text className="text-white text-lg font-semibold">Which brands viewed you</Text>
            {!plan.data?.isPro && (
              <View className="ml-2 px-2 py-0.5 rounded-full bg-brand-900 flex-row items-center">
                <Ionicons name="sparkles" size={11} color="#a5b4fc" />
                <Text className="text-brand-300 text-[10px] font-bold ml-1">PRO</Text>
              </View>
            )}
          </View>

          {plan.data?.isPro ? (
            (viewers.data?.viewers.length ?? 0) === 0 ? (
              <Text className="text-surface-400 text-sm">No brands have viewed you yet — keep your profile fresh.</Text>
            ) : (
              <View className="gap-2">
                {viewers.data!.viewers.map((v: Viewer) => (
                  <View key={v.brandId} className="bg-surface-800 rounded-xl p-3 border border-surface-700 flex-row items-center">
                    <View className="w-9 h-9 rounded-lg bg-surface-700 items-center justify-center mr-3">
                      <Text className="text-white text-xs font-bold">{v.companyName.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium" numberOfLines={1}>{v.companyName}</Text>
                      {v.industry ? <Text className="text-surface-400 text-xs">{v.industry}</Text> : null}
                    </View>
                    <View className="items-end">
                      {v.saved && (
                        <View className="px-2 py-0.5 rounded-full bg-emerald-900 mb-1">
                          <Text className="text-emerald-300 text-[10px] font-medium">Saved you</Text>
                        </View>
                      )}
                      <Text className="text-surface-500 text-xs">{v.views} view{v.views === 1 ? '' : 's'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : (
            <View className="bg-surface-800 rounded-xl p-4 border border-dashed border-surface-600">
              <View className="flex-row items-center mb-2">
                <Ionicons name="lock-closed" size={18} color="#94a3b8" />
                <Text className="text-white font-medium ml-2">
                  {s?.uniqueBrands ?? 0} brand{(s?.uniqueBrands ?? 0) === 1 ? '' : 's'} viewed your profile
                </Text>
              </View>
              <Text className="text-surface-400 text-sm mb-3">
                Upgrade to Pro to see exactly which brands viewed and saved you.
              </Text>
              <TouchableOpacity className="bg-brand-500 rounded-lg py-2.5 items-center" activeOpacity={0.85} onPress={() => router.push('/plan')}>
                <Text className="text-white text-sm font-semibold">Upgrade to Pro</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
