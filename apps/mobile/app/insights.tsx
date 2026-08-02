import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { engagementApi, Viewer } from '@/api/engagement.api';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function InsightsScreen() {
  const insights = useQuery({ queryKey: ['engagement', 'insights'], queryFn: engagementApi.insights });
  const viewers = useQuery({ queryKey: ['engagement', 'viewers'], queryFn: engagementApi.viewers });

  const refetchAll = () => { insights.refetch(); viewers.refetch(); };
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
          <Text className="text-white text-lg font-semibold mb-3">Which brands viewed you</Text>

          {(viewers.data?.viewers.length ?? 0) === 0 ? (
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
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
