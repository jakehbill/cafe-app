import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { TabBarLabel } from '@/components/navigation/TabBarLabel';

import { COLORS } from '@/components/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        /** Prevent any default header title from surfacing the route group name "(tabs)". */
        headerTitle: '',
        tabBarButton: HapticTab,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.cardBorder,
          borderTopWidth: 1,
          paddingTop: 8,
        },
        tabBarLabel: ({ focused, children }) => (
          <TabBarLabel focused={focused}>
            {typeof children === 'string' ? children : ''}
          </TabBarLabel>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Home',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} outline="home-outline" filled="home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerTitle: 'Search',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} outline="search-outline" filled="search" />
          ),
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: 'Saved',
          headerTitle: 'Saved',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} outline="bookmark-outline" filled="bookmark" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon focused={focused} outline="person-outline" filled="person" />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null,
          headerShown: false,
          headerTitle: '',
          title: '',
        }}
      />
      <Tabs.Screen
        name="cafe/[id]"
        options={{
          href: null,
          headerShown: false,
          headerTitle: '',
          title: '',
        }}
      />
      <Tabs.Screen
        name="my-cafes"
        options={{
          href: null,
          headerShown: false,
          headerTitle: '',
          title: '',
        }}
      />
    </Tabs>
  );
}
