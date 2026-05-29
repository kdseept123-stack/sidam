import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import {
  CalendarEvent, getEventsForMonth, getEventsForDay,
  createEvent, updateEvent, deleteEvent, subscribeToGroupEvents,
} from '../modules/calendar/calendarService';
import {
  importEventAsTask, removeTaskByEventId, getImportedEventIds, Category,
} from '../modules/checklist/checklistService';
import { scheduleEventNotification, cancelEventNotification } from '../modules/notification/notificationService';

interface Props {
  groupId: string;
}

export default function CalendarScreen({ groupId }: Props) {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [eventsByMonth, setEventsByMonth] = useState<Record<string, CalendarEvent[]>>({});
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ title: '', date: '', time: '', endTime: '', memo: '' });
  const [checkedEventIds, setCheckedEventIds] = useState<Set<string>>(new Set());

  const loadMonth = useCallback(async () => {
    const data = await getEventsForMonth(groupId, currentMonth.year, currentMonth.month);
    setEventsByMonth(data);
  }, [groupId, currentMonth]);

  const loadDay = useCallback(async () => {
    const events = await getEventsForDay(groupId, new Date(selectedDate));
    setDayEvents(events);
  }, [groupId, selectedDate]);

  const loadChecked = useCallback(async () => {
    if (!user) return;
    const ids = await getImportedEventIds(user.id);
    setCheckedEventIds(ids);
  }, [user]);

  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadChecked(); }, [loadChecked]);

  useEffect(() => {
    const channel = subscribeToGroupEvents(groupId, () => {
      loadMonth();
      loadDay();
    });
    return () => { channel.unsubscribe(); };
  }, [groupId, loadMonth, loadDay]);

  const markedDates = Object.keys(eventsByMonth).reduce<Record<string, any>>((acc, date) => {
    acc[date] = { marked: true, dotColor: colors.primary };
    return acc;
  }, {});
  markedDates[selectedDate] = { ...markedDates[selectedDate], selected: true, selectedColor: colors.primary };

  function openCreate() {
    setEditingEvent(null);
    setForm({ title: '', date: selectedDate, time: '09:00', endTime: '10:00', memo: '' });
    setModalVisible(true);
  }

  function openEdit(event: CalendarEvent) {
    const start = parseISO(event.start_at);
    const end = event.end_at ? parseISO(event.end_at) : null;
    setEditingEvent(event);
    setForm({
      title: event.title,
      date: format(start, 'yyyy-MM-dd'),
      time: format(start, 'HH:mm'),
      endTime: end ? format(end, 'HH:mm') : '',
      memo: event.memo ?? '',
    });
    setModalVisible(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !user) return;
    const start_at = `${form.date}T${form.time}:00`;
    const end_at = form.endTime ? `${form.date}T${form.endTime}:00` : undefined;
    try {
      if (editingEvent) {
        const updated = await updateEvent(editingEvent.id, { title: form.title, start_at, end_at, memo: form.memo || null });
        if (profile) await scheduleEventNotification(updated, profile.reminder_minutes);
      } else {
        const created = await createEvent({ group_id: groupId, created_by: user.id, title: form.title, start_at, end_at, memo: form.memo || undefined });
        if (profile) await scheduleEventNotification(created, profile.reminder_minutes);
      }
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  }

  async function handleCheckEvent(event: CalendarEvent) {
    if (!user) return;
    const eventDate = format(new Date(event.start_at), 'yyyy-MM-dd');

    if (checkedEventIds.has(event.id)) {
      await removeTaskByEventId(user.id, event.id);
      setCheckedEventIds(prev => { const s = new Set(prev); s.delete(event.id); return s; });
      return;
    }

    Alert.alert('할 일 목록에 추가', `"${event.title}"을 어느 목록에 추가할까요?`, [
      {
        text: '하루에 해야할 일',
        onPress: async () => {
          try {
            await importEventAsTask(user.id, event.id, event.title, eventDate, 'daily');
            setCheckedEventIds(prev => new Set(prev).add(event.id));
          } catch (e: any) {
            Alert.alert('오류', e.message);
          }
        },
      },
      {
        text: '천천히 해야할 일',
        onPress: async () => {
          try {
            await importEventAsTask(user.id, event.id, event.title, eventDate, 'slow');
            setCheckedEventIds(prev => new Set(prev).add(event.id));
          } catch (e: any) {
            Alert.alert('오류', e.message);
          }
        },
      },
      { text: '취소', style: 'cancel' },
    ]);
  }

  async function handleDelete(event: CalendarEvent) {
    Alert.alert('삭제', `"${event.title}" 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await cancelEventNotification(event.id);
          await deleteEvent(event.id);
        },
      },
    ]);
  }

  const s = styles(colors);

  return (
    <View style={s.container}>
      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        onMonthChange={(month: DateData) => setCurrentMonth({ year: month.year, month: month.month })}
        markedDates={markedDates}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: colors.textMuted,
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: colors.textInverse,
          todayTextColor: colors.primary,
          dayTextColor: colors.text,
          dotColor: colors.primary,
          monthTextColor: colors.text,
          arrowColor: colors.primary,
        }}
      />

      <View style={s.daySection}>
        <View style={s.dayHeader}>
          <Text style={s.dayTitle}>
            {format(new Date(selectedDate), 'M월 d일 (E)', { locale: ko })}
          </Text>
          <TouchableOpacity style={s.addButton} onPress={openCreate}>
            <Text style={s.addButtonText}>+ 추가</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={dayEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isChecked = checkedEventIds.has(item.id);
            return (
              <TouchableOpacity style={s.eventCard} onPress={() => openEdit(item)}>
                <View style={s.eventDot} />
                <View style={s.eventInfo}>
                  <Text style={s.eventTitle}>{item.title}</Text>
                  <Text style={s.eventTime}>
                    {format(parseISO(item.start_at), 'HH:mm')}
                    {item.end_at ? ` ~ ${format(parseISO(item.end_at), 'HH:mm')}` : ''}
                    {item.profiles ? ` · ${item.profiles.display_name}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleCheckEvent(item)} style={[s.checkBtn, isChecked && s.checkBtnActive]}>
                  <Text style={[s.checkBtnText, isChecked && s.checkBtnTextActive]}>
                    {isChecked ? '✓ 할일' : '+ 할일'}
                  </Text>
                </TouchableOpacity>
                {item.created_by === user?.id && (
                  <TouchableOpacity onPress={() => handleDelete(item)} style={s.deleteBtn}>
                    <Text style={s.deleteBtnText}>삭제</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>일정이 없어요</Text>}
        />
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={s.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editingEvent ? '일정 수정' : '새 일정'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={s.modalSave}>저장</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.fieldLabel}>내용</Text>
            <TextInput style={s.modalInput} placeholder="일정 제목을 입력하세요" placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(v) => setForm(f => ({ ...f, title: v }))} />

            <Text style={s.fieldLabel}>날짜</Text>
            <TextInput style={s.modalInput} placeholder="2026-05-29" placeholderTextColor={colors.textMuted} value={form.date} onChangeText={(v) => setForm(f => ({ ...f, date: v }))} keyboardType="numbers-and-punctuation" />

            <Text style={s.fieldLabel}>알람 울릴 시간</Text>
            <TextInput style={s.modalInput} placeholder="09:00" placeholderTextColor={colors.textMuted} value={form.time} onChangeText={(v) => setForm(f => ({ ...f, time: v }))} keyboardType="numbers-and-punctuation" />

            <Text style={s.fieldLabel}>추가 메모 <Text style={s.fieldLabelOptional}>(선택)</Text></Text>
            <TextInput style={[s.modalInput, s.memoInput]} placeholder="메모를 입력하세요" placeholderTextColor={colors.textMuted} value={form.memo} onChangeText={(v) => setForm(f => ({ ...f, memo: v }))} multiline />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    daySection: { flex: 1, paddingHorizontal: 16 },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    dayTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    addButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    addButtonText: { color: colors.textInverse, fontWeight: '600', fontSize: 14 },
    eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: 12 },
    eventInfo: { flex: 1 },
    eventTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    eventTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    checkBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginRight: 6 },
    checkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkBtnText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    checkBtnTextActive: { color: colors.textInverse },
    deleteBtn: { padding: 4 },
    deleteBtnText: { color: colors.danger, fontSize: 13 },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 32, fontSize: 14 },
    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalCancel: { fontSize: 16, color: colors.textMuted },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalSave: { fontSize: 16, fontWeight: '700', color: colors.primary },
    modalBody: { padding: 16 },
    modalInput: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
    memoInput: { height: 100, textAlignVertical: 'top' },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: 4, letterSpacing: 0.3 },
    fieldLabelOptional: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  });
