
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Image, TextInput, Modal } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
}

interface DailyReport {
  id: string;
  childId: string;
  childName: string;
  date: string;
  mealsTaken?: {
    breakfast?: string;
    lunch?: string;
    snack?: string;
    dinner?: string;
  };
  napTime?: {
    startTime?: string;
    endTime?: string;
    duration?: string;
  };
  activities?: string;
  mood?: string;
  notes?: string;
  photos?: string[];
  createdAt: string;
}

const MOOD_OPTIONS = ['happy', 'sad', 'tired', 'energetic', 'fussy', 'calm'];
const MEAL_OPTIONS = ['ate all', 'ate most', 'ate half', 'ate some', 'ate little', 'did not eat'];

export default function DailyReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerField, setTimePickerField] = useState<'napStart' | 'napEnd' | null>(null);

  // TEMPORARILY HARDCODED TO SHOW STAFF VIEW
  const userRole = 'staff';

  // Form state
  const [formData, setFormData] = useState<{
    childId: string;
    date: string;
    mealsTaken: {
      breakfast?: string;
      lunch?: string;
      snack?: string;
      dinner?: string;
    };
    napTime: {
      startTime?: string;
      endTime?: string;
      duration?: string;
    };
    activities: string;
    mood: string;
    notes: string;
  }>({
    childId: '',
    date: new Date().toISOString(),
    mealsTaken: {},
    napTime: {},
    activities: '',
    mood: 'happy',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (userRole === 'staff') {
        await loadStaffData();
      } else {
        await loadParentData();
      }
    } catch (error) {
      console.error('[DailyReports] Error loading data:', error);
      Alert.alert('Error', 'Failed to load daily reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffData = async () => {
    try {
      console.log('[DailyReports] Loading staff daily reports...');
      const reportsData = await authenticatedGet<DailyReport[]>('/api/staff/daily-reports');
      console.log('[DailyReports] Reports loaded:', reportsData);
      setReports(reportsData);

      // Load children list for creating new reports
      const childrenData = await authenticatedGet<Child[]>('/api/profiles/children');
      console.log('[DailyReports] Children loaded:', childrenData);
      setChildren(childrenData);
    } catch (error) {
      console.error('[DailyReports] Error loading staff data:', error);
      throw error;
    }
  };

  const loadParentData = async () => {
    try {
      console.log('[DailyReports] Loading parent daily reports...');
      const reportsData = await authenticatedGet<DailyReport[]>('/api/parent/daily-reports');
      console.log('[DailyReports] Reports loaded:', reportsData);
      setReports(reportsData);
    } catch (error) {
      console.error('[DailyReports] Error loading parent data:', error);
      throw error;
    }
  };

  const handleCreateReport = async () => {
    if (!formData.childId) {
      Alert.alert('Error', 'Please select a child.');
      return;
    }

    try {
      console.log('[DailyReports] Creating report:', formData);
      await authenticatedPost('/api/staff/daily-reports', formData);
      Alert.alert('Success', 'Daily report created successfully!');
      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('[DailyReports] Error creating report:', error);
      Alert.alert('Error', 'Failed to create daily report.');
    }
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;

    try {
      console.log('[DailyReports] Updating report:', selectedReport.id, formData);
      await authenticatedPut(`/api/staff/daily-reports/${selectedReport.id}`, {
        mealsTaken: formData.mealsTaken,
        napTime: formData.napTime,
        activities: formData.activities,
        mood: formData.mood,
        notes: formData.notes,
      });
      Alert.alert('Success', 'Daily report updated successfully!');
      setShowEditModal(false);
      setSelectedReport(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('[DailyReports] Error updating report:', error);
      Alert.alert('Error', 'Failed to update daily report.');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this daily report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authenticatedDelete(`/api/staff/daily-reports/${reportId}`);
              Alert.alert('Success', 'Daily report deleted.');
              setSelectedReport(null);
              loadData();
            } catch (error) {
              console.error('[DailyReports] Error deleting report:', error);
              Alert.alert('Error', 'Failed to delete daily report.');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      childId: '',
      date: new Date().toISOString(),
      mealsTaken: {},
      napTime: {},
      activities: '',
      mood: 'happy',
      notes: '',
    });
  };

  const openEditModal = (report: DailyReport) => {
    setFormData({
      childId: report.childId,
      date: report.date,
      mealsTaken: report.mealsTaken || {},
      napTime: report.napTime || {},
      activities: report.activities || '',
      mood: report.mood || 'happy',
      notes: report.notes || '',
    });
    setSelectedReport(report);
    setShowEditModal(true);
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

  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({
        ...formData,
        date: selectedDate.toISOString(),
      });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime && timePickerField) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;

      if (timePickerField === 'napStart') {
        setFormData({
          ...formData,
          napTime: {
            ...formData.napTime,
            startTime: timeString,
          },
        });
      } else if (timePickerField === 'napEnd') {
        setFormData({
          ...formData,
          napTime: {
            ...formData.napTime,
            endTime: timeString,
          },
        });
      }
      setTimePickerField(null);
    }
  };

  const renderReportForm = () => (
    <ScrollView style={styles.modalContent}>
      <Text style={styles.modalTitle}>
        {showAddModal ? 'Create Daily Report' : 'Edit Daily Report'}
      </Text>

      {showAddModal && (
        <>
          <Text style={styles.inputLabel}>Select Child *</Text>
          <View style={styles.childSelector}>
            {children.map((child) => (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childOption,
                  formData.childId === child.id && styles.childOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, childId: child.id })}
              >
                <Text
                  style={[
                    styles.childOptionText,
                    formData.childId === child.id && styles.childOptionTextSelected,
                  ]}
                >
                  {child.firstName} {child.lastName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Date *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {formatDate(formData.date)}
            </Text>
            <IconSymbol ios_icon_name="calendar" android_material_icon_name="calendar-today" size={20} color={colors.primary} />
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>Meals</Text>
      
      <Text style={styles.inputLabel}>Breakfast</Text>
      <View style={styles.mealOptions}>
        {MEAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.mealOption,
              formData.mealsTaken.breakfast === option && styles.mealOptionSelected,
            ]}
            onPress={() =>
              setFormData({
                ...formData,
                mealsTaken: { ...formData.mealsTaken, breakfast: option },
              })
            }
          >
            <Text
              style={[
                styles.mealOptionText,
                formData.mealsTaken.breakfast === option && styles.mealOptionTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Lunch</Text>
      <View style={styles.mealOptions}>
        {MEAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.mealOption,
              formData.mealsTaken.lunch === option && styles.mealOptionSelected,
            ]}
            onPress={() =>
              setFormData({
                ...formData,
                mealsTaken: { ...formData.mealsTaken, lunch: option },
              })
            }
          >
            <Text
              style={[
                styles.mealOptionText,
                formData.mealsTaken.lunch === option && styles.mealOptionTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Snack</Text>
      <View style={styles.mealOptions}>
        {MEAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.mealOption,
              formData.mealsTaken.snack === option && styles.mealOptionSelected,
            ]}
            onPress={() =>
              setFormData({
                ...formData,
                mealsTaken: { ...formData.mealsTaken, snack: option },
              })
            }
          >
            <Text
              style={[
                styles.mealOptionText,
                formData.mealsTaken.snack === option && styles.mealOptionTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Nap Time</Text>
      
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Text style={styles.inputLabel}>Start Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setTimePickerField('napStart');
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.timeButtonText}>
              {formData.napTime.startTime ? formatTime(formData.napTime.startTime) : 'Select'}
            </Text>
            <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.timeField}>
          <Text style={styles.inputLabel}>End Time</Text>
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setTimePickerField('napEnd');
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.timeButtonText}>
              {formData.napTime.endTime ? formatTime(formData.napTime.endTime) : 'Select'}
            </Text>
            <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.inputLabel}>Duration (optional)</Text>
      <TextInput
        style={styles.input}
        value={formData.napTime.duration}
        onChangeText={(text) =>
          setFormData({
            ...formData,
            napTime: { ...formData.napTime, duration: text },
          })
        }
        placeholder="e.g., 2 hours"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.sectionTitle}>Activities & Mood</Text>

      <Text style={styles.inputLabel}>Activities</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.activities}
        onChangeText={(text) => setFormData({ ...formData, activities: text })}
        placeholder="Describe activities (e.g., painting, outdoor play, story time)"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.inputLabel}>Mood</Text>
      <View style={styles.moodOptions}>
        {MOOD_OPTIONS.map((mood) => (
          <TouchableOpacity
            key={mood}
            style={[
              styles.moodOption,
              formData.mood === mood && styles.moodOptionSelected,
            ]}
            onPress={() => setFormData({ ...formData, mood })}
          >
            <Text
              style={[
                styles.moodOptionText,
                formData.mood === mood && styles.moodOptionTextSelected,
              ]}
            >
              {mood}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Additional Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
        placeholder="Any additional notes for parents"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={4}
      />

      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.cancelButton]}
          onPress={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedReport(null);
            resetForm();
          }}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalButton, styles.saveButton]}
          onPress={showAddModal ? handleCreateReport : handleUpdateReport}
        >
          <Text style={styles.saveButtonText}>
            {showAddModal ? 'Create Report' : 'Save Changes'}
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
          <Text style={styles.loadingText}>Loading daily reports...</Text>
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
          <Text style={styles.headerTitle}>Daily Reports</Text>
        </View>
        {userRole === 'staff' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color={colors.card} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {reports.length > 0 ? (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportHeaderLeft}>
                    <IconSymbol 
                      ios_icon_name="person.circle.fill" 
                      android_material_icon_name="account-circle" 
                      size={40} 
                      color={colors.primary} 
                    />
                    <View style={styles.reportHeaderInfo}>
                      <Text style={styles.reportChildName}>{report.childName}</Text>
                      <Text style={styles.reportDate}>{formatDate(report.date)}</Text>
                    </View>
                  </View>
                  {userRole === 'staff' && (
                    <View style={styles.reportActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => openEditModal(report)}
                      >
                        <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteReport(report.id)}
                      >
                        <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={20} color="#DC3545" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {report.mealsTaken && Object.keys(report.mealsTaken).length > 0 && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="fork.knife" android_material_icon_name="restaurant" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Meals</Text>
                    </View>
                    {report.mealsTaken.breakfast && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Breakfast:</Text>
                        <Text style={styles.reportValue}>{report.mealsTaken.breakfast}</Text>
                      </View>
                    )}
                    {report.mealsTaken.lunch && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Lunch:</Text>
                        <Text style={styles.reportValue}>{report.mealsTaken.lunch}</Text>
                      </View>
                    )}
                    {report.mealsTaken.snack && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Snack:</Text>
                        <Text style={styles.reportValue}>{report.mealsTaken.snack}</Text>
                      </View>
                    )}
                  </View>
                )}

                {report.napTime && (report.napTime.startTime || report.napTime.endTime || report.napTime.duration) && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="moon.zzz.fill" android_material_icon_name="bedtime" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Nap Time</Text>
                    </View>
                    {report.napTime.startTime && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Start:</Text>
                        <Text style={styles.reportValue}>{formatTime(report.napTime.startTime)}</Text>
                      </View>
                    )}
                    {report.napTime.endTime && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>End:</Text>
                        <Text style={styles.reportValue}>{formatTime(report.napTime.endTime)}</Text>
                      </View>
                    )}
                    {report.napTime.duration && (
                      <View style={styles.reportRow}>
                        <Text style={styles.reportLabel}>Duration:</Text>
                        <Text style={styles.reportValue}>{report.napTime.duration}</Text>
                      </View>
                    )}
                  </View>
                )}

                {report.activities && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Activities</Text>
                    </View>
                    <Text style={styles.reportText}>{report.activities}</Text>
                  </View>
                )}

                {report.mood && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="face.smiling" android_material_icon_name="sentiment-satisfied" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Mood</Text>
                    </View>
                    <View style={styles.moodBadge}>
                      <Text style={styles.moodBadgeText}>{report.mood}</Text>
                    </View>
                  </View>
                )}

                {report.notes && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="note.text" android_material_icon_name="description" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Notes</Text>
                    </View>
                    <Text style={styles.reportText}>{report.notes}</Text>
                  </View>
                )}
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
              <Text style={styles.emptyTitle}>No Daily Reports Yet</Text>
              <Text style={styles.emptySubtitle}>
                {userRole === 'staff' 
                  ? 'Tap the + button to create a daily report' 
                  : 'Daily reports will appear here once staff creates them'}
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
          setSelectedReport(null);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          {renderReportForm()}
        </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(formData.date)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
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
  reportCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportHeaderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  reportChildName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  reportDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  reportSection: {
    marginBottom: 16,
  },
  reportSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 8,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reportLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  reportValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  reportText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  moodBadge: {
    backgroundColor: colors.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  moodBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
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
    paddingHorizontal: 40,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
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
    minHeight: 100,
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
  childSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  childOption: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  childOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  childOptionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  childOptionTextSelected: {
    color: colors.card,
  },
  mealOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  mealOption: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mealOptionSelected: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  mealOptionText: {
    fontSize: 13,
    color: colors.text,
  },
  mealOptionTextSelected: {
    color: colors.card,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  moodOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  moodOption: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moodOptionSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  moodOptionText: {
    fontSize: 14,
    color: colors.text,
    textTransform: 'capitalize',
  },
  moodOptionTextSelected: {
    color: colors.card,
    fontWeight: '600',
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
