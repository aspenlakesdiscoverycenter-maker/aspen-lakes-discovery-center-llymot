
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform, Alert, Image, TextInput, Modal } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
}

interface MediaItem {
  url: string;
  uploadedAt: string;
}

interface MedicationReport {
  medicationName: string;
  dosage: string;
  time: string;
  administeredBy: string;
  notes: string;
}

interface IncidentReport {
  type: string;
  description: string;
  time: string;
  actionTaken: string;
  reportedBy: string;
  severity: string;
}

interface Reaction {
  id: string;
  parentId: string;
  parentName: string;
  reactionType: string;
  createdAt: string;
}

interface Comment {
  id: string;
  parentId: string;
  parentName: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
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
  mealDescriptions?: {
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
  photos?: MediaItem[];
  videos?: MediaItem[];
  medicationReport?: MedicationReport;
  incidentReport?: IncidentReport;
  reactions?: Reaction[];
  comments?: Comment[];
  createdAt: string;
}

const MOOD_OPTIONS = ['happy', 'sad', 'tired', 'energetic', 'fussy', 'calm'];
const MEAL_OPTIONS = ['ate all', 'ate most', 'ate half', 'ate some', 'ate little', 'did not eat'];
const REACTION_TYPES = ['heart', 'thumbs_up', 'smile', 'love'];
const INCIDENT_TYPES = ['minor injury', 'illness', 'behavior', 'accident', 'other'];
const SEVERITY_LEVELS = ['low', 'medium', 'high'];

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
  const [timePickerField, setTimePickerField] = useState<'napStart' | 'napEnd' | 'medicationTime' | 'incidentTime' | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');

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
    mealDescriptions: {
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
    photos: MediaItem[];
    videos: MediaItem[];
    medicationReport?: MedicationReport;
    incidentReport?: IncidentReport;
  }>({
    childId: '',
    date: new Date().toISOString(),
    mealsTaken: {},
    mealDescriptions: {},
    napTime: {},
    activities: '',
    mood: 'happy',
    notes: '',
    photos: [],
    videos: [],
  });

  const loadStaffData = useCallback(async () => {
    try {
      console.log('[DailyReports] Loading staff daily reports...');
      const reportsData = await authenticatedGet<DailyReport[]>('/api/staff/daily-reports');
      console.log('[DailyReports] Reports loaded:', reportsData);
      setReports(reportsData);

      const childrenData = await authenticatedGet<Child[]>('/api/profiles/children');
      console.log('[DailyReports] Children loaded:', childrenData);
      setChildren(childrenData);
    } catch (error) {
      console.error('[DailyReports] Error loading staff data:', error);
      throw error;
    }
  }, []);

  const loadParentData = useCallback(async () => {
    try {
      console.log('[DailyReports] Loading parent daily reports...');
      const reportsData = await authenticatedGet<DailyReport[]>('/api/parent/daily-reports');
      console.log('[DailyReports] Reports loaded:', reportsData);
      setReports(reportsData);
    } catch (error) {
      console.error('[DailyReports] Error loading parent data:', error);
      throw error;
    }
  }, []);

  const loadData = useCallback(async () => {
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
  }, [userRole, loadStaffData, loadParentData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadVideo(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photo', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload/report-photo`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFormData({
        ...formData,
        photos: [...formData.photos, { url: data.url, uploadedAt: data.uploadedAt }],
      });
      Alert.alert('Success', 'Photo uploaded successfully!');
    } catch (error) {
      console.error('[DailyReports] Error uploading photo:', error);
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const uploadVideo = async (uri: string) => {
    setUploadingMedia(true);
    try {
      const formDataToUpload = new FormData();
      const filename = uri.split('/').pop() || 'video.mp4';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `video/${match[1]}` : 'video/mp4';

      formDataToUpload.append('video', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/upload/report-video`, {
        method: 'POST',
        body: formDataToUpload,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setFormData({
        ...formData,
        videos: [...formData.videos, { url: data.url, uploadedAt: data.uploadedAt }],
      });
      Alert.alert('Success', 'Video uploaded successfully!');
    } catch (error) {
      console.error('[DailyReports] Error uploading video:', error);
      Alert.alert('Error', 'Failed to upload video. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...formData.photos];
    newPhotos.splice(index, 1);
    setFormData({ ...formData, photos: newPhotos });
  };

  const removeVideo = (index: number) => {
    const newVideos = [...formData.videos];
    newVideos.splice(index, 1);
    setFormData({ ...formData, videos: newVideos });
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
        mealDescriptions: formData.mealDescriptions,
        napTime: formData.napTime,
        activities: formData.activities,
        mood: formData.mood,
        notes: formData.notes,
        photos: formData.photos,
        videos: formData.videos,
        medicationReport: formData.medicationReport,
        incidentReport: formData.incidentReport,
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

  const handleReaction = async (reportId: string, reactionType: string) => {
    try {
      await authenticatedPost(`/api/parent/daily-reports/${reportId}/reactions`, { reactionType });
      loadData();
    } catch (error) {
      console.error('[DailyReports] Error adding reaction:', error);
      Alert.alert('Error', 'Failed to add reaction.');
    }
  };

  const handleRemoveReaction = async (reportId: string) => {
    try {
      await authenticatedDelete(`/api/parent/daily-reports/${reportId}/reactions`);
      loadData();
    } catch (error) {
      console.error('[DailyReports] Error removing reaction:', error);
      Alert.alert('Error', 'Failed to remove reaction.');
    }
  };

  const handleAddComment = async (reportId: string) => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment.');
      return;
    }

    try {
      await authenticatedPost(`/api/parent/daily-reports/${reportId}/comments`, { comment: commentText });
      setCommentText('');
      setShowCommentModal(false);
      setSelectedReport(null);
      loadData();
      Alert.alert('Success', 'Comment added!');
    } catch (error) {
      console.error('[DailyReports] Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment.');
    }
  };

  const resetForm = () => {
    setFormData({
      childId: '',
      date: new Date().toISOString(),
      mealsTaken: {},
      mealDescriptions: {},
      napTime: {},
      activities: '',
      mood: 'happy',
      notes: '',
      photos: [],
      videos: [],
    });
  };

  const openEditModal = (report: DailyReport) => {
    setFormData({
      childId: report.childId,
      date: report.date,
      mealsTaken: report.mealsTaken || {},
      mealDescriptions: report.mealDescriptions || {},
      napTime: report.napTime || {},
      activities: report.activities || '',
      mood: report.mood || 'happy',
      notes: report.notes || '',
      photos: report.photos || [],
      videos: report.videos || [],
      medicationReport: report.medicationReport,
      incidentReport: report.incidentReport,
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
      } else if (timePickerField === 'medicationTime') {
        setFormData({
          ...formData,
          medicationReport: {
            ...formData.medicationReport!,
            time: timeString,
          },
        });
      } else if (timePickerField === 'incidentTime') {
        setFormData({
          ...formData,
          incidentReport: {
            ...formData.incidentReport!,
            time: timeString,
          },
        });
      }
      setTimePickerField(null);
    }
  };

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'heart': return '❤️';
      case 'thumbs_up': return '👍';
      case 'smile': return '😊';
      case 'love': return '🥰';
      default: return '👍';
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
      
      {['breakfast', 'lunch', 'snack'].map((mealType) => (
        <View key={mealType}>
          <Text style={styles.inputLabel}>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</Text>
          <View style={styles.mealOptions}>
            {MEAL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.mealOption,
                  formData.mealsTaken[mealType as keyof typeof formData.mealsTaken] === option && styles.mealOptionSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    mealsTaken: { ...formData.mealsTaken, [mealType]: option },
                  })
                }
              >
                <Text
                  style={[
                    styles.mealOptionText,
                    formData.mealsTaken[mealType as keyof typeof formData.mealsTaken] === option && styles.mealOptionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={formData.mealDescriptions[mealType as keyof typeof formData.mealDescriptions]}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                mealDescriptions: { ...formData.mealDescriptions, [mealType]: text },
              })
            }
            placeholder={`What was served for ${mealType}?`}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      ))}

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

      <Text style={styles.sectionTitle}>Photos & Videos</Text>
      
      <View style={styles.mediaButtons}>
        <TouchableOpacity
          style={styles.mediaButton}
          onPress={pickImage}
          disabled={uploadingMedia}
        >
          <IconSymbol ios_icon_name="photo" android_material_icon_name="photo" size={24} color={colors.primary} />
          <Text style={styles.mediaButtonText}>Add Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mediaButton}
          onPress={pickVideo}
          disabled={uploadingMedia}
        >
          <IconSymbol ios_icon_name="video" android_material_icon_name="videocam" size={24} color={colors.primary} />
          <Text style={styles.mediaButtonText}>Add Video</Text>
        </TouchableOpacity>
      </View>

      {formData.photos.length > 0 && (
        <View style={styles.mediaGrid}>
          {formData.photos.map((photo, index) => (
            <View key={index} style={styles.mediaItem}>
              <Image source={{ uri: photo.url }} style={styles.mediaThumbnail} />
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => removePhoto(index)}
              >
                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={24} color="#DC3545" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {formData.videos.length > 0 && (
        <View style={styles.mediaGrid}>
          {formData.videos.map((video, index) => (
            <View key={index} style={styles.mediaItem}>
              <View style={styles.videoPlaceholder}>
                <IconSymbol ios_icon_name="play.circle.fill" android_material_icon_name="play-circle-filled" size={48} color={colors.primary} />
              </View>
              <TouchableOpacity
                style={styles.removeMediaButton}
                onPress={() => removeVideo(index)}
              >
                <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={24} color="#DC3545" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Medication Report (Optional)</Text>
      <TouchableOpacity
        style={styles.addReportButton}
        onPress={() => {
          if (formData.medicationReport) {
            setFormData({ ...formData, medicationReport: undefined });
          } else {
            setFormData({
              ...formData,
              medicationReport: {
                medicationName: '',
                dosage: '',
                time: '',
                administeredBy: '',
                notes: '',
              },
            });
          }
        }}
      >
        <Text style={styles.addReportButtonText}>
          {formData.medicationReport ? 'Remove Medication Report' : 'Add Medication Report'}
        </Text>
      </TouchableOpacity>

      {formData.medicationReport && (
        <View style={styles.reportSection}>
          <TextInput
            style={styles.input}
            value={formData.medicationReport.medicationName}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                medicationReport: { ...formData.medicationReport!, medicationName: text },
              })
            }
            placeholder="Medication Name"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={formData.medicationReport.dosage}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                medicationReport: { ...formData.medicationReport!, dosage: text },
              })
            }
            placeholder="Dosage"
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setTimePickerField('medicationTime');
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.timeButtonText}>
              {formData.medicationReport.time ? formatTime(formData.medicationReport.time) : 'Select Time'}
            </Text>
            <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={formData.medicationReport.administeredBy}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                medicationReport: { ...formData.medicationReport!, administeredBy: text },
              })
            }
            placeholder="Administered By"
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.medicationReport.notes}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                medicationReport: { ...formData.medicationReport!, notes: text },
              })
            }
            placeholder="Notes"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Incident Report (Optional)</Text>
      <TouchableOpacity
        style={styles.addReportButton}
        onPress={() => {
          if (formData.incidentReport) {
            setFormData({ ...formData, incidentReport: undefined });
          } else {
            setFormData({
              ...formData,
              incidentReport: {
                type: 'minor injury',
                description: '',
                time: '',
                actionTaken: '',
                reportedBy: '',
                severity: 'low',
              },
            });
          }
        }}
      >
        <Text style={styles.addReportButtonText}>
          {formData.incidentReport ? 'Remove Incident Report' : 'Add Incident Report'}
        </Text>
      </TouchableOpacity>

      {formData.incidentReport && (
        <View style={styles.reportSection}>
          <Text style={styles.inputLabel}>Incident Type</Text>
          <View style={styles.mealOptions}>
            {INCIDENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.mealOption,
                  formData.incidentReport?.type === type && styles.mealOptionSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    incidentReport: { ...formData.incidentReport!, type },
                  })
                }
              >
                <Text
                  style={[
                    styles.mealOptionText,
                    formData.incidentReport?.type === type && styles.mealOptionTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.incidentReport.description}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                incidentReport: { ...formData.incidentReport!, description: text },
              })
            }
            placeholder="Description"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={styles.timeButton}
            onPress={() => {
              setTimePickerField('incidentTime');
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.timeButtonText}>
              {formData.incidentReport.time ? formatTime(formData.incidentReport.time) : 'Select Time'}
            </Text>
            <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.incidentReport.actionTaken}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                incidentReport: { ...formData.incidentReport!, actionTaken: text },
              })
            }
            placeholder="Action Taken"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={styles.input}
            value={formData.incidentReport.reportedBy}
            onChangeText={(text) =>
              setFormData({
                ...formData,
                incidentReport: { ...formData.incidentReport!, reportedBy: text },
              })
            }
            placeholder="Reported By"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={styles.inputLabel}>Severity</Text>
          <View style={styles.mealOptions}>
            {SEVERITY_LEVELS.map((severity) => (
              <TouchableOpacity
                key={severity}
                style={[
                  styles.mealOption,
                  formData.incidentReport?.severity === severity && styles.mealOptionSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    incidentReport: { ...formData.incidentReport!, severity },
                  })
                }
              >
                <Text
                  style={[
                    styles.mealOptionText,
                    formData.incidentReport?.severity === severity && styles.mealOptionTextSelected,
                  ]}
                >
                  {severity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
                    {Object.entries(report.mealsTaken).map(([mealType, amount]) => (
                      <View key={mealType}>
                        <View style={styles.reportRow}>
                          <Text style={styles.reportLabel}>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}:</Text>
                          <Text style={styles.reportValue}>{amount}</Text>
                        </View>
                        {report.mealDescriptions?.[mealType as keyof typeof report.mealDescriptions] && (
                          <Text style={styles.mealDescription}>
                            {report.mealDescriptions[mealType as keyof typeof report.mealDescriptions]}
                          </Text>
                        )}
                      </View>
                    ))}
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

                {report.photos && report.photos.length > 0 && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="photo" android_material_icon_name="photo" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Photos</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.mediaGallery}>
                        {report.photos.map((photo, index) => (
                          <Image key={index} source={{ uri: photo.url }} style={styles.galleryImage} />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {report.videos && report.videos.length > 0 && (
                  <View style={styles.reportSection}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="video" android_material_icon_name="videocam" size={20} color={colors.secondary} />
                      <Text style={styles.reportSectionTitle}>Videos</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.mediaGallery}>
                        {report.videos.map((video, index) => (
                          <View key={index} style={styles.videoThumbnail}>
                            <IconSymbol ios_icon_name="play.circle.fill" android_material_icon_name="play-circle-filled" size={48} color={colors.primary} />
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                {report.medicationReport && (
                  <View style={[styles.reportSection, styles.alertSection]}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="pills.fill" android_material_icon_name="medication" size={20} color="#DC3545" />
                      <Text style={[styles.reportSectionTitle, styles.alertTitle]}>Medication Report</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Medication:</Text>
                      <Text style={styles.reportValue}>{report.medicationReport.medicationName}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Dosage:</Text>
                      <Text style={styles.reportValue}>{report.medicationReport.dosage}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Time:</Text>
                      <Text style={styles.reportValue}>{formatTime(report.medicationReport.time)}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Administered By:</Text>
                      <Text style={styles.reportValue}>{report.medicationReport.administeredBy}</Text>
                    </View>
                    {report.medicationReport.notes && (
                      <Text style={styles.reportText}>{report.medicationReport.notes}</Text>
                    )}
                  </View>
                )}

                {report.incidentReport && (
                  <View style={[styles.reportSection, styles.alertSection]}>
                    <View style={styles.reportSectionHeader}>
                      <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={20} color="#FFC107" />
                      <Text style={[styles.reportSectionTitle, styles.alertTitle]}>Incident Report</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Type:</Text>
                      <Text style={styles.reportValue}>{report.incidentReport.type}</Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Severity:</Text>
                      <Text style={[styles.reportValue, styles.severityBadge, 
                        report.incidentReport.severity === 'high' && styles.severityHigh,
                        report.incidentReport.severity === 'medium' && styles.severityMedium,
                        report.incidentReport.severity === 'low' && styles.severityLow
                      ]}>
                        {report.incidentReport.severity}
                      </Text>
                    </View>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Time:</Text>
                      <Text style={styles.reportValue}>{formatTime(report.incidentReport.time)}</Text>
                    </View>
                    <Text style={styles.reportText}>{report.incidentReport.description}</Text>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Action Taken:</Text>
                    </View>
                    <Text style={styles.reportText}>{report.incidentReport.actionTaken}</Text>
                    <View style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Reported By:</Text>
                      <Text style={styles.reportValue}>{report.incidentReport.reportedBy}</Text>
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

                {userRole === 'parent' && (
                  <View style={styles.interactionSection}>
                    <View style={styles.reactionsRow}>
                      {REACTION_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={styles.reactionButton}
                          onPress={() => handleReaction(report.id, type)}
                        >
                          <Text style={styles.reactionEmoji}>{getReactionIcon(type)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {report.reactions && report.reactions.length > 0 && (
                      <View style={styles.reactionsDisplay}>
                        {report.reactions.map((reaction) => (
                          <View key={reaction.id} style={styles.reactionItem}>
                            <Text style={styles.reactionEmoji}>{getReactionIcon(reaction.reactionType)}</Text>
                            <Text style={styles.reactionName}>{reaction.parentName}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.commentButton}
                      onPress={() => {
                        setSelectedReport(report);
                        setShowCommentModal(true);
                      }}
                    >
                      <IconSymbol ios_icon_name="bubble.left" android_material_icon_name="comment" size={20} color={colors.primary} />
                      <Text style={styles.commentButtonText}>Add Comment</Text>
                    </TouchableOpacity>
                    {report.comments && report.comments.length > 0 && (
                      <View style={styles.commentsSection}>
                        {report.comments.map((comment) => (
                          <View key={comment.id} style={styles.commentItem}>
                            <Text style={styles.commentAuthor}>{comment.parentName}</Text>
                            <Text style={styles.commentText}>{comment.comment}</Text>
                            <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
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

      <Modal
        visible={showCommentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowCommentModal(false);
          setCommentText('');
          setSelectedReport(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.commentModalContent}>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write your comment..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={6}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCommentModal(false);
                  setCommentText('');
                  setSelectedReport(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => selectedReport && handleAddComment(selectedReport.id)}
              >
                <Text style={styles.saveButtonText}>Post Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  mealDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
    marginLeft: 4,
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
  alertSection: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  alertTitle: {
    color: '#856404',
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  severityLow: {
    backgroundColor: '#28A745',
    color: '#FFF',
  },
  severityMedium: {
    backgroundColor: '#FFC107',
    color: '#000',
  },
  severityHigh: {
    backgroundColor: '#DC3545',
    color: '#FFF',
  },
  mediaGallery: {
    flexDirection: 'row',
    gap: 8,
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  videoThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interactionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reactionButton: {
    padding: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  reactionEmoji: {
    fontSize: 24,
  },
  reactionsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  reactionName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  commentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  commentsSection: {
    marginTop: 12,
    gap: 8,
  },
  commentItem: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 12,
    color: colors.textSecondary,
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
  commentModalContent: {
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
    marginBottom: 12,
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
    marginBottom: 12,
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
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mediaItem: {
    position: 'relative',
  },
  mediaThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  videoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  addReportButton: {
    padding: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addReportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
