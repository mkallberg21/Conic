import { View, ActivityIndicator } from 'react-native';

export function LoadingSpinner() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
