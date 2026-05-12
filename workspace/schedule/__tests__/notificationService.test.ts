jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'test-project' } } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: jest.fn(() => ({ update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({}) })) },
}));

import * as Notifications from 'expo-notifications';
import { scheduleEventNotification, cancelEventNotification } from '../src/modules/notification/notificationService';
import { CalendarEvent } from '../src/modules/calendar/calendarService';

const futureEvent: CalendarEvent = {
  id: 'evt-1',
  group_id: 'g1',
  created_by: 'u1',
  title: '병원 예약',
  start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2시간 후
  end_at: null,
  memo: null,
  created_at: '',
  updated_at: '',
};

describe('scheduleEventNotification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reminderMinutes 전 알림과 시작 시간 알림, 총 2개를 스케줄링한다', async () => {
    await scheduleEventNotification(futureEvent, 30);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('미리 알림의 identifier는 eventId-reminder 형식이다', async () => {
    await scheduleEventNotification(futureEvent, 30);
    const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    const identifiers = calls.map(([arg]: any) => arg.identifier);
    expect(identifiers).toContain('evt-1-reminder');
    expect(identifiers).toContain('evt-1-start');
  });

  it('이미 지난 이벤트는 알림을 스케줄링하지 않는다', async () => {
    const pastEvent: CalendarEvent = {
      ...futureEvent,
      start_at: new Date(Date.now() - 60 * 1000).toISOString(),
    };
    await scheduleEventNotification(pastEvent, 30);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reminderMinutes 이내의 이벤트는 미리 알림 없이 시작 알림만 스케줄링한다', async () => {
    const soonEvent: CalendarEvent = {
      ...futureEvent,
      start_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10분 후
    };
    await scheduleEventNotification(soonEvent, 30); // 30분 전 알림
    // reminder는 이미 지났으므로 start만
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const [call] = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls;
    expect(call[0].identifier).toBe('evt-1-start');
  });
});

describe('cancelEventNotification', () => {
  it('eventId-reminder와 eventId-start 두 알림을 모두 취소한다', async () => {
    await cancelEventNotification('evt-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('evt-1-reminder');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('evt-1-start');
  });
});
