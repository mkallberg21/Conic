import { View, Text } from 'react-native';

type Color = 'brand' | 'emerald' | 'amber' | 'violet';

const colorMap: Record<Color, { bg: string; text: string }> = {
  brand:   { bg: 'bg-brand-900',   text: 'text-brand-300'   },
  emerald: { bg: 'bg-emerald-900', text: 'text-emerald-300' },
  amber:   { bg: 'bg-amber-900',   text: 'text-amber-300'   },
  violet:  { bg: 'bg-violet-900',  text: 'text-violet-300'  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: number;
  color?: Color;
}

export function StatCard({ label, value, trend, color = 'brand' }: StatCardProps) {
  const { bg, text } = colorMap[color];
  return (
    <View className={`${bg} rounded-xl p-4 flex-1 min-w-[140px]`}>
      <Text className={`${text} text-2xl font-bold`}>{value}</Text>
      <Text className="text-surface-400 text-xs mt-1">{label}</Text>
      {trend !== undefined && (
        <Text className={`text-xs mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </Text>
      )}
    </View>
  );
}
