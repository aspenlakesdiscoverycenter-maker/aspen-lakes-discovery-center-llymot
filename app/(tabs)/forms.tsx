
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Image, TextInput, Modal } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';

interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date';
  label: string;
  required: boolean;
  options?: string[];
  fieldMappingKey?: string;
}

interface Form {
  id: string;
  title: string;
  description?: string;
  content: {
    fields: FormField[];
  };
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
}

interface FormSubmission {
  id: string;
  formId: string;
  responses: Record<string, any>;
  status: 'draft' | 'submitted';
  submittedAt?: string;
}

export default function FormsScreen() {
  const { user } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'forms' | 'submissions'>('forms');

  // Form builder state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FormField['type']>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Form filling state
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});

  // Hardcoded role for now - in production this would come from user context
  const userRole = 'staff'; // or 'parent'

  const loadForms = useCallback(async () => {
    try {
      console.log('[FormsScreen] Loading forms...');
      // Use the correct endpoint based on user role
      const endpoint = userRole === 'parent' ? '/api/parent/forms' : '/api/forms';
      const data = await authenticatedGet<Form[]>(endpoint);
      console.log('[FormsScreen] Forms loaded:', data);
      setForms(data);
    } catch (error) {
      console.error('[FormsScreen] Error loading forms:', error);
      throw error;
    }
  }, [userRole]);

  const loadSubmissions = useCallback(async () => {
    try {
      console.log('[FormsScreen] Loading submissions...');
      // For parents, get their own submissions
      // For staff, they would need to specify a formId to get all submissions for that form
      // For now, we'll just show an empty state for staff
      if (userRole === 'parent') {
        // Parents can see their own submissions across all forms
        // We'll need to iterate through forms and get submissions for each
        const allSubmissions: FormSubmission[] = [];
        for (const form of forms) {
          try {
            const formSubmissions = await authenticatedGet<FormSubmission[]>(
              `/api/parent/form/${form.id}/submissions`
            );
            allSubmissions.push(...formSubmissions);
          } catch (error) {
            console.error(`[FormsScreen] Error loading submissions for form ${form.id}:`, error);
          }
        }
        setSubmissions(allSubmissions);
      } else {
        // Staff would need to select a specific form to view submissions
        setSubmissions([]);
      }
    } catch (error) {
      console.error('[FormsScreen] Error loading submissions:', error);
      throw error;
    }
  }, [userRole, forms]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'forms') {
        await loadForms();
      } else {
        await loadSubmissions();
      }
    } catch (error) {
      console.error('[FormsScreen] Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadForms, loadSubmissions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateForm = async () => {
    if (!formTitle || formFields.length === 0) {
      Alert.alert('Error', 'Please enter a title and add at least one field.');
      return;
    }

    try {
      console.log('[FormsScreen] Creating form...');
      await authenticatedPost('/api/forms', {
        title: formTitle,
        description: formDescription,
        content: {
          fields: formFields,
        },
        isActive: true,
      });
      Alert.alert('Success', 'Form created successfully!');
      setShowCreateModal(false);
      resetFormBuilder();
      loadForms();
    } catch (error) {
      console.error('[FormsScreen] Error creating form:', error);
      Alert.alert('Error', 'Failed to create form.');
    }
  };

  const handleAddField = () => {
    if (!newFieldLabel) {
      Alert.alert('Error', 'Please enter a field label.');
      return;
    }

    const fieldId = newFieldLabel.toLowerCase().replace(/\s+/g, '_');
    const newField: FormField = {
      id: fieldId,
      type: newFieldType,
      label: newFieldLabel,
      required: newFieldRequired,
    };

    setFormFields([...formFields, newField]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
  };

  const handleRemoveField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const handleSubmitForm = async () => {
    if (!selectedForm) return;

    // Validate required fields
    const missingFields = selectedForm.content.fields
      .filter(field => field.required && !formResponses[field.id])
      .map(field => field.label);

    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      console.log('[FormsScreen] Submitting form...');
      
      // Use the correct endpoint for parents
      await authenticatedPost(`/api/parent/form/${selectedForm.id}/submit`, {
        responses: formResponses,
      });

      Alert.alert('Success', 'Form submitted successfully!');
      setShowFillModal(false);
      setFormResponses({});
      setSelectedForm(null);
      loadSubmissions();
    } catch (error) {
      console.error('[FormsScreen] Error submitting form:', error);
      Alert.alert('Error', 'Failed to submit form.');
    }
  };

  const handleDeleteForm = async (formId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this form?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authenticatedDelete(`/api/forms/${formId}`);
              Alert.alert('Success', 'Form deleted.');
              loadForms();
            } catch (error) {
              console.error('[FormsScreen] Error deleting form:', error);
              Alert.alert('Error', 'Failed to delete form.');
            }
          },
        },
      ]
    );
  };

  const resetFormBuilder = () => {
    setFormTitle('');
    setFormDescription('');
    setFormFields([]);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldRequired(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
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

  const renderFormField = (field: FormField) => {
    switch (field.type) {
      case 'text':
        return (
          <TextInput
            style={styles.input}
            value={formResponses[field.id] || ''}
            onChangeText={(text) => setFormResponses({ ...formResponses, [field.id]: text })}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.textSecondary}
          />
        );
      case 'textarea':
        return (
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formResponses[field.id] || ''}
            onChangeText={(text) => setFormResponses({ ...formResponses, [field.id]: text })}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        );
      case 'checkbox':
        return (
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFormResponses({ 
              ...formResponses, 
              [field.id]: !formResponses[field.id] 
            })}
          >
            <View style={[styles.checkbox, formResponses[field.id] && styles.checkboxChecked]}>
              {formResponses[field.id] && (
                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color={colors.card} />
              )}
            </View>
            <Text style={styles.checkboxLabel}>{field.label}</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TextInput
            style={styles.input}
            value={formResponses[field.id] || ''}
            onChangeText={(text) => setFormResponses({ ...formResponses, [field.id]: text })}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.textSecondary}
          />
        );
    }
  };

  if (loading) {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Image 
            source={require('@/assets/images/0d957812-ddb0-46c4-95b8-853537479c50.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Forms</Text>
        </View>
        {userRole === 'staff' && activeTab === 'forms' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetFormBuilder();
              setShowCreateModal(true);
            }}
          >
            <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color={colors.card} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forms' && styles.activeTab]}
          onPress={() => setActiveTab('forms')}
        >
          <Text style={[styles.tabText, activeTab === 'forms' && styles.activeTabText]}>
            Forms
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'submissions' && styles.activeTab]}
          onPress={() => setActiveTab('submissions')}
        >
          <Text style={[styles.tabText, activeTab === 'submissions' && styles.activeTabText]}>
            Submissions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {activeTab === 'forms' ? (
            forms.length > 0 ? (
              forms.map((form) => (
                <View key={form.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.cardTitle}>{form.title}</Text>
                      {form.description && (
                        <Text style={styles.cardDescription}>{form.description}</Text>
                      )}
                      <Text style={styles.cardMeta}>
                        {form.content.fields.length} fields{form.createdAt ? ` • Created ${formatDate(form.createdAt)}` : ''}
                      </Text>
                    </View>
                    {form.isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    {userRole === 'parent' && (
                      <TouchableOpacity
                        style={styles.fillButton}
                        onPress={() => {
                          setSelectedForm(form);
                          setFormResponses({});
                          setShowFillModal(true);
                        }}
                      >
                        <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.card} />
                        <Text style={styles.fillButtonText}>Fill Out</Text>
                      </TouchableOpacity>
                    )}
                    {userRole === 'staff' && (
                      <TouchableOpacity
                        style={styles.deleteIconButton}
                        onPress={() => handleDeleteForm(form.id)}
                      >
                        <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#DC3545" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  ios_icon_name="doc.text" 
                  android_material_icon_name="description" 
                  size={64} 
                  color={colors.textSecondary} 
                />
                <Text style={styles.emptyTitle}>No Forms Yet</Text>
                <Text style={styles.emptySubtitle}>
                  {userRole === 'staff' 
                    ? 'Tap the + button to create a form'
                    : 'No forms available to fill out'}
                </Text>
              </View>
            )
          ) : (
            submissions.length > 0 ? (
              submissions.map((submission) => {
                const form = forms.find(f => f.id === submission.formId);
                return (
                  <View key={submission.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <Text style={styles.cardTitle}>{form?.title || 'Form Submission'}</Text>
                        <Text style={styles.cardMeta}>
                          {submission.submittedAt ? `Submitted ${formatDate(submission.submittedAt)}` : 'Draft'}
                        </Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        submission.status === 'submitted' && styles.submittedBadge
                      ]}>
                        <Text style={styles.statusBadgeText}>
                          {submission.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  ios_icon_name="doc.text" 
                  android_material_icon_name="description" 
                  size={64} 
                  color={colors.textSecondary} 
                />
                <Text style={styles.emptyTitle}>No Submissions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Form submissions will appear here
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Create Form Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetFormBuilder();
        }}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Form</Text>

            <Text style={styles.inputLabel}>Form Title *</Text>
            <TextInput
              style={styles.input}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Enter form title"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Enter form description"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.sectionTitle}>Form Fields</Text>

            {formFields.map((field, index) => (
              <View key={index} style={styles.fieldCard}>
                <View style={styles.fieldCardHeader}>
                  <Text style={styles.fieldCardTitle}>{field.label}</Text>
                  <TouchableOpacity onPress={() => handleRemoveField(index)}>
                    <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#DC3545" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldCardMeta}>
                  Type: {field.type} • {field.required ? 'Required' : 'Optional'}
                </Text>
              </View>
            ))}

            <View style={styles.addFieldSection}>
              <Text style={styles.inputLabel}>Add Field</Text>
              <TextInput
                style={styles.input}
                value={newFieldLabel}
                onChangeText={setNewFieldLabel}
                placeholder="Field label"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.inputLabel}>Field Type</Text>
              <View style={styles.fieldTypeButtons}>
                {(['text', 'textarea', 'checkbox'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.fieldTypeButton,
                      newFieldType === type && styles.fieldTypeButtonActive
                    ]}
                    onPress={() => setNewFieldType(type)}
                  >
                    <Text style={[
                      styles.fieldTypeButtonText,
                      newFieldType === type && styles.fieldTypeButtonTextActive
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNewFieldRequired(!newFieldRequired)}
              >
                <View style={[styles.checkbox, newFieldRequired && styles.checkboxChecked]}>
                  {newFieldRequired && (
                    <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={16} color={colors.card} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Required field</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addFieldButton}
                onPress={handleAddField}
              >
                <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={20} color={colors.primary} />
                <Text style={styles.addFieldButtonText}>Add Field</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  resetFormBuilder();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleCreateForm}
              >
                <Text style={styles.saveButtonText}>Create Form</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Fill Form Modal */}
      <Modal
        visible={showFillModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowFillModal(false);
          setFormResponses({});
          setSelectedForm(null);
        }}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            {selectedForm && (
              <>
                <Text style={styles.modalTitle}>{selectedForm.title}</Text>
                {selectedForm.description && (
                  <Text style={styles.formDescription}>{selectedForm.description}</Text>
                )}

                {selectedForm.content.fields.map((field, index) => (
                  <View key={index} style={styles.formFieldContainer}>
                    <Text style={styles.inputLabel}>
                      {field.label} {field.required && <Text style={styles.required}>*</Text>}
                    </Text>
                    {renderFormField(field)}
                  </View>
                ))}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowFillModal(false);
                      setFormResponses({});
                      setSelectedForm(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleSubmitForm}
                  >
                    <Text style={styles.saveButtonText}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  statusBadge: {
    backgroundColor: colors.textSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  submittedBadge: {
    backgroundColor: '#28A745',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  fillButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  fillButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  deleteIconButton: {
    padding: 8,
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
    marginBottom: 8,
  },
  formDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  required: {
    color: '#DC3545',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  fieldCard: {
    backgroundColor: colors.highlight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  fieldCardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addFieldSection: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  fieldTypeButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  fieldTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  fieldTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fieldTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  fieldTypeButtonTextActive: {
    color: colors.card,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  addFieldButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  formFieldContainer: {
    marginBottom: 16,
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
