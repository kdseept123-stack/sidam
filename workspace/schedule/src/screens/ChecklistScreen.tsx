import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import {
  Task, Category, RepeatRule,
  getAllActiveTasks, getTasksForToday,
  createTask, updateTask, toggleTask, deleteTask, generateDailyTasks,
} from '../modules/checklist/checklistService';

interface Props {
  groupId: string;
  initialCategory?: Category;
}

const TABS: { key: Category | 'all' | 'today'; label: string; dot: string }[] = [
  { key: 'today', label: '오늘',      dot: '📋' },
  { key: 'daily', label: '하루에 할 일', dot: '🔴' },
  { key: 'slow',  label: '천천히',    dot: '🔵' },
  { key: 'all',   label: '전체',      dot: '📌' },
];

const CATEGORY_LABELS: Record<Category, string> = {
  daily: '하루에 해야할 일',
  slow:  '천천히 해야할 일',
};

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function ChecklistScreen({ groupId, initialCategory }: Props) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Category | 'all' | 'today'>(initialCategory ?? 'today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('daily');
  const [newDueDate, setNewDueDate] = useState('');
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    await generateDailyTasks(user.id);
    if (activeTab === 'today') {
      const data = await getTasksForToday(user.id);
      setTasks(data);
    } else {
      const all = await getAllActiveTasks(user.id);
      setTasks(activeTab === 'all' ? all : all.filter(t => t.category === activeTab));
    }
  }, [user, activeTab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (initialCategory) setActiveTab(initialCategory);
  }, [initialCategory]);

  function openAdd() {
    if (!newTitle.trim()) return;
    setEditingTask(null);
    setModalVisible(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setNewTitle(task.title);
    setNewCategory(task.category ?? 'daily');
    setNewDueDate(task.due_date ?? '');
    setRepeatType(
      task.repeat_rule?.type === 'daily' ? 'daily' :
      task.repeat_rule?.type === 'weekly' ? 'weekly' : 'none'
    );
    setSelectedDays(
      task.repeat_rule && 'days' in task.repeat_rule ? task.repeat_rule.days : []
    );
    setModalVisible(true);
  }

  async function handleSave() {
    if (!newTitle.trim() || !user) return;
    const rule: RepeatRule =
      repeatType === 'daily'  ? { type: 'daily' } :
      repeatType === 'weekly' ? { type: 'weekly', days: selectedDays } :
      null;
    const due = newDueDate.match(/^\d{4}-\d{2}-\d{2}$/) ? newDueDate : null;

    if (editingTask) {
      await updateTask(editingTask.id, { title: newTitle.trim(), category: newCategory, due_date: due, repeat_rule: rule });
    } else {
      await createTask(user.id, newTitle.trim(), rule, newCategory, due, groupId);
    }
    resetForm();
    setModalVisible(false);
    load();
  }

  function resetForm() {
    setNewTitle('');
    setNewCategory('daily');
    setNewDueDate('');
    setRepeatType('none');
    setSelectedDays([]);
    setShowDatePicker(false);
    setEditingTask(null);
  }

  async function handleToggle(task: Task) {
    await toggleTask(task.id, !task.is_done);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  const done = tasks.filter(t => t.is_done).length;
  const s = styles(colors);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.dot} {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.date}>{format(new Date(), 'M월 d일 (E)', { locale: ko })}</Text>
        {activeTab === 'today' && (
          <Text style={s.progress}>{done}/{tasks.length} 완료</Text>
        )}
      </View>

      {activeTab === 'today' && tasks.length > 0 && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }]} />
        </View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={tasks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.taskRow} onPress={() => handleToggle(item)}>
            <View style={[s.checkbox, item.is_done && s.checkboxDone]}>
              {item.is_done && <Text style={s.checkmark}>✓</Text>}
            </View>
            <View style={s.taskContent}>
              <Text style={[s.taskTitle, item.is_done && s.taskDone]}>{item.title}</Text>
              <View style={s.badgeRow}>
                {item.category && (
                  <Text style={s.catBadge}>{CATEGORY_LABELS[item.category]}</Text>
                )}
                {item.due_date && (
                  <Text style={s.dueBadge}>📅 {item.due_date}</Text>
                )}
                {item.repeat_rule && (
                  <Text style={s.repeatBadge}>
                    {item.repeat_rule.type === 'daily' ? '매일 반복' : '주간 반복'}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={s.editBtn}>
              <Text style={s.editBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
              <Text style={s.delBtnText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>할 일을 추가해보세요 🌟</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Input bar */}
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, {
            color: isDark ? '#F5EDEA' : '#2D2D2D',
            backgroundColor: isDark ? '#3A2A2E' : '#FFFFFF',
          }]}
          placeholder="새 할 일 입력..."
          placeholderTextColor={isDark ? '#9A8A88' : '#8A8A8A'}
          selectionColor={colors.primary}
          value={newTitle}
          onChangeText={setNewTitle}
          returnKeyType="done"
          onSubmitEditing={openAdd}
        />
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>추가</Text>
        </TouchableOpacity>
      </View>

      {/* Add / Edit modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={s.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{editingTask ? '할 일 수정' : '할 일 추가'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={s.modalSave}>{editingTask ? '저장' : '추가'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody}>
            <Text style={s.fieldLabel}>할 일</Text>
            <TextInput
              style={s.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="할 일 내용"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={s.fieldLabel}>종류</Text>
            {(['daily', 'slow'] as Category[]).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[s.option, newCategory === cat && s.optionActive]}
                onPress={() => setNewCategory(cat)}
              >
                <Text style={[s.optionText, newCategory === cat && s.optionTextActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={s.fieldLabel}>마감일 (선택)</Text>
            <TouchableOpacity
              style={s.datePickerBtn}
              onPress={() => setShowDatePicker(v => !v)}
            >
              <Text style={newDueDate ? s.datePickerText : s.datePickerPlaceholder}>
                {newDueDate ? format(new Date(newDueDate), 'yyyy년 M월 d일 (E)', { locale: ko }) : '날짜를 선택하세요'}
              </Text>
              {newDueDate ? (
                <TouchableOpacity onPress={() => { setNewDueDate(''); setShowDatePicker(false); }}>
                  <Text style={s.dateClear}>×</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            {showDatePicker && (
              <Calendar
                current={newDueDate || format(new Date(), 'yyyy-MM-dd')}
                onDayPress={(day: DateData) => {
                  setNewDueDate(day.dateString);
                  setShowDatePicker(false);
                }}
                markedDates={newDueDate ? { [newDueDate]: { selected: true, selectedColor: colors.primary } } : {}}
                theme={{
                  backgroundColor: colors.surface,
                  calendarBackground: colors.surface,
                  textSectionTitleColor: colors.textMuted,
                  selectedDayBackgroundColor: colors.primary,
                  selectedDayTextColor: colors.textInverse,
                  todayTextColor: colors.primary,
                  dayTextColor: colors.text,
                  monthTextColor: colors.text,
                  arrowColor: colors.primary,
                }}
                style={s.calendar}
              />
            )}

            <Text style={s.fieldLabel}>반복</Text>
            {(['none', 'daily', 'weekly'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[s.option, repeatType === type && s.optionActive]}
                onPress={() => setRepeatType(type)}
              >
                <Text style={[s.optionText, repeatType === type && s.optionTextActive]}>
                  {type === 'none' ? '반복 안함' : type === 'daily' ? '매일' : '매주 특정 요일'}
                </Text>
              </TouchableOpacity>
            ))}

            {repeatType === 'weekly' && (
              <View style={s.daysRow}>
                {DAYS.map((day, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.dayBtn, selectedDays.includes(i) && s.dayBtnActive]}
                    onPress={() => toggleDay(i)}
                  >
                    <Text style={[s.dayBtnText, selectedDays.includes(i) && s.dayBtnTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    tabScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border },
    tabContent: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surfaceAlt },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.textInverse },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 },
    date: { fontSize: 18, fontWeight: '800', color: colors.text },
    progress: { fontSize: 14, color: colors.textMuted },
    progressBar: { height: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 20, borderRadius: 3, marginBottom: 12 },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkboxDone: { backgroundColor: colors.primary },
    checkmark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: 15, color: colors.text, fontWeight: '500' },
    taskDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    catBadge: { fontSize: 11, color: colors.primary, backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    dueBadge: { fontSize: 11, color: '#1E90FF', backgroundColor: '#F0F5FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    repeatBadge: { fontSize: 11, color: colors.secondary, backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    editBtn: { padding: 6 },
    editBtnText: { fontSize: 16 },
    delBtn: { padding: 6 },
    delBtnText: { fontSize: 22, color: colors.textMuted },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },
    inputRow: { flexDirection: 'row', padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    input: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
    addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
    addBtnText: { color: colors.textInverse, fontWeight: '700' },
    modal: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalCancel: { fontSize: 16, color: colors.textMuted },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalSave: { fontSize: 16, fontWeight: '700', color: colors.primary },
    modalBody: { padding: 20 },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
    option: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    optionText: { fontSize: 15, color: colors.text },
    optionTextActive: { color: colors.primary, fontWeight: '700' },
    modalInput: { backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    daysRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    dayBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayBtnText: { fontSize: 12, color: colors.text },
    dayBtnTextActive: { color: colors.textInverse, fontWeight: '700' },
    datePickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    datePickerText: { fontSize: 15, color: colors.text },
    datePickerPlaceholder: { fontSize: 15, color: colors.textMuted },
    dateClear: { fontSize: 20, color: colors.textMuted, paddingHorizontal: 4 },
    calendar: { borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  });
