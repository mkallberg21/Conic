import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { deliverablesApi } from '@/api/deliverables.api';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function DeliverablesScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deliverables'],
    queryFn: deliverablesApi.list,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold">Deliverables</Text>
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
              <Text className="text-surface-400 text-sm">No deliverables yet.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-surface-800 rounded-xl p-4 mb-3 border border-surface-700"
              onPress={() => router.push(`/deliverables/${item.id}`)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-white font-semibold text-sm flex-1 mr-2" numberOfLines={2}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>

              <Text className="text-surface-400 text-xs capitalize mb-2">
                {item.platform} · {item.contentType}
              </Text>

              <View className="flex-row items-center justify-between">
                <Text className="text-surface-400 text-xs">
                  Due {new Date(item.dueDate).toLocaleDateString()}
                </Text>
                <Text className="text-emerald-400 text-xs font-medium">
                  ${(item.paymentAmount / 100).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
