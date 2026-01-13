
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  // Define the tabs configuration
  const tabs: TabBarItem[] = [
    {
      name: '(home)',
      route: '/(tabs)/(home)/',
      icon: 'home',
      label: 'Home',
    },
    {
      name: 'children',
      route: '/(tabs)/children',
      icon: 'child-care',
      label: 'Children',
    },
    {
      name: 'daily-reports',
      route: '/(tabs)/daily-reports',
      icon: 'assignment',
      label: 'Reports',
    },
    {
      name: 'forms',
      route: '/(tabs)/forms',
      icon: 'description',
      label: 'Forms',
    },
    {
      name: 'time-off',
      route: '/(tabs)/time-off',
      icon: 'event-available',
      label: 'Time Off',
    },
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person',
      label: 'Profile',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="children" name="children" />
        <Stack.Screen key="daily-reports" name="daily-reports" />
        <Stack.Screen key="forms" name="forms" />
        <Stack.Screen key="time-off" name="time-off" />
        <Stack.Screen key="profile" name="profile" />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
