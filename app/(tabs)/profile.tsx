import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from './components/theme';

export default function ProfileScreen() {
  async function handleLogOut() {
    console.log('LOG OUT pressed');

    try {
      const signOutResult = await supabase.auth.signOut();
      console.log('Supabase signOut response:', signOutResult);

      const { error } = signOutResult;
      if (error) {
        console.error('Log out failed (Supabase error):', error);
        Alert.alert('Log out failed', error.message);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log('Session after logout:', {
        sessionError,
        hasSession: !!sessionData.session,
      });

      if (sessionData.session) {
        console.error('Log out: session still present after signOut');
        Alert.alert('Log out failed', 'Session could not be cleared. Try again.');
        return;
      }

      router.replace('/auth');
    } catch (e) {
      console.error('Log out failed (unexpected):', e);
      Alert.alert(
        'Log out failed',
        e instanceof Error ? e.message : 'Something went wrong'
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account session.</Text>

        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.logOutButton}
          onPress={() => void handleLogOut()}
        >
          <Text style={styles.logOutButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 20,
  },
  logOutButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#F2EBDD',
    borderWidth: 1,
    borderColor: '#E7DDCD',
  },
  logOutButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

