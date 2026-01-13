
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { calculateAgeInMonths, calculateEffectiveRatio, formatRatio, getStatusColor } from '@/utils/ratioCalculations';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  isKindergarten?: boolean;
  isCheckedIn?: boolean;
  checkInTime?: string;
  ageInMonths?: number;
}

interface Classroom {
  id: string;
  name: string;
  capacity: number;
  ageGroup?: string;
  description?: string;
  currentOccupancy: number;
  childrenCheckedIn: number;
  children: Child[];
  effectiveRatio?: number;
  isOverRatio?: boolean;
  ratioStatus?: 'good' | 'warning' | 'critical';
}

export default function ClassroomsScreen() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allChildren, setAllChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [expandedClassroom, setExpandedClassroom] = useState<string | null>(null);

  // Form states
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomCapacity, setNewClassroomCapacity] = useState('');
  const [newClassroomAgeGroup, setNewClassroomAgeGroup] = useState('');
  const [newClassroomDescription, setNewClassroomDescription] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all classrooms with occupancy data
      const classroomsData = await authenticatedGet<any[]>('/api/classrooms');
      
      // Get currently signed in staff for ratio calculations
      const staffData = await authenticatedGet<any[]>('/api/staff/currently-signed-in');
      const staffCount = staffData.length;

      // Transform classrooms data to match expected format
      const transformedClassrooms: Classroom[] = await Promise.all(
        classroomsData.map(async (classroom: any) => {
          // Get detailed classroom info including children
          const detailedClassroom = await authenticatedGet<any>(`/api/classrooms/${classroom.id}`);
          
          const children = (detailedClassroom.children || []).map((child: any) => {
            const ageInMonths = child.dateOfBirth ? calculateAgeInMonths(child.dateOfBirth) : undefined;
            return {
              id: child.id,
              firstName: child.firstName,
              lastName: child.lastName,
              dateOfBirth: child.dateOfBirth,
              isKindergarten: child.isKindergarten || false,
              isCheckedIn: child.isCheckedIn || false,
              checkInTime: child.checkInTime,
              ageInMonths,
            };
          });

          // Calculate ratio for checked-in children
          const checkedInChildren = children.filter(c => c.isCheckedIn);
          const { effectiveRatio } = calculateEffectiveRatio(checkedInChildren);
          const maxAllowedChildren = staffCount * effectiveRatio;
          const isOverRatio = checkedInChildren.length > maxAllowedChildren;
          
          let ratioStatus: 'good' | 'warning' | 'critical';
          if (isOverRatio) {
            ratioStatus = 'critical';
          } else if (checkedInChildren.length === maxAllowedChildren) {
            ratioStatus = 'warning';
          } else {
            ratioStatus = 'good';
          }
          
          return {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            ageGroup: classroom.ageGroup,
            description: classroom.description,
            currentOccupancy: classroom.currentOccupancy || 0,
            childrenCheckedIn: classroom.childrenCheckedIn || 0,
            children,
            effectiveRatio,
            isOverRatio,
            ratioStatus,
          };
        })
      );
      
      setClassrooms(transformedClassrooms);

      // Get all children from profiles endpoint
      const childrenData = await authenticatedGet<any[]>('/api/staff/children');
      
      // Transform children data
      const transformedChildren: Child[] = childrenData.map((child: any) => ({
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
      }));
      
      setAllChildren(transformedChildren);
    } catch (error) {
      console.error('Error loading classrooms:', error);
      Alert.alert('Error', 'Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim() || !newClassroomCapacity) {
      Alert.alert('Error', 'Please fill in classroom name and capacity');
      return;
    }

    try {
      // Create classroom with provided data
      await authenticatedPost('/api/classrooms', {
        name: newClassroomName,
        capacity: parseInt(newClassroomCapacity),
        ageGroup: newClassroomAgeGroup || undefined,
        description: newClassroomDescription || undefined,
      });

      setShowCreateModal(false);
      setNewClassroomName('');
      setNewClassroomCapacity('');
      setNewClassroomAgeGroup('');
      setNewClassroomDescription('');
      loadData();
      Alert.alert('Success', 'Classroom created successfully');
    } catch (error) {
      console.error('Error creating classroom:', error);
      Alert.alert('Error', 'Failed to create classroom');
    }
  };

  const handleAssignChild = async (childId: string) => {
    if (!selectedClassroom) return;

    try {
      // Assign child to classroom
      await authenticatedPost(`/api/classrooms/${selectedClassroom.id}/assign-child`, {
        childId,
      });

      setShowAssignModal(false);
      setSelectedClassroom(null);
      loadData();
      Alert.alert('Success', 'Child assigned to classroom');
    } catch (error) {
      console.error('Error assigning child:', error);
      Alert.alert('Error', 'Failed to assign child');
    }
  };

  const handleRemoveChild = async (classroomId: string, childId: string) => {
    Alert.alert(
      'Remove Child',
      'Are you sure you want to remove this child from the classroom?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove child from classroom
              await authenticatedPost(`/api/classrooms/${classroomId}/remove-child`, {
                childId,
              });
              loadData();
              Alert.alert('Success', 'Child removed from classroom');
            } catch (error) {
              console.error('Error removing child:', error);
              Alert.alert('Error', 'Failed to remove child');
            }
          },
        },
      ]
    );
  };

  const getUnassignedChildren = () => {
    const assignedChildIds = classrooms.flatMap(c => c.children.map(ch => ch.id));
    return allChildren.filter(child => !assignedChildIds.includes(child.id));
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
        <Text style={styles.headerTitle}>Classrooms</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={28}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {classrooms.map((classroom) => (
          <View key={classroom.id} style={styles.classroomCard}>
            <TouchableOpacity
              style={styles.classroomHeader}
              onPress={() => setExpandedClassroom(expandedClassroom === classroom.id ? null : classroom.id)}
            >
              <View style={styles.classroomInfo}>
                <Text style={styles.classroomName}>{classroom.name}</Text>
                {classroom.ageGroup && (
                  <Text style={styles.ageGroup}>{classroom.ageGroup}</Text>
                )}
                <View style={styles.capacityRow}>
                  <IconSymbol
                    ios_icon_name="person.2.fill"
                    android_material_icon_name="group"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.capacityText}>
                    {classroom.currentOccupancy} / {classroom.capacity}
                  </Text>
                  <Text style={styles.checkedInText}>
                    ({classroom.childrenCheckedIn} checked in)
                  </Text>
                </View>
                {classroom.effectiveRatio && (
                  <View style={styles.ratioIndicatorRow}>
                    <Text style={styles.ratioLabel}>Ratio:</Text>
                    <Text style={[styles.ratioValue, { color: getStatusColor(classroom.ratioStatus || 'good') }]}>
                      {formatRatio(classroom.effectiveRatio)}
                    </Text>
                    {classroom.isOverRatio && (
                      <View style={styles.overRatioBadge}>
                        <Text style={styles.overRatioText}>OVER RATIO</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              <IconSymbol
                ios_icon_name={expandedClassroom === classroom.id ? "chevron.up" : "chevron.down"}
                android_material_icon_name={expandedClassroom === classroom.id ? "expand-less" : "expand-more"}
                size={24}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {expandedClassroom === classroom.id && (
              <View style={styles.classroomDetails}>
                {classroom.description && (
                  <Text style={styles.description}>{classroom.description}</Text>
                )}

                <View style={styles.childrenSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Children in Classroom</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedClassroom(classroom);
                        setShowAssignModal(true);
                      }}
                    >
                      <IconSymbol
                        ios_icon_name="person.badge.plus"
                        android_material_icon_name="person-add"
                        size={24}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>

                  {classroom.children.length === 0 ? (
                    <Text style={styles.emptyText}>No children assigned</Text>
                  ) : (
                    classroom.children.map((child) => (
                      <View key={child.id} style={styles.childRow}>
                        <View style={styles.childInfo}>
                          <Text style={styles.childName}>
                            {child.firstName} {child.lastName}
                          </Text>
                          {child.isCheckedIn && (
                            <View style={styles.checkedInBadge}>
                              <IconSymbol
                                ios_icon_name="checkmark.circle.fill"
                                android_material_icon_name="check-circle"
                                size={14}
                                color={colors.primary}
                              />
                              <Text style={styles.checkedInBadgeText}>Checked In</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRemoveChild(classroom.id, child.id)}
                        >
                          <IconSymbol
                            ios_icon_name="xmark.circle"
                            android_material_icon_name="cancel"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}
          </View>
        ))}

        {classrooms.length === 0 && (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="building.2"
              android_material_icon_name="meeting-room"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>No classrooms yet</Text>
            <Text style={styles.emptyStateSubtext}>Tap the + button to create one</Text>
          </View>
        )}
      </ScrollView>

      {/* Create Classroom Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Classroom</Text>

            <TextInput
              style={styles.input}
              placeholder="Classroom Name *"
              placeholderTextColor={colors.textSecondary}
              value={newClassroomName}
              onChangeText={setNewClassroomName}
            />

            <TextInput
              style={styles.input}
              placeholder="Capacity *"
              placeholderTextColor={colors.textSecondary}
              value={newClassroomCapacity}
              onChangeText={setNewClassroomCapacity}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Age Group (e.g., Infants, Toddlers)"
              placeholderTextColor={colors.textSecondary}
              value={newClassroomAgeGroup}
              onChangeText={setNewClassroomAgeGroup}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={colors.textSecondary}
              value={newClassroomDescription}
              onChangeText={setNewClassroomDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateClassroom}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Child Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Child to {selectedClassroom?.name}</Text>

            <ScrollView style={styles.childList}>
              {getUnassignedChildren().map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childListItem}
                  onPress={() => handleAssignChild(child.id)}
                >
                  <Text style={styles.childListName}>
                    {child.firstName} {child.lastName}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.right"
                    android_material_icon_name="chevron-right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
              {getUnassignedChildren().length === 0 && (
                <Text style={styles.emptyText}>All children are assigned to classrooms</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 16 }]}
              onPress={() => setShowAssignModal(false)}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  addButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
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
  classroomName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  ageGroup: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkedInText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  ratioIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ratioLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ratioValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  overRatioBadge: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overRatioText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  classroomDetails: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  childrenSection: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  childRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    marginBottom: 8,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  checkedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedInBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
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
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  childList: {
    maxHeight: 300,
  },
  childListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  childListName: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
});
