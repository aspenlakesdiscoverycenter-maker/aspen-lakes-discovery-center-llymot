
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Image } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet } from '@/utils/api';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  allergies?: string;
  medicalNotes?: string;
}

interface Attendance {
  id: string;
  childId: string;
  checkInTime: string;
  checkOutTime?: string;
  notes?: string;
  date: string;
}

interface DailyReport {
  id: string;
  childId: string;
  date: string;
  mealsTaken?: any;
  napTime?: any;
  activities?: string;
  mood?: string;
  notes?: string;
}

interface Schedule {
  id: string;
  staffId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  status: string;
  notes?: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // TEMPORARILY HARDCODED TO SHOW STAFF VIEW
  // Change this to 'parent' to see parent view
  const userRole = 'staff';

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [user, authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (userRole === 'parent') {
        await loadParentData();
      } else {
        await loadStaffData();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadParentData = async () => {
    try {
      console.log('[HomeScreen] Loading parent data...');
      
      // Get all children linked to authenticated parent
      const childrenData = await authenticatedGet<Child[]>('/api/parent/children');
      console.log('[HomeScreen] Children data:', childrenData);
      
      setChildren(childrenData);
      
      if (childrenData.length > 0) {
        setSelectedChild(childrenData[0]);
        await loadChildData(childrenData[0].id);
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading parent data:', error);
      throw error;
    }
  };

  const loadChildData = async (childId: string) => {
    try {
      console.log('[HomeScreen] Loading child data for:', childId);
      
      // Get attendance records for the child
      const attendanceData = await authenticatedGet<Attendance[]>(
        `/api/parent/child/${childId}/attendance`
      );
      console.log('[HomeScreen] Attendance data:', attendanceData);
      setAttendance(attendanceData);

      // Get daily reports for the child
      const reportsData = await authenticatedGet<DailyReport[]>(
        `/api/parent/child/${childId}/daily-reports`
      );
      console.log('[HomeScreen] Daily reports data:', reportsData);
      setDailyReports(reportsData);
    } catch (error) {
      console.error('[HomeScreen] Error loading child data:', error);
      throw error;
    }
  };

  const loadStaffData = async () => {
    try {
      console.log('[HomeScreen] Loading staff data...');
      
      // Get today's date in ISO format
      const today = new Date().toISOString().split('T')[0];
      
      // Get staff schedules for today
      const schedulesData = await authenticatedGet<Schedule[]>(
        `/api/staff/schedules?startDate=${today}&endDate=${today}`
      );
      console.log('[HomeScreen] Schedules data:', schedulesData);
      
      // Get staff list to map staff names
      const staffListData = await authenticatedGet<StaffMember[]>('/api/staff/staff-list');
      console.log('[HomeScreen] Staff list:', staffListData);
      setStaffList(staffListData);
      
      setSchedules(schedulesData);
    } catch (error) {
      console.error('[HomeScreen] Error loading staff data:', error);
      throw error;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('[HomeScreen] Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading || loading || !user) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require('@/assets/images/5bf3058e-623b-4c52-af26-9d591fa00b37.png')} 
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // Helper function to get staff name from ID
  const getStaffName = (staffId: string): string => {
    const staff = staffList.find(s => s.id === staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown Staff';
  };

  // Helper function to format time
  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return isoString;
    }
  };

  // Helper function to format date
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return isoString;
    }
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
        <Text style={styles.headerRole}>
          {userRole === 'staff' ? 'Staff Dashboard' : 'Parent Portal'}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {userRole === 'parent' ? (
          <View style={styles.content}>
            {selectedChild && (
              <>
                <View style={styles.childCard}>
                  <View style={styles.childHeader}>
                    <IconSymbol 
                      ios_icon_name="person.circle.fill" 
                      android_material_icon_name="account-circle" 
                      size={48} 
                      color={colors.secondary} 
                    />
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>
                        {selectedChild.firstName} {selectedChild.lastName}
                      </Text>
                      <Text style={styles.childDob}>
                        Born: {formatDate(selectedChild.dateOfBirth)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <IconSymbol 
                      ios_icon_name="calendar" 
                      android_material_icon_name="calendar-today" 
                      size={24} 
                      color={colors.primary} 
                    />
                    <Text style={styles.sectionTitle}>Recent Attendance</Text>
                  </View>
                  {attendance.length > 0 ? (
                    attendance.map((record, index) => (
                      <View key={index} style={styles.card}>
                        <Text style={styles.cardDate}>{formatDate(record.date)}</Text>
                        <View style={styles.timeRow}>
                          <Text style={styles.timeLabel}>Check-in:</Text>
                          <Text style={styles.timeValue}>{formatTime(record.checkInTime)}</Text>
                        </View>
                        {record.checkOutTime && (
                          <View style={styles.timeRow}>
                            <Text style={styles.timeLabel}>Check-out:</Text>
                            <Text style={styles.timeValue}>{formatTime(record.checkOutTime)}</Text>
                          </View>
                        )}
                        {record.notes && (
                          <Text style={styles.cardNotes}>{record.notes}</Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No attendance records yet</Text>
                  )}
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <IconSymbol 
                      ios_icon_name="doc.text.fill" 
                      android_material_icon_name="description" 
                      size={24} 
                      color={colors.primary} 
                    />
                    <Text style={styles.sectionTitle}>Daily Reports</Text>
                  </View>
                  {dailyReports.length > 0 ? (
                    dailyReports.map((report, index) => (
                      <View key={index} style={styles.card}>
                        <Text style={styles.cardDate}>{formatDate(report.date)}</Text>
                        
                        {report.mealsTaken && (
                          <View style={styles.reportSection}>
                            <Text style={styles.reportLabel}>Meals:</Text>
                            <Text style={styles.reportValue}>
                              {typeof report.mealsTaken === 'string' 
                                ? report.mealsTaken 
                                : JSON.stringify(report.mealsTaken)}
                            </Text>
                          </View>
                        )}

                        {report.napTime && (
                          <View style={styles.reportSection}>
                            <Text style={styles.reportLabel}>Nap Time:</Text>
                            <Text style={styles.reportValue}>
                              {typeof report.napTime === 'string' 
                                ? report.napTime 
                                : JSON.stringify(report.napTime)}
                            </Text>
                          </View>
                        )}

                        {report.activities && (
                          <View style={styles.reportSection}>
                            <Text style={styles.reportLabel}>Activities:</Text>
                            <Text style={styles.reportValue}>{report.activities}</Text>
                          </View>
                        )}

                        {report.mood && (
                          <View style={styles.reportSection}>
                            <Text style={styles.reportLabel}>Mood:</Text>
                            <Text style={styles.reportValue}>{report.mood}</Text>
                          </View>
                        )}

                        {report.notes && (
                          <View style={styles.reportSection}>
                            <Text style={styles.reportLabel}>Notes:</Text>
                            <Text style={styles.reportValue}>{report.notes}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>No daily reports yet</Text>
                  )}
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol 
                  ios_icon_name="calendar" 
                  android_material_icon_name="schedule" 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={styles.sectionTitle}>Today&apos;s Schedule</Text>
              </View>
              {schedules.length > 0 ? (
                schedules.map((schedule, index) => (
                  <View key={index} style={styles.card}>
                    <View style={styles.scheduleHeader}>
                      <Text style={styles.staffName}>{getStaffName(schedule.staffId)}</Text>
                      {(schedule.status === 'off' || schedule.status === 'sick_leave' || schedule.status === 'vacation') && (
                        <View style={styles.offBadge}>
                          <Text style={styles.offBadgeText}>{schedule.status.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    {schedule.status === 'scheduled' || schedule.status === 'confirmed' ? (
                      <View style={styles.timeRow}>
                        <Text style={styles.timeLabel}>Shift:</Text>
                        <Text style={styles.timeValue}>
                          {formatTime(schedule.startTime!)} - {formatTime(schedule.endTime!)}
                        </Text>
                      </View>
                    ) : (
                      schedule.notes && (
                        <Text style={styles.cardNotes}>{schedule.notes}</Text>
                      )
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No schedules for today</Text>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconSymbol 
                  ios_icon_name="person.3.fill" 
                  android_material_icon_name="group" 
                  size={24} 
                  color={colors.primary} 
                />
                <Text style={styles.sectionTitle}>Staff Directory</Text>
              </View>
              {staffList.length > 0 ? (
                staffList.map((staff, index) => (
                  <View key={index} style={styles.card}>
                    <View style={styles.staffCard}>
                      <IconSymbol 
                        ios_icon_name="person.circle.fill" 
                        android_material_icon_name="account-circle" 
                        size={40} 
                        color={colors.secondary} 
                      />
                      <View style={styles.staffInfo}>
                        <Text style={styles.staffName}>
                          {staff.firstName} {staff.lastName}
                        </Text>
                        <Text style={styles.staffRole}>{staff.role}</Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No staff members found</Text>
              )}
            </View>
          </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  headerRole: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childInfo: {
    marginLeft: 16,
    flex: 1,
  },
  childName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  childDob: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cardNotes: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  reportSection: {
    marginBottom: 12,
  },
  reportLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  offBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.card,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffInfo: {
    marginLeft: 12,
    flex: 1,
  },
  staffRole: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
});
