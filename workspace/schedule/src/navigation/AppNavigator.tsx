import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import { getMyGroup, Group } from '../modules/group/groupService';
import { registerForPushNotifications, savePushToken } from '../modules/notification/notificationService';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ChecklistScreen from '../screens/ChecklistScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GroupSetupScreen from '../screens/GroupSetupScreen';

export type RootTabParamList = {
  Home: undefined;
  Tasks: { initialCategory?: string } | undefined;
  Calendar: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    getMyGroup(user.id).then(setGroup);
    registerForPushNotifications().then(token => {
      if (token) savePushToken(user.id, token);
    });
  }, [user]);

  if (group === undefined) return null;

  if (!group) {
    return <GroupSetupScreen onGroupJoined={() => getMyGroup(user!.id).then(setGroup)} />;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          title: '홈',
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>,
        }}
      >
        {() => <HomeScreen groupId={group.id} groupName={group.name} />}
      </Tab.Screen>

      <Tab.Screen
        name="Tasks"
        options={{
          title: '할 일',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>✅</Text>,
        }}
      >
        {({ route }) => (
          <ChecklistScreen
            groupId={group.id}
            initialCategory={route.params?.initialCategory as any}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Calendar"
        options={{
          title: '달력',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📅</Text>,
        }}
      >
        {() => <CalendarScreen groupId={group.id} />}
      </Tab.Screen>

      <Tab.Screen
        name="Settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>⚙️</Text>,
        }}
      >
        {() => <SettingsScreen groupId={group.id} groupName={group.name} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
