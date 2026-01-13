
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedPost } from '@/utils/api';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [generatingData, setGeneratingData] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const handleSignOut = async () => {
    console.log('[ProfileScreen] Sign out button pressed');
    try {
      await signOut();
      router.replace('/auth');
    } catch (error) {
      console.error('[ProfileScreen] Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleGenerateTestData = async () => {
    console.log('[ProfileScreen] Generate test data button pressed');
    
    if (generatingData) {
      console.log('[ProfileScreen] Already generating data, ignoring press');
      return;
    }

    try {
      setGeneratingData(true);
      console.log('[ProfileScreen] Starting test data generation...');
      
      const response = await authenticatedPost<{ success: boolean; message: string }>('/api/test-data/generate', {
        childrenCount: 20,
        staffCount: 8
      });
      
      console.log('[ProfileScreen] Test data generated successfully:', response);
      Alert.alert(
        'Success!', 
        response.message || 'Test data generated successfully! Check the Children, Classrooms, and Attendance tabs.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ProfileScreen] Error generating test data:', error);
      Alert.alert(
        'Error', 
        'Failed to generate test data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setGeneratingData(false);
      console.log('[ProfileScreen] Test data generation complete');
    }
  };

  const handleClearTestData = async () => {
    console.log('[ProfileScreen] Clear test data button pressed');
    
    if (clearingData) {
      console.log('[ProfileScreen] Already clearing data, ignoring press');
      return;
    }

    Alert.alert(
      'Clear Test Data',
      'This will delete all test children, classrooms, and staff profiles. Your account will remain intact. Continue?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('[ProfileScreen] Clear cancelled')
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingData(true);
              console.log('[ProfileScreen] Starting test data clearing...');
              
              const response = await authenticatedPost<{ success: boolean; message: string }>('/api/test-data/clear', {});
              
              console.log('[ProfileScreen] Test data cleared successfully:', response);
              Alert.alert(
                'Success!', 
                response.message || 'Test data cleared successfully!',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('[ProfileScreen] Error clearing test data:', error);
              Alert.alert(
                'Error', 
                'Failed to clear test data. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setClearingData(false);
              console.log('[ProfileScreen] Test data clearing complete');
            }
          },
        },
      ]
    );
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            <Text style={styles.sectionTitle}>Testing & Demo</Text>
            
            <TouchableOpacity 
              style={[
                styles.menuItem, 
                styles.testDataButton,
                generatingData && styles.buttonDisabled
              ]} 
              onPress={handleGenerateTestData}
              disabled={generatingData}
              activeOpacity={0.6}
            >
              {generatingData ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol 
                  ios_icon_name="wand.and.stars" 
                  android_material_icon_name="auto-fix-high" 
                  size={24} 
                  color={colors.primary} 
                />
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuItemText}>
                  {generatingData ? 'Generating Test Data...' : 'Generate Test Data'}
                </Text>
                {generatingData && (
                  <Text style={styles.menuItemSubtext}>
                    Creating 20 children, 8 staff, and classrooms...
                  </Text>
                )}
              </View>
              {!generatingData && (
                <IconSymbol 
                  ios_icon_name="chevron.right" 
                  android_material_icon_name="chevron-right" 
                  size={20} 
                  color={colors.textSecondary} 
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.menuItem, 
                styles.clearDataButton,
                clearingData && styles.buttonDisabled
              ]} 
              onPress={handleClearTestData}
              disabled={clearingData}
              activeOpacity={0.6}
            >
              {clearingData ? (
                <ActivityIndicator size="small" color="#E74C3C" />
              ) : (
                <IconSymbol 
                  ios_icon_name="trash.fill" 
                  android_material_icon_name="delete" 
                  size={24} 
                  color="#E74C3C" 
                />
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.menuItemText, { color: '#E74C3C' }]}>
                  {clearingData ? 'Clearing Test Data...' : 'Clear Test Data'}
                </Text>
                {clearingData && (
                  <Text style={[styles.menuItemSubtext, { color: '#E74C3C' }]}>
                    Removing all test data...
                  </Text>
                )}
              </View>
              {!clearingData && (
                <IconSymbol 
                  ios_icon_name="chevron.right" 
                  android_material_icon_name="chevron-right" 
                  size={20} 
                  color={colors.textSecondary} 
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                console.log('Edit Profile pressed');
                Alert.alert('Coming Soon', 'Edit Profile feature will be available soon!');
              }}
            >
              <IconSymbol 
                ios_icon_name="person.fill" 
                android_material_icon_name="person" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                console.log('Notifications pressed');
                Alert.alert('Coming Soon', 'Notifications settings will be available soon!');
              }}
            >
              <IconSymbol 
                ios_icon_name="bell.fill" 
                android_material_icon_name="notifications" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Notifications</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                console.log('Privacy & Security pressed');
                Alert.alert('Coming Soon', 'Privacy & Security settings will be available soon!');
              }}
            >
              <IconSymbol 
                ios_icon_name="lock.fill" 
                android_material_icon_name="lock" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Privacy & Security</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                console.log('Help Center pressed');
                Alert.alert('Help Center', 'For support, please contact us at support@aspenlakes.com');
              }}
            >
              <IconSymbol 
                ios_icon_name="questionmark.circle.fill" 
                android_material_icon_name="help" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>Help Center</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => {
                console.log('About pressed');
                Alert.alert('About', 'Aspen Lakes Discovery Center\nVersion 1.0.0\n\nA comprehensive daycare management app.');
              }}
            >
              <IconSymbol 
                ios_icon_name="info.circle.fill" 
                android_material_icon_name="info" 
                size={24} 
                color={colors.primary} 
              />
              <Text style={styles.menuItemText}>About</Text>
              <IconSymbol 
                ios_icon_name="chevron.right" 
                android_material_icon_name="chevron-right" 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.signOutButton} 
            onPress={handleSignOut}
            activeOpacity={0.6}
          >
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
    paddingTop: Platform.OS === 'android' ? 60 : 60,
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
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
    minHeight: 60,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  menuItemSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  testDataButton: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.highlight,
  },
  clearDataButton: {
    borderColor: '#E74C3C',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    minHeight: 56,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
