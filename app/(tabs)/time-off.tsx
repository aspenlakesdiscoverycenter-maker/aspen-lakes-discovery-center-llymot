
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface TimeOffBalance {
  year: number;
  yearsOfEmployment: number;
  vacationDaysAllotted: number;
  vacationDaysUsed: number;
  vacationDaysAvailable: number;
  sickDaysAllotted: number;
  sickDaysUsed: number;
  sickDaysAvailable: number;
  unpaidDaysUsed: number;
}

interface TimeOffRequest {
  id: string;
  type: 'vacation' | 'sick' | 'unpaid';
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reason?: string;
  notes?: string;
  approvalDate?: string;
  approvalNotes?: string;
}

export default function TimeOffScreen() {
  const { user, loading: authLoading } = useAuth();
  const [balance, setBalance] = useState<TimeOffBalance | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Form state
  const [requestType, setRequestType] = useState<'vacation' | 'sick' | 'unpaid'>('vacation');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [daysRequested, setDaysRequested] = useState('1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [user, authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('[TimeOff] Loading time-off data...');
      
      // Load balance
      const balanceData = await authenticatedGet<TimeOffBalance>('/api/timeoff/balance');
      console.log('[TimeOff] Balance:', balanceData);
      setBalance(balanceData);

      // Load requests
      const requestsData = await authenticatedGet<TimeOffRequest[]>('/api/timeoff/requests');
      console.log('[TimeOff] Requests:', requestsData);
      setRequests(requestsData);
    } catch (error) {
      console.error('[TimeOff] Error loading data:', error);
      Alert.alert('Error', 'Failed to load time-off data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('[TimeOff] Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmitRequest = async () => {
    // Validate inputs
    if (!daysRequested || parseFloat(daysRequested) <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of days.');
      return;
    }

    if (startDate > endDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date.');
      return;
    }

    const days = parseFloat(daysRequested);

    // Check balance for paid time off
    if (requestType === 'vacation' && balance && days > balance.vacationDaysAvailable) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${balance.vacationDaysAvailable} paid vacation days available.`
      );
      return;
    }

    if (requestType === 'sick' && balance && days > balance.sickDaysAvailable) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${balance.sickDaysAvailable} paid sick days available.`
      );
      return;
    }

    setSubmitting(true);
    try {
      console.log('[TimeOff] Submitting request...');
      
      const requestData = {
        type: requestType,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        daysRequested: days,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await authenticatedPost('/api/timeoff/request', requestData);
      
      Alert.alert('Success', 'Your time-off request has been submitted for approval.');
      
      // Reset form
      setShowRequestModal(false);
      setRequestType('vacation');
      setStartDate(new Date());
      setEndDate(new Date());
      setDaysRequested('1');
      setReason('');
      setNotes('');
      
      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('[TimeOff] Error submitting request:', error);
      Alert.alert('Error', error.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const getRequestTypeLabel = (type: string): string => {
    switch (type) {
      case 'vacation':
        return 'Vacation';
      case 'sick':
        return 'Sick Leave';
      case 'unpaid':
        return 'Unpaid Leave';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return '#4CAF50';
      case 'denied':
        return '#F44336';
      case 'pending':
        return '#FF9800';
      default:
        return colors.textSecondary;
    }
  };

  if (authLoading || loading || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Time Off</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowRequestModal(true)}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add-circle"
            size={32}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {/* Balance Card */}
          {balance && (
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <IconSymbol
                  ios_icon_name="calendar.badge.clock"
                  android_material_icon_name="event-available"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.balanceTitle}>Your Balance ({balance.year})</Text>
              </View>

              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{balance.vacationDaysAvailable}</Text>
                  <Text style={styles.balanceLabel}>Vacation Days Available</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{balance.sickDaysAvailable}</Text>
                  <Text style={styles.balanceLabel}>Sick Days Available</Text>
                </View>
              </View>

              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{balance.unpaidDaysUsed}</Text>
                  <Text style={styles.balanceLabel}>Unpaid Days Used</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceValue}>{balance.yearsOfEmployment.toFixed(1)}</Text>
                  <Text style={styles.balanceLabel}>Years of Service</Text>
                </View>
              </View>
            </View>
          )}

          {/* Requests Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Requests</Text>
            
            {requests.length > 0 ? (
              requests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestTypeContainer}>
                      <IconSymbol
                        ios_icon_name="calendar"
                        android_material_icon_name="event"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.requestType}>
                        {getRequestTypeLabel(request.type)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {request.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requestDates}>
                    <Text style={styles.dateText}>
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </Text>
                    <Text style={styles.daysText}>
                      {request.daysRequested} {request.daysRequested === 1 ? 'day' : 'days'}
                    </Text>
                  </View>

                  {request.reason && (
                    <View style={styles.requestDetail}>
                      <Text style={styles.detailLabel}>Reason:</Text>
                      <Text style={styles.detailValue}>{request.reason}</Text>
                    </View>
                  )}

                  {request.notes && (
                    <View style={styles.requestDetail}>
                      <Text style={styles.detailLabel}>Notes:</Text>
                      <Text style={styles.detailValue}>{request.notes}</Text>
                    </View>
                  )}

                  {request.approvalDate && (
                    <Text style={styles.requestDate}>
                      {request.status === 'approved' ? 'Approved' : 'Reviewed'}: {formatDate(request.approvalDate)}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No time-off requests yet</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Time Off</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Request Type */}
              <Text style={styles.inputLabel}>Type of Leave</Text>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    requestType === 'vacation' && styles.typeButtonActive,
                  ]}
                  onPress={() => setRequestType('vacation')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      requestType === 'vacation' && styles.typeButtonTextActive,
                    ]}
                  >
                    Vacation
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    requestType === 'sick' && styles.typeButtonActive,
                  ]}
                  onPress={() => setRequestType('sick')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      requestType === 'sick' && styles.typeButtonTextActive,
                    ]}
                  >
                    Sick Leave
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    requestType === 'unpaid' && styles.typeButtonActive,
                  ]}
                  onPress={() => setRequestType('unpaid')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      requestType === 'unpaid' && styles.typeButtonTextActive,
                    ]}
                  >
                    Unpaid
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Start Date */}
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {startDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="calendar-today"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {showStartDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowStartDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setStartDate(selectedDate);
                      if (selectedDate > endDate) {
                        setEndDate(selectedDate);
                      }
                    }
                  }}
                />
              )}

              {/* End Date */}
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {endDate.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
                <IconSymbol
                  ios_icon_name="calendar"
                  android_material_icon_name="calendar-today"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  minimumDate={startDate}
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setEndDate(selectedDate);
                    }
                  }}
                />
              )}

              {/* Days Requested */}
              <Text style={styles.inputLabel}>Number of Days</Text>
              <TextInput
                style={styles.input}
                value={daysRequested}
                onChangeText={setDaysRequested}
                keyboardType="decimal-pad"
                placeholder="e.g., 1 or 0.5 for half day"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Reason */}
              <Text style={styles.inputLabel}>Reason (Optional)</Text>
              <TextInput
                style={styles.input}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g., Family vacation"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Notes */}
              <Text style={styles.inputLabel}>Additional Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional information..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitRequest}
                disabled={submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
    paddingTop: Platform.OS === 'android' ? 60 : 60,
    paddingBottom: 20,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hireInfo: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hireText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  requestDates: {
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  daysText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  requestDetail: {
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  requestDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalScroll: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  dateButtonText: {
    fontSize: 15,
    color: colors.text,
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontSize: 15,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
