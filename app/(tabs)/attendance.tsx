
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPost } from '@/utils/api';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  classroomId?: string;
  classroomName?: string;
  checkInId?: string;
  checkInTime?: string;
  isCheckedIn: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  attendanceId?: string;
  signInTime?: string;
  isSignedIn: boolean;
}

interface AttendanceSummary {
  childrenCheckedIn: number;
  staffSignedIn: number;
  classroomsActive: number;
}

export default function AttendanceScreen() {
  const [activeTab, setActiveTab] = useState<'children' | 'staff'>('children');
  const [children, setChildren] = useState<Child[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get dashboard overview for attendance summary
      const dashboardData = await authenticatedGet<any>('/api/dashboard/overview');
      setSummary({
        childrenCheckedIn: dashboardData.totalChildrenCheckedIn || 0,
        staffSignedIn: dashboardData.totalStaffSignedIn || 0,
        classroomsActive: dashboardData.classrooms?.length || 0,
      });

      // Get all children from profiles endpoint
      const childrenData = await authenticatedGet<any[]>('/api/staff/children');
      
      // Get all classrooms to find child assignments
      const classroomsData = await authenticatedGet<any[]>('/api/classrooms');
      
      // Create a map of child IDs to their classroom info
      const childClassroomMap = new Map<string, { classroomId: string; classroomName: string; isCheckedIn: boolean; checkInTime?: string }>();
      
      for (const classroom of classroomsData) {
        const detailedClassroom = await authenticatedGet<any>(`/api/classrooms/${classroom.id}`);
        for (const child of detailedClassroom.children || []) {
          childClassroomMap.set(child.id, {
            classroomId: classroom.id,
            classroomName: classroom.name,
            isCheckedIn: child.isCheckedIn || false,
            checkInTime: child.checkInTime,
          });
        }
      }
      
      // Transform children data to match expected format
      const transformedChildren: Child[] = childrenData.map((child: any) => {
        const classroomInfo = childClassroomMap.get(child.id);
        return {
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          classroomId: classroomInfo?.classroomId,
          classroomName: classroomInfo?.classroomName,
          checkInTime: classroomInfo?.checkInTime,
          isCheckedIn: classroomInfo?.isCheckedIn || false,
        };
      });
      setChildren(transformedChildren);

      // Get currently signed in staff
      const staffData = await authenticatedGet<any[]>('/api/staff/currently-signed-in');
      
      // Get all staff list
      const allStaff = await authenticatedGet<any[]>('/api/staff/staff-list');
      
      // Combine to show all staff with sign-in status
      const transformedStaff: StaffMember[] = allStaff.map((member: any) => {
        const signedIn = staffData.find((s: any) => s.staffId === member.id);
        return {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          attendanceId: signedIn?.attendanceId,
          signInTime: signedIn?.signInTime,
          isSignedIn: !!signedIn,
        };
      });
      setStaff(transformedStaff);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckInChild = async (childId: string) => {
    const child = children.find(c => c.id === childId);
    if (!child) return;

    // Get the child's assigned classroom
    const classroomId = child.classroomId;
    
    if (!classroomId) {
      Alert.alert('Error', 'Child is not assigned to a classroom. Please assign them to a classroom first.');
      return;
    }

    try {
      // Use the classroom check-in endpoint
      await authenticatedPost(`/api/classrooms/${classroomId}/check-in`, {
        childId,
        notes: '',
      });
      
      loadData();
      Alert.alert('Success', `${child.firstName} ${child.lastName} checked in`);
    } catch (error) {
      console.error('Error checking in child:', error);
      Alert.alert('Error', 'Failed to check in child');
    }
  };

  const handleCheckOutChild = async (childId: string) => {
    const child = children.find(c => c.id === childId);
    if (!child) return;

    Alert.alert(
      'Check Out',
      `Check out ${child.firstName} ${child.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          onPress: async () => {
            try {
              // Get the child's classroom
              const classroomId = child.classroomId;
              
              if (!classroomId) {
                Alert.alert('Error', 'Child is not assigned to a classroom');
                return;
              }

              // Use the classroom check-out endpoint
              await authenticatedPost(`/api/classrooms/${classroomId}/check-out`, {
                childId,
              });
              
              loadData();
              Alert.alert('Success', `${child.firstName} ${child.lastName} checked out`);
            } catch (error) {
              console.error('Error checking out child:', error);
              Alert.alert('Error', 'Failed to check out child');
            }
          },
        },
      ]
    );
  };

  const handleSignInStaff = async () => {
    try {
      // Use the staff sign-in endpoint
      await authenticatedPost('/api/staff/sign-in', {
        notes: '',
      });
      
      loadData();
      Alert.alert('Success', 'Signed in successfully');
    } catch (error) {
      console.error('Error signing in staff:', error);
      Alert.alert('Error', 'Failed to sign in');
    }
  };

  const handleSignOutStaff = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              // Use the staff sign-out endpoint
              await authenticatedPost('/api/staff/sign-out', {});
              
              loadData();
              Alert.alert('Success', 'Signed out successfully');
            } catch (error) {
              console.error('Error signing out staff:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { paddingTop: Platform.OS === 'android' ? 48 : 0 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? 48 : 0 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>

      {/* Summary Cards */}
      {summary && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <IconSymbol
              ios_icon_name="person.3.fill"
              android_material_icon_name="group"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.summaryNumber}>{summary.childrenCheckedIn}</Text>
            <Text style={styles.summaryLabel}>Children</Text>
          </View>
          <View style={styles.summaryCard}>
            <IconSymbol
              ios_icon_name="person.badge.clock"
              android_material_icon_name="access-time"
              size={24}
              color={colors.secondary}
            />
            <Text style={styles.summaryNumber}>{summary.staffSignedIn}</Text>
            <Text style={styles.summaryLabel}>Staff</Text>
          </View>
          <View style={styles.summaryCard}>
            <IconSymbol
              ios_icon_name="building.2"
              android_material_icon_name="meeting-room"
              size={24}
              color={colors.sage}
            />
            <Text style={styles.summaryNumber}>{summary.classroomsActive}</Text>
            <Text style={styles.summaryLabel}>Classrooms</Text>
          </View>
        </View>
      )}

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'children' && styles.activeTab]}
          onPress={() => setActiveTab('children')}
        >
          <Text style={[styles.tabText, activeTab === 'children' && styles.activeTabText]}>
            Children
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'staff' && styles.activeTab]}
          onPress={() => setActiveTab('staff')}
        >
          <Text style={[styles.tabText, activeTab === 'staff' && styles.activeTabText]}>
            Staff
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'children' ? (
          <>
            {children.map((child) => (
              <View key={child.id} style={styles.attendanceCard}>
                <View style={styles.personInfo}>
                  <View style={styles.avatarCircle}>
                    <IconSymbol
                      ios_icon_name="person.fill"
                      android_material_icon_name="person"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.personDetails}>
                    <Text style={styles.personName}>
                      {child.firstName} {child.lastName}
                    </Text>
                    {child.classroomName && (
                      <Text style={styles.personSubtext}>{child.classroomName}</Text>
                    )}
                    {!child.classroomName && (
                      <Text style={styles.warningText}>Not assigned to classroom</Text>
                    )}
                    {child.isCheckedIn && child.checkInTime && (
                      <Text style={styles.timeText}>
                        Checked in at {formatTime(child.checkInTime)}
                      </Text>
                    )}
                  </View>
                </View>
                
                {child.isCheckedIn ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkOutButton]}
                    onPress={() => handleCheckOutChild(child.id)}
                  >
                    <Text style={styles.checkOutButtonText}>Check Out</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkInButton]}
                    onPress={() => handleCheckInChild(child.id)}
                    disabled={!child.classroomId}
                  >
                    <Text style={styles.checkInButtonText}>Check In</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {children.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="person.3"
                  android_material_icon_name="group"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateText}>No children found</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Current User Sign In/Out */}
            <View style={styles.currentUserCard}>
              <View style={styles.currentUserHeader}>
                <IconSymbol
                  ios_icon_name="person.circle.fill"
                  android_material_icon_name="account-circle"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.currentUserTitle}>Your Attendance</Text>
              </View>
              
              {staff.find(s => s.isSignedIn) ? (
                <View style={styles.currentUserInfo}>
                  <Text style={styles.currentUserStatus}>
                    Signed in at {formatTime(staff.find(s => s.isSignedIn)?.signInTime)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkOutButton, { marginTop: 12 }]}
                    onPress={handleSignOutStaff}
                  >
                    <Text style={styles.checkOutButtonText}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.currentUserInfo}>
                  <Text style={styles.currentUserStatus}>Not signed in today</Text>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkInButton, { marginTop: 12 }]}
                    onPress={handleSignInStaff}
                  >
                    <Text style={styles.checkInButtonText}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* All Staff List */}
            <Text style={styles.sectionTitle}>All Staff</Text>
            {staff.map((staffMember) => (
              <View key={staffMember.id} style={styles.attendanceCard}>
                <View style={styles.personInfo}>
                  <View style={styles.avatarCircle}>
                    <IconSymbol
                      ios_icon_name="person.fill"
                      android_material_icon_name="person"
                      size={24}
                      color={colors.secondary}
                    />
                  </View>
                  <View style={styles.personDetails}>
                    <Text style={styles.personName}>{staffMember.name}</Text>
                    {staffMember.isSignedIn && staffMember.signInTime ? (
                      <Text style={styles.timeText}>
                        Signed in at {formatTime(staffMember.signInTime)}
                      </Text>
                    ) : (
                      <Text style={styles.personSubtext}>Not signed in</Text>
                    )}
                  </View>
                </View>
                
                {staffMember.isSignedIn ? (
                  <View style={styles.statusBadge}>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                ) : (
                  <View style={styles.statusBadge}>
                    <IconSymbol
                      ios_icon_name="circle"
                      android_material_icon_name="radio-button-unchecked"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
              </View>
            ))}
            {staff.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="person.2"
                  android_material_icon_name="group"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateText}>No staff members found</Text>
              </View>
            )}
          </>
        )}
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
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  currentUserCard: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  currentUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  currentUserTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  currentUserInfo: {
    marginTop: 8,
  },
  currentUserStatus: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  attendanceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  personSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#E74C3C',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  checkInButton: {
    backgroundColor: colors.primary,
  },
  checkInButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkOutButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
});
