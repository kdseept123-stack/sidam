import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { CalendarEvent } from '../calendar/calendarService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase.from('profiles').update({ expo_push_token: token }).eq('id', userId);
}

export async function scheduleEventNotification(event: CalendarEvent, reminderMinutes: number): Promise<void> {
  await cancelEventNotification(event.id);

  const startTime = new Date(event.start_at).getTime();
  const now = Date.now();

  // Pre-reminder
  const reminderTime = startTime - reminderMinutes * 60 * 1000;
  if (reminderTime > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${event.id}-reminder`,
      content: {
        title: '곧 일정이 시작돼요',
        body: `${reminderMinutes}분 후: ${event.title}`,
        data: { eventId: event.id },
      },
      trigger: { date: new Date(reminderTime) } as any,
    });
  }

  // At start time
  if (startTime > now) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${event.id}-start`,
      content: {
        title: '일정 시작',
        body: event.title,
        data: { eventId: event.id },
      },
      trigger: { date: new Date(startTime) } as any,
    });
  }
}

export async function cancelEventNotification(eventId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${eventId}-reminder`).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(`${eventId}-start`).catch(() => {});
}
