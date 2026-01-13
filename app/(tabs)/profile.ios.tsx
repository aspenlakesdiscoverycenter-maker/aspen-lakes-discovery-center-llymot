
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image 
            source={require('@/assets/images/0d957812-ddb0-46c4-95b8-853537479c50.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Aspen Lakes</Text>
            <Text style={styles.headerSubtitle}>Discovery Center</Text>
          </View>
        </View>
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
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <IconSymbol 
                ios_icon_name="person.fill" 
                android_material_icon_name="person" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <IconSymbol 
                ios_icon_name="bell.fill" 
                android_material_icon_name="notifications" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Notifications</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <IconSymbol 
                ios_icon_name="lock.fill" 
                android_material_icon_name="lock" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Privacy & Security</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            <TouchableOpacity style={styles.menuItem}>
              <IconSymbol 
                ios_icon_name="questionmark.circle.fill" 
                android_material_icon_name="help" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Help Center</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <IconSymbol 
                ios_icon_name="info.circle.fill" 
                android_material_icon_name="info" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>About</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="arrow-forward" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <IconSymbol 
              ios_icon_name="arrow.right.square.fill" 
              android_material_icon_name="exit-to-app" 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
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
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
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
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
