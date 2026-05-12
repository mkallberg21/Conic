import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers for push notifications on first authenticated load and sends
 * the Expo push token to the backend to enable server-driven notifications.
 */
export function usePushNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    if (!token) return;

    async function register() {
      if (!Device.isDevice) return; // Simulators/emulators don't support push.

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366f1',
        });
      }

      const expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await apiClient.post('/notifications/push-token', { token: expoPushToken }).catch(() => {});
    }

    register();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Handle foreground notification — could trigger a toast/badge update here.
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      // Deep-link routing based on notification data:
      // e.g. { type: 'CONTRACT', id: '...' } → navigate to contract detail.
      if (data?.['type'] && data?.['id']) {
        // Navigation handled client-side via Expo Router.
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [token]);
}
