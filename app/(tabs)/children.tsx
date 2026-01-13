
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Image, TextInput, Modal } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Parent {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
  relationship?: string;
  isPrimary?: boolean;
}

interface Sibling {
  id: string;
  firstName: string;
  lastName: string;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isKindergarten?: boolean;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  albertaHealthcareNumber?: string;
  allergies?: string;
  generalHealth?: string;
  medicalNotes?: string;
  emergencyContacts?: any;
  parentNotes?: string;
  parents?: Parent[];
  siblings?: Sibling[];
}

export default function ChildrenScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state for adding/editing children
  const [formData, setFormData] = useState<Partial<Child>>({
    firstName: '',
    lastName: '',
    dateOfBirth: new Date().toISOString(),
    isKindergarten: false,
    street: '',
    city: '',
    province: 'Alberta',
    postalCode: '',
    albertaHealthcareNumber: '',
    allergies: '',
    generalHealth: '',
    medicalNotes: '',
    parentNotes: '',
  });

  useEffect(() => {
    loadChildren();
  }, []);

  const loadChildren = async () => {
    setLoading(true);
    try {
      console.log('[ChildrenScreen] Loading children...');
      const data = await authenticatedGet<Child[]>('/api/profiles/children');
      console.log('[ChildrenScreen] Children loaded:', data);
      setChildren(data);
    } catch (error) {
      console.error('[ChildrenScreen] Error loading children:', error);
      Alert.alert('Error', 'Failed to load children. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadChildDetails = async (childId: string) => {
    try {
      console.log('[ChildrenScreen] Loading child details:', childId);
      const data = await authenticatedGet<Child>(`/api/profiles/child/${childId}`);
      console.log('[ChildrenScreen] Child details loaded:', data);
      setSelectedChild(data);
    } catch (error) {
      console.error('[ChildrenScreen] Error loading child details:', error);
      Alert.alert('Error', 'Failed to load child details.');
    }
  };

  const handleAddChild = async () => {
    if (!formData.firstName || !formData.lastName) {
      Alert.alert('Error', 'Please enter first and last name.');
      return;
    }

    try {
      console.log('[ChildrenScreen] Adding child:', formData);
      await authenticatedPost('/api/profiles/children', formData);
      Alert.alert('Success', 'Child profile created successfully!');
      setShowAddModal(false);
      resetForm();
      loadChildren();
    } catch (error) {
      console.error('[ChildrenScreen] Error adding child:', error);
      Alert.alert('Error', 'Failed to create child profile.');
    }
  };

  const handleUpdateChild = async () => {
    if (!selectedChild) return;

    try {
      console.log('[ChildrenScreen] Updating child:', selectedChild.id, formData);
      await authenticatedPut(`/api/profiles/child/${selectedChild.id}`, formData);
      Alert.alert('Success', 'Child profile updated successfully!');
      setShowEditModal(false);
      resetForm();
      loadChildren();
      loadChildDetails(selectedChild.id);
    } catch (error) {
      console.error('[ChildrenScreen] Error updating child:', error);
      Alert.alert('Error', 'Failed to update child profile.');
    }
  };

  const handleDeleteChild = async (childId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this child profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authenticatedDelete(`/api/profiles/child/${childId}`);
              Alert.alert('Success', 'Child profile deleted.');
              setSelectedChild(null);
              loadChildren();
            } catch (error) {
              console.error('[ChildrenScreen] Error deleting child:', error);
              Alert.alert('Error', 'Failed to delete child profile.');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: new Date().toISOString(),
      isKindergarten: false,
      street: '',
      city: '',
      province: 'Alberta',
      postalCode: '',
      albertaHealthcareNumber: '',
      allergies: '',
      generalHealth: '',
      medicalNotes: '',
      parentNotes: '',
    });
  };

  const openEditModal = (child: Child) => {
    setFormData({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth,
      isKindergarten: child.isKindergarten || false,
      street: child.street || '',
      city: child.city || '',
      province: child.province || 'Alberta',
      postalCode: child.postalCode || '',
      albertaHealthcareNumber: child.albertaHealthcareNumber || '',
      allergies: child.allergies || '',
      generalHealth: child.generalHealth || '',
      medicalNotes: child.medicalNotes || '',
      parentNotes: child.parentNotes || '',
    });
    setShowEditModal(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  };

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

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        dateOfBirth: selectedDate.toISOString(),
      });
    }
  };

  const renderChildForm = () => (
    <ScrollView style={styles.modalContent}>
      <Text style={styles.modalTitle}>
        {showAddModal ? 'Add New Child' : 'Edit Child Profile'}
      </Text>

      <Text style={styles.inputLabel}>First Name *</Text>
      <TextInput
        style={styles.input}
        value={formData.firstName}
        onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        placeholder="Enter first name"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Last Name *</Text>
      <TextInput
        style={styles.input}
        value={formData.lastName}
        onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        placeholder="Enter last name"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Date of Birth *</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.6}
      >
        <Text style={styles.dateButtonText}>
          {formatDate(formData.dateOfBirth || new Date().toISOString())}
        </Text>
        <IconSymbol ios_icon_name="calendar" android_material_icon_name="calendar-today" size={20} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setFormData({ ...formData, isKindergarten: !formData.isKindergarten })}
        activeOpacity={0.6}
      >
        <View style={[styles.checkbox, formData.isKindergarten && styles.checkboxChecked]}>
          {formData.isKindergarten && (
            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color={colors.card} />
          )}
        </View>
        <Text style={styles.checkboxLabel}>Enrolled in Kindergarten</Text>
      </TouchableOpacity>

      <Text style={styles.inputLabel}>Street Address</Text>
      <TextInput
        style={styles.input}
        value={formData.street}
        onChangeText={(text) => setFormData({ ...formData, street: text })}
        placeholder="Street address"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>City</Text>
      <TextInput
        style={styles.input}
        value={formData.city}
        onChangeText={(text) => setFormData({ ...formData, city: text })}
        placeholder="City"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Province</Text>
      <TextInput
        style={styles.input}
        value={formData.province}
        onChangeText={(text) => setFormData({ ...formData, province: text })}
        placeholder="Province"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Postal Code</Text>
      <TextInput
        style={styles.input}
        value={formData.postalCode}
        onChangeText={(text) => setFormData({ ...formData, postalCode: text })}
        placeholder="A1A 1A1"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Alberta Healthcare Number</Text>
      <TextInput
        style={styles.input}
        value={formData.albertaHealthcareNumber}
        onChangeText={(text) => setFormData({ ...formData, albertaHealthcareNumber: text })}
        placeholder="Healthcare number"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.inputLabel}>Allergies</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.allergies}
        onChangeText={(text) => setFormData({ ...formData, allergies: text })}
        placeholder="List any allergies"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.inputLabel}>General Health</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.generalHealth}
        onChangeText={(text) => setFormData({ ...formData, generalHealth: text })}
        placeholder="General health information"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.inputLabel}>Medical Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.medicalNotes}
        onChangeText={(text) => setFormData({ ...formData, medicalNotes: text })}
        placeholder="Additional medical notes"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.inputLabel}>Parent Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.parentNotes}
        onChangeText={(text) => setFormData({ ...formData, parentNotes: text })}
        placeholder="Notes from parents"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
      />

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.cancelButton]}
          onPress={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            resetForm();
          }}
          activeOpacity={0.6}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButton, styles.saveButton]}
          onPress={showAddModal ? handleAddChild : handleUpdateChild}
          activeOpacity={0.6}
        >
          <Text style={styles.saveButtonText}>
            {showAddModal ? 'Add Child' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require('@/assets/images/5bf3058e-623b-4c52-af26-9d591fa00b37.png')} 
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <Text style={styles.loadingText}>Loading children...</Text>
        </View>
      </View>
    );
  }

  if (selectedChild) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedChild(null)}
            activeOpacity={0.6}
          >
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.primary} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(selectedChild)}
            activeOpacity={0.6}
          >
            <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            <View style={styles.profileHeader}>
              <IconSymbol 
                ios_icon_name="person.circle.fill" 
                android_material_icon_name="account-circle" 
                size={80} 
                color={colors.primary} 
              />
              <Text style={styles.profileName}>
                {selectedChild.firstName} {selectedChild.lastName}
              </Text>
              <Text style={styles.profileDob}>
                Born: {formatDate(selectedChild.dateOfBirth)}
              </Text>
            </View>

            {selectedChild.parents && selectedChild.parents.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Parents / Guardians</Text>
                {selectedChild.parents.map((parent, index) => (
                  <View key={index} style={styles.card}>
                    <View style={styles.parentHeader}>
                      <Text style={styles.parentName}>
                        {parent.firstName} {parent.lastName}
                      </Text>
                      {parent.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                        </View>
                      )}
                    </View>
                    {parent.relationship && (
                      <Text style={styles.infoText}>Relationship: {parent.relationship}</Text>
                    )}
                    {parent.phone && (
                      <Text style={styles.infoText}>Phone: {parent.phone}</Text>
                    )}
                    <Text style={styles.infoText}>Email: {parent.email}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.card}>
                {selectedChild.street && (
                  <Text style={styles.infoText}>{selectedChild.street}</Text>
                )}
                {(selectedChild.city || selectedChild.province || selectedChild.postalCode) && (
                  <Text style={styles.infoText}>
                    {[selectedChild.city, selectedChild.province, selectedChild.postalCode]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
                {!selectedChild.street && !selectedChild.city && (
                  <Text style={styles.emptyText}>No address on file</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Health Information</Text>
              <View style={styles.card}>
                {selectedChild.albertaHealthcareNumber && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Healthcare #:</Text>
                    <Text style={styles.infoValue}>{selectedChild.albertaHealthcareNumber}</Text>
                  </View>
                )}
                {selectedChild.allergies && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Allergies:</Text>
                    <Text style={styles.infoValue}>{selectedChild.allergies}</Text>
                  </View>
                )}
                {selectedChild.generalHealth && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>General Health:</Text>
                    <Text style={styles.infoValue}>{selectedChild.generalHealth}</Text>
                  </View>
                )}
                {selectedChild.medicalNotes && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Medical Notes:</Text>
                    <Text style={styles.infoValue}>{selectedChild.medicalNotes}</Text>
                  </View>
                )}
                {!selectedChild.albertaHealthcareNumber && !selectedChild.allergies && !selectedChild.generalHealth && !selectedChild.medicalNotes && (
                  <Text style={styles.emptyText}>No health information on file</Text>
                )}
              </View>
            </View>

            {selectedChild.siblings && selectedChild.siblings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Siblings in Centre</Text>
                {selectedChild.siblings.map((sibling, index) => (
                  <View key={index} style={styles.card}>
                    <Text style={styles.siblingName}>
                      {sibling.firstName} {sibling.lastName}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteChild(selectedChild.id)}
              activeOpacity={0.6}
            >
              <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color={colors.card} />
              <Text style={styles.deleteButtonText}>Delete Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image 
            source={require('@/assets/images/0d957812-ddb0-46c4-95b8-853537479c50.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Children Profiles</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            console.log('[ChildrenScreen] Add button pressed');
            resetForm();
            setShowAddModal(true);
          }}
          activeOpacity={0.6}
        >
          <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color={colors.card} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {children.length > 0 ? (
            children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={styles.childCard}
                onPress={() => {
                  console.log('[ChildrenScreen] Child card pressed:', child.id);
                  loadChildDetails(child.id);
                }}
                activeOpacity={0.6}
              >
                <View style={styles.childCardContent}>
                  <IconSymbol 
                    ios_icon_name="person.circle.fill" 
                    android_material_icon_name="account-circle" 
                    size={48} 
                    color={colors.primary} 
                  />
                  <View style={styles.childCardInfo}>
                    <Text style={styles.childCardName}>
                      {child.firstName} {child.lastName}
                    </Text>
                    <Text style={styles.childCardDob}>
                      Born: {formatDate(child.dateOfBirth)}
                    </Text>
                    {child.parents && child.parents.length > 0 && (
                      <Text style={styles.childCardParents}>
                        Parents: {child.parents.map(p => `${p.firstName} ${p.lastName}`).join(', ')}
                      </Text>
                    )}
                  </View>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron-right" 
                    size={24} 
                    color={colors.textSecondary} 
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <IconSymbol 
                ios_icon_name="person.3" 
                android_material_icon_name="group" 
                size={64} 
                color={colors.textSecondary} 
              />
              <Text style={styles.emptyTitle}>No Children Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to add a child profile
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showAddModal || showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          {renderChildForm()}
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(formData.dateOfBirth || new Date())}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
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
  },
  childCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  childCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  childCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  childCardDob: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  childCardParents: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 24,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
  profileDob: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  parentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  parentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  primaryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  siblingName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: '#DC3545',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 60 : 60,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
});
