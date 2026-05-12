import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { campaignsApi } from '@/api/campaigns.api';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function CampaignsScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold">Campaigns</Text>
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-surface-400 text-sm">No campaigns yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-surface-800 rounded-xl p-4 mb-3 border border-surface-700"
              onPress={() => router.push(`/campaigns/${item.id}`)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-white font-semibold text-base flex-1 mr-2" numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>

              <Text className="text-surface-400 text-sm" numberOfLines={2}>
                {item.description}
              </Text>

              <View className="flex-row items-center justify-between mt-3">
                <View className="flex-row gap-4">
                  <Text className="text-surface-400 text-xs">
                    {item.creatorCount} creators
                  </Text>
                  <Text className="text-surface-400 text-xs">
                    {item.deliverableCount} deliverables
                  </Text>
                </View>
                <Text className="text-brand-400 font-semibold text-sm">
                  ${(item.budget / 100).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
