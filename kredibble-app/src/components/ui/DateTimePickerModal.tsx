import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Clock, Calendar } from 'lucide-react-native';
import { Colors, Radius, Size, FontFamily } from '../../constants/design';

interface DateTimePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (formattedDateTime: string) => void;
  initialValue?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DateTimePickerModal({
  isVisible,
  onClose,
  onConfirm,
  initialValue
}: DateTimePickerModalProps) {
  // Current view month & year
  const [viewDate, setViewDate] = useState(new Date());
  
  // Selected state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');

  // Try to parse initial value if present
  useEffect(() => {
    if (initialValue) {
      // Very simple parsing attempt or default to current date
      // e.g. "25th October 2026, 6:00 PM"
      try {
        const parts = initialValue.split(',');
        if (parts.length >= 1) {
          // Clean the ordinal suffix from the day: "25th October 2026" -> "25 October 2026"
          const dateStr = parts[0].replace(/(\d+)(st|nd|rd|th)/, '$1').trim();
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            // Re-seeds the picker from initialValue each time the modal opens; the
            // selection is user-editable state, so it cannot simply be derived.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedDate(parsed);
            setViewDate(parsed);
          }
        }
        if (parts.length >= 2) {
          const timeStr = parts[1].trim(); // "6:00 PM"
          const timeParts = timeStr.split(' ');
          if (timeParts.length >= 2) {
            const timeNumParts = timeParts[0].split(':');
            const h = parseInt(timeNumParts[0], 10);
            const m = timeNumParts[1] || '00';
            const ap = timeParts[1].toUpperCase() as 'AM' | 'PM';
            
            if (h >= 1 && h <= 12) setSelectedHour(h);
            if (['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].includes(m)) {
              setSelectedMinute(m);
            } else {
              // round to nearest 5
              const roundedMin = Math.round(parseInt(m, 10) / 5) * 5;
              const roundedMinStr = roundedMin < 10 ? `0${roundedMin}` : `${roundedMin}`;
              setSelectedMinute(roundedMinStr === '60' ? '00' : roundedMinStr);
            }
            if (ap === 'AM' || ap === 'PM') setAmpm(ap);
          }
        }
      } catch (e) {
        // Fallback to current date/time
      }
    }
  }, [initialValue, isVisible]);

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Helper values
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    setSelectedDate(new Date(viewYear, viewMonth, day));
  };

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  };

  const handleConfirm = () => {
    const day = selectedDate.getDate();
    const monthName = MONTHS[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    const suffix = getOrdinalSuffix(day);
    
    // Format e.g., "25th October 2026, 6:00 PM"
    const formatted = `${day}${suffix} ${monthName} ${year}, ${selectedHour}:${selectedMinute} ${ampm}`;
    onConfirm(formatted);
    onClose();
  };

  // Render calendar days
  const renderCalendar = () => {
    const cells = [];
    
    // Empty cells for alignment before first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarCell} />);
    }

    // Days cells
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === viewMonth &&
        selectedDate.getFullYear() === viewYear;

      cells.push(
        <TouchableOpacity
          key={`day-${day}`}
          onPress={() => handleSelectDay(day)}
          style={[styles.calendarCell, isSelected && styles.selectedCell]}
        >
          <Text style={[styles.calendarCellText, isSelected && styles.selectedCellText]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return cells;
  };

  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color={Colors.primary} />
              <Text style={styles.headerTitle}>Select Date & Time</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Calendar Component */}
            <View style={styles.calendarContainer}>
              <View style={styles.monthHeader}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
                  <ChevronLeft size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Days label */}
              <View style={styles.daysOfWeekContainer}>
                {DAYS_OF_WEEK.map((d, index) => (
                  <Text key={`day-label-${index}`} style={styles.dayOfWeekLabel}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {renderCalendar()}
              </View>
            </View>

            {/* Time Picker Component */}
            <View style={styles.timeContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Clock size={16} color={Colors.primary} />
                <Text style={styles.sectionLabel}>Select Time</Text>
              </View>
              
              <View style={styles.pickerRow}>
                {/* Hours Select */}
                <View style={styles.selectCol}>
                  <Text style={styles.selectLabel}>Hour</Text>
                  <ScrollView style={styles.selectScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <TouchableOpacity
                        key={`hour-${h}`}
                        onPress={() => setSelectedHour(h)}
                        style={[styles.selectOption, selectedHour === h && styles.selectedOptionActive]}
                      >
                        <Text style={[styles.selectOptionText, selectedHour === h && styles.selectOptionTextActive]}>
                          {h}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Minutes Select */}
                <View style={styles.selectCol}>
                  <Text style={styles.selectLabel}>Minute</Text>
                  <ScrollView style={styles.selectScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {minutesList.map((m) => (
                      <TouchableOpacity
                        key={`minute-${m}`}
                        onPress={() => setSelectedMinute(m)}
                        style={[styles.selectOption, selectedMinute === m && styles.selectedOptionActive]}
                      >
                        <Text style={[styles.selectOptionText, selectedMinute === m && styles.selectOptionTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* AM/PM Column */}
                <View style={styles.ampmCol}>
                  <Text style={styles.selectLabel}>Period</Text>
                  <View style={styles.ampmGroup}>
                    <TouchableOpacity
                      onPress={() => setAmpm('AM')}
                      style={[styles.ampmBtn, ampm === 'AM' && styles.ampmBtnActive]}
                    >
                      <Text style={[styles.ampmText, ampm === 'AM' && styles.ampmTextActive]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setAmpm('PM')}
                      style={[styles.ampmBtn, ampm === 'PM' && styles.ampmBtnActive]}
                    >
                      <Text style={[styles.ampmText, ampm === 'PM' && styles.ampmTextActive]}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Confirm Button */}
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn} activeOpacity={0.9}>
            <Text style={styles.confirmBtnText}>Confirm Date & Time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card + 8, // sheet corner
    maxHeight: Dimensions.get('window').height * 0.85,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: Colors.borderDefault,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.textBody,
    fontFamily: FontFamily.heading, // was Outfit_700Bold (never loaded); Plus Jakarta Sans bold via src/lib/typography.tsx
  },
  closeBtn: {
    padding: 4,
  },
  calendarContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderColor: Colors.borderDefault,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textBody,
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayOfWeekLabel: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.control,
    marginVertical: 2,
  },
  selectedCell: {
    backgroundColor: Colors.primary,
  },
  calendarCellText: {
    fontSize: 13,
    color: Colors.textBody,
    fontWeight: '500',
  },
  selectedCellText: {
    color: Colors.white,
    fontWeight: '700',
  },
  timeContainer: {
    padding: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textBody,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectCol: {
    flex: 1,
  },
  ampmCol: {
    width: 75,
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectScroll: {
    height: 120,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.control,
    backgroundColor: Colors.bgAlt,
  },
  selectOption: {
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: Colors.borderDefault,
  },
  selectedOptionActive: {
    backgroundColor: Colors.primaryTransparent,
  },
  selectOptionText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  selectOptionTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  ampmGroup: {
    gap: 8,
  },
  ampmBtn: {
    height: Size.controlHeight,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgAlt,
  },
  ampmBtnActive: {
    backgroundColor: Colors.primaryTransparent,
    borderColor: Colors.primary,
  },
  ampmText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  ampmTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    height: Size.controlHeight,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: Colors.primaryTransparent,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.white,
  },
});
