import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import { StatCard } from '@/components/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/store/auth.store';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getSummary,
  });

  const firstName = user?.firstName ?? 'there';

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#6366f1"
          />
        }
      >
        {/* Greeting */}
        <View className="mb-6">
          <Text className="text-surface-400 text-sm font-medium">Good to see you,</Text>
          <Text className="text-white text-2xl font-bold">{firstName} 👋</Text>
        </View>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Key metrics */}
            <Text className="text-white font-semibold text-base mb-3">Overview</Text>
            <View className="flex-row flex-wrap gap-3 mb-6">
              <StatCard
                label="Active Contracts"
                value={data?.activeContracts ?? 0}
                trend={data?.contractsTrend}
                color="brand"
              />
              <StatCard
                label="Pending Deliverables"
                value={data?.pendingDeliverables ?? 0}
                trend={data?.deliverablesTrend}
                color="amber"
              />
              <StatCard
                label="Total Earned"
                value={`$${((data?.totalEarnings ?? 0) / 100).toLocaleString()}`}
                trend={data?.earningsTrend}
                color="emerald"
              />
              <StatCard
                label="Active Campaigns"
                value={data?.activeCampaigns ?? 0}
                trend={data?.campaignsTrend}
                color="violet"
              />
            </View>

            {/* Recent activity */}
            <Text className="text-white font-semibold text-base mb-3">Recent Activity</Text>
            {(data?.recentActivity ?? []).length === 0 ? (
              <View className="bg-surface-800 rounded-xl p-6 items-center">
                <Text className="text-surface-400 text-sm text-center">
                  No recent activity. Start by creating a contract or campaign.
                </Text>
              </View>
            ) : (
              (data?.recentActivity ?? []).map((item: any) => (
                <View
                  key={item.id}
                  className="bg-surface-800 rounded-xl px-4 py-3.5 mb-2 flex-row items-center gap-3"
                >
                  <View className="w-2 h-2 rounded-full bg-brand-400" />
                  <View className="flex-1">
                    <Text className="text-white text-sm font-medium">{item.title}</Text>
                    <Text className="text-surface-400 text-xs mt-0.5">{item.description}</Text>
                  </View>
                  <Text className="text-surface-500 text-xs">{item.time}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
