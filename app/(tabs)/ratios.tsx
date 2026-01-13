
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
  RefreshControl,
} from 'react-native';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet } from '@/utils/api';
import {
  calculateAgeInMonths,
  getRequiredRatio,
  calculateEffectiveRatio,
  formatRatio,
  getStatusColor,
  getRatioLabel,
} from '@/utils/ratioCalculations';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isKindergarten?: boolean;
  ageInMonths?: number;
  isCheckedIn?: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  isSignedIn: boolean;
}

interface ClassroomRatio {
  classroomId: string;
  classroomName: string;
  staffCount: number;
  staffMembers: StaffMember[];
  childrenCheckedIn: number;
  children: Child[];
  effectiveRatio: number;
  ratioGroups: Array<{ ratio: number; count: number; label: string }>;
  isOverRatio: boolean;
  maxAllowedChildren: number;
  status: 'good' | 'warning' | 'critical';
}

export default function RatiosScreen() {
  const [classroomRatios, setClassroomRatios] = useState<ClassroomRatio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedClassroom, setExpandedClassroom] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Get all classrooms
      const classroomsData = await authenticatedGet<any[]>('/api/classrooms');
      
      // Get currently signed in staff
      const staffData = await authenticatedGet<any[]>('/api/staff/currently-signed-in');
      
      // For each classroom, get detailed info and calculate ratios
      const ratios: ClassroomRatio[] = await Promise.all(
        classroomsData.map(async (classroom: any) => {
          try {
            // Get detailed classroom info
            const detailedClassroom = await authenticatedGet<any>(`/api/classrooms/${classroom.id}`);
            
            // Get staff assigned to this classroom (TODO: Backend Integration)
            // For now, we'll assume all signed-in staff are available
            const staffMembers: StaffMember[] = staffData.map((s: any) => ({
              id: s.staffId,
              name: s.name,
              isSignedIn: true,
            }));
            
            // Get children checked into this classroom
            const children: Child[] = (detailedClassroom.children || [])
              .filter((child: any) => child.isCheckedIn)
              .map((child: any) => {
                const ageInMonths = calculateAgeInMonths(child.dateOfBirth);
                return {
                  id: child.id,
                  firstName: child.firstName,
                  lastName: child.lastName,
                  dateOfBirth: child.dateOfBirth,
                  isKindergarten: child.isKindergarten || false,
                  ageInMonths,
                  isCheckedIn: true,
                };
              });

            // Calculate effective ratio
            const { effectiveRatio, ratioGroups } = calculateEffectiveRatio(children);
            
            // Calculate status
            const staffCount = staffMembers.length;
            const childrenCount = children.length;
            const maxAllowedChildren = staffCount * effectiveRatio;
            const isOverRatio = childrenCount > maxAllowedChildren;
            
            let status: 'good' | 'warning' | 'critical';
            if (isOverRatio) {
              status = 'critical';
            } else if (childrenCount === maxAllowedChildren) {
              status = 'warning';
            } else {
              status = 'good';
            }

            return {
              classroomId: classroom.id,
              classroomName: classroom.name,
              staffCount,
              staffMembers,
              childrenCheckedIn: childrenCount,
              children,
              effectiveRatio,
              ratioGroups,
              isOverRatio,
              maxAllowedChildren,
              status,
            };
          } catch (error) {
            console.error(`Error loading ratio for classroom ${classroom.id}:`, error);
            return null;
          }
        })
      );

      // Filter out any null results
      setClassroomRatios(ratios.filter((r): r is ClassroomRatio => r !== null));
    } catch (error) {
      console.error('Error loading ratio data:', error);
      Alert.alert('Error', 'Failed to load ratio data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const toggleExpanded = (classroomId: string) => {
    setExpandedClassroom(expandedClassroom === classroomId ? null : classroomId);
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
        <Text style={styles.headerTitle}>Staff-Child Ratios</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshButton}>
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Classrooms</Text>
            <Text style={styles.summaryNumber}>{classroomRatios.length}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Over Ratio</Text>
            <Text style={[styles.summaryNumber, { color: colors.error }]}>
              {classroomRatios.filter(r => r.isOverRatio).length}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>At Capacity</Text>
            <Text style={[styles.summaryNumber, { color: '#F39C12' }]}>
              {classroomRatios.filter(r => r.status === 'warning').length}
            </Text>
          </View>
        </View>

        {/* Classroom Ratio Cards */}
        {classroomRatios.map((classroom) => (
          <View key={classroom.classroomId} style={styles.classroomCard}>
            <TouchableOpacity
              style={styles.classroomHeader}
              onPress={() => toggleExpanded(classroom.classroomId)}
            >
              <View style={styles.classroomInfo}>
                <View style={styles.classroomTitleRow}>
                  <Text style={styles.classroomName}>{classroom.classroomName}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(classroom.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {classroom.isOverRatio ? 'OVER RATIO' : classroom.status === 'warning' ? 'AT CAPACITY' : 'GOOD'}
                    </Text>
                  </View>
                </View>

                <View style={styles.ratioRow}>
                  <View style={styles.ratioItem}>
                    <IconSymbol
                      ios_icon_name="person.2.fill"
                      android_material_icon_name="group"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.ratioText}>
                      {classroom.staffCount} staff
                    </Text>
                  </View>
                  <View style={styles.ratioItem}>
                    <IconSymbol
                      ios_icon_name="person.3.fill"
                      android_material_icon_name="group"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.ratioText}>
                      {classroom.childrenCheckedIn} children
                    </Text>
                  </View>
                </View>

                <View style={styles.effectiveRatioRow}>
                  <Text style={styles.effectiveRatioLabel}>Effective Ratio:</Text>
                  <Text style={styles.effectiveRatioValue}>
                    {formatRatio(classroom.effectiveRatio)}
                  </Text>
                  <Text style={styles.maxAllowedText}>
                    (max {classroom.maxAllowedChildren} children)
                  </Text>
                </View>
              </View>

              <IconSymbol
                ios_icon_name={expandedClassroom === classroom.classroomId ? "chevron.up" : "chevron.down"}
                android_material_icon_name={expandedClassroom === classroom.classroomId ? "expand-less" : "expand-more"}
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {expandedClassroom === classroom.classroomId && (
              <View style={styles.expandedContent}>
                {/* Ratio Groups */}
                {classroom.ratioGroups.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Age Groups</Text>
                    {classroom.ratioGroups.map((group, index) => (
                      <View key={index} style={styles.ratioGroupRow}>
                        <Text style={styles.ratioGroupLabel}>{group.label}</Text>
                        <Text style={styles.ratioGroupCount}>{group.count} children</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Staff Members */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Staff Signed In</Text>
                  {classroom.staffMembers.length === 0 ? (
                    <Text style={styles.emptyText}>No staff signed in</Text>
                  ) : (
                    classroom.staffMembers.map((staff) => (
                      <View key={staff.id} style={styles.staffRow}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={styles.staffName}>{staff.name}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* Children */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Children Checked In</Text>
                  {classroom.children.length === 0 ? (
                    <Text style={styles.emptyText}>No children checked in</Text>
                  ) : (
                    classroom.children.map((child) => {
                      const ratio = getRequiredRatio(child.ageInMonths || 0, child.isKindergarten);
                      return (
                        <View key={child.id} style={styles.childRow}>
                          <View style={styles.childInfo}>
                            <Text style={styles.childName}>
                              {child.firstName} {child.lastName}
                            </Text>
                            <Text style={styles.childRatio}>
                              {getRatioLabel(ratio)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}
          </View>
        ))}

        {classroomRatios.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="building.2"
              android_material_icon_name="meeting-room"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>No classrooms found</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  refreshButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  classroomCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  classroomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  classroomInfo: {
    flex: 1,
  },
  classroomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  classroomName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ratioRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  ratioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratioText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  effectiveRatioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  effectiveRatioLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  effectiveRatioValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  maxAllowedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  ratioGroupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    marginBottom: 6,
  },
  ratioGroupLabel: {
    fontSize: 14,
    color: colors.text,
  },
  ratioGroupCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  staffName: {
    fontSize: 14,
    color: colors.text,
  },
  childRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    marginBottom: 6,
  },
  childInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  childRatio: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
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
