import { Tabs, Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  iconFocused: IconName;
}

const TABS: TabConfig[] = [
  { name: 'index',         title: 'Dashboard',    icon: 'home-outline',          iconFocused: 'home' },
  { name: 'opportunities', title: 'Gigs',         icon: 'briefcase-outline',     iconFocused: 'briefcase' },
  { name: 'contracts',     title: 'Contracts',    icon: 'document-outline',      iconFocused: 'document' },
  { name: 'deliverables',  title: 'Deliverables', icon: 'checkbox-outline',      iconFocused: 'checkbox' },
  { name: 'campaigns',     title: 'Campaigns',    icon: 'megaphone-outline',     iconFocused: 'megaphone' },
  { name: 'profile',       title: 'Profile',      icon: 'person-circle-outline', iconFocused: 'person-circle' },
];

export default function TabsLayout() {
  const token = useAuthStore((s) => s.accessToken);

  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      {TABS.map(({ name, title, icon, iconFocused }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? iconFocused : icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
