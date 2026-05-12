import { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { contractsApi } from '@/api/contracts.api';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function ContractsScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['contracts'],
    queryFn: contractsApi.list,
  });

  const filtered = (data ?? []).filter((c: any) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-900">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">Contracts</Text>
        <TextInput
          className="bg-surface-800 text-white rounded-xl px-4 py-3 text-sm border border-surface-700"
          placeholder="Search contracts…"
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-surface-400 text-sm">No contracts found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-surface-800 rounded-xl p-4 mb-3 border border-surface-700"
              onPress={() => router.push(`/contracts/${item.id}`)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-white font-semibold text-base flex-1 mr-2" numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text className="text-surface-400 text-sm" numberOfLines={1}>
                {item.brand?.companyName ?? item.creator?.handle}
              </Text>
              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-brand-400 font-semibold text-sm">
                  ${(item.totalValue / 100).toLocaleString()}
                </Text>
                <Text className="text-surface-500 text-xs">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
