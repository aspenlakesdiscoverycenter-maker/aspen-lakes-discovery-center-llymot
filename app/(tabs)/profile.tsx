
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  if (loading || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const userRole = user?.role || 'parent';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <IconSymbol 
                ios_icon_name="person.circle.fill" 
                android_material_icon_name="account-circle" 
                size={80} 
                color={colors.primary} 
              />
            </View>
            <Text style={styles.userName}>{user.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {userRole === 'parent' ? 'Parent' : 'Staff Member'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            {userRole === 'parent' ? (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="message.fill" 
                    android_material_icon_name="message" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <Text style={styles.actionButtonText}>Messages</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="doc.text.fill" 
                    android_material_icon_name="description" 
                    size={24} 
                    color={colors.accent} 
                  />
                  <Text style={styles.actionButtonText}>Forms</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="creditcard.fill" 
                    android_material_icon_name="payment" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <Text style={styles.actionButtonText}>Billing</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="message.fill" 
                    android_material_icon_name="message" 
                    size={24} 
                    color={colors.secondary} 
                  />
                  <Text style={styles.actionButtonText}>Staff Chat</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="calendar" 
                    android_material_icon_name="schedule" 
                    size={24} 
                    color={colors.accent} 
                  />
                  <Text style={styles.actionButtonText}>My Schedule</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <IconSymbol 
                    ios_icon_name="person.2.fill" 
                    android_material_icon_name="group" 
                    size={24} 
                    color={colors.primary} 
                  />
                  <Text style={styles.actionButtonText}>Children</Text>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            
            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol 
                ios_icon_name="bell.fill" 
                android_material_icon_name="notifications" 
                size={24} 
                color={colors.textSecondary} 
              />
              <Text style={styles.actionButtonText}>Notifications</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <IconSymbol 
                ios_icon_name="gear" 
                android_material_icon_name="settings" 
                size={24} 
                color={colors.textSecondary} 
              />
              <Text style={styles.actionButtonText}>App Settings</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <IconSymbol 
              ios_icon_name="arrow.right.square.fill" 
              android_material_icon_name="logout" 
              size={24} 
              color="#FFFFFF" 
            />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 60,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: colors.highlight,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});
