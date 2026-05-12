import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Modal, Alert, Switch,
} from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import {
  Task, RepeatRule, getTasksForToday, createTask,
  toggleTask, deleteTask, generateDailyTasks,
} from '../modules/checklist/checklistService';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function ChecklistScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [repeat, setRepeat] = useState<RepeatRule>(null);
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    await generateDailyTasks(user.id);
    const data = await getTasksForToday(user.id);
    setTasks(data);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newTitle.trim() || !user) return;
    const rule: RepeatRule =
      repeatType === 'daily' ? { type: 'daily' } :
      repeatType === 'weekly' ? { type: 'weekly', days: selectedDays } :
      null;
    await createTask(user.id, newTitle.trim(), rule);
    setNewTitle('');
    setRepeat(null);
    setRepeatType('none');
    setSelectedDays([]);
    setModalVisible(false);
    load();
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
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  const done = tasks.filter(t => t.is_done).length;
  const s = styles(colors);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.date}>{format(new Date(), 'M월 d일 (E)', { locale: ko })}</Text>
        <Text style={s.progress}>{done}/{tasks.length} 완료</Text>
      </View>

      {tasks.length > 0 && (
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${tasks.length > 0 ? (done / tasks.length) * 100 : 0}%` }]} />
        </View>
      )}

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.taskRow} onPress={() => handleToggle(item)}>
            <View style={[s.checkbox, item.is_done && s.checkboxDone]}>
              {item.is_done && <Text style={s.checkmark}>✓</Text>}
            </View>
            <View style={s.taskContent}>
              <Text style={[s.taskTitle, item.is_done && s.taskDone]}>{item.title}</Text>
              {item.repeat_rule && (
                <Text style={s.repeatBadge}>
                  {item.repeat_rule.type === 'daily' ? '매일 반복' : '주간 반복'}
                </Text>
              )}
              {item.source_event_id && <Text style={s.repeatBadge}>📅 일정에서 가져옴</Text>}
            </View>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}>
              <Text style={s.delBtnText}>×</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={s.empty}>오늘 할 일을 추가해보세요 🌟</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder="새 할 일 입력..."
          placeholderTextColor={colors.textMuted}
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={() => setModalVisible(true)}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.addBtn} onPress={() => { if (newTitle.trim()) setModalVisible(true); }}>
          <Text style={s.addBtnText}>추가</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <Text style={s.modalTitle}>반복 설정</Text>
          <Text style={s.modalSubtitle}>"{newTitle}"</Text>

          {(['none', 'daily', 'weekly'] as const).map(type => (
            <TouchableOpacity key={type} style={[s.repeatOption, repeatType === type && s.repeatOptionActive]} onPress={() => setRepeatType(type)}>
              <Text style={[s.repeatOptionText, repeatType === type && s.repeatOptionTextActive]}>
                {type === 'none' ? '반복 안함' : type === 'daily' ? '매일' : '매주 특정 요일'}
              </Text>
            </TouchableOpacity>
          ))}

          {repeatType === 'weekly' && (
            <View style={s.daysRow}>
              {DAYS.map((day, i) => (
                <TouchableOpacity key={i} style={[s.dayBtn, selectedDays.includes(i) && s.dayBtnActive]} onPress={() => toggleDay(i)}>
                  <Text style={[s.dayBtnText, selectedDays.includes(i) && s.dayBtnTextActive]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.modalActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={handleAdd}>
              <Text style={s.confirmBtnText}>추가하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16 },
    date: { fontSize: 20, fontWeight: '800', color: colors.text },
    progress: { fontSize: 14, color: colors.textMuted },
    progressBar: { height: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 20, borderRadius: 3, marginBottom: 16 },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    taskRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    checkboxDone: { backgroundColor: colors.primary },
    checkmark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: 15, color: colors.text, fontWeight: '500' },
    taskDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    repeatBadge: { fontSize: 11, color: colors.secondary, marginTop: 2 },
    delBtn: { padding: 4 },
    delBtnText: { fontSize: 20, color: colors.textMuted },
    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 60, fontSize: 15 },
    inputRow: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    input: { flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
    addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
    addBtnText: { color: colors.textInverse, fontWeight: '700' },
    modal: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 48 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
    modalSubtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 24 },
    repeatOption: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
    repeatOptionActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
    repeatOptionText: { fontSize: 15, color: colors.text },
    repeatOptionTextActive: { color: colors.primary, fontWeight: '700' },
    daysRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
    dayBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayBtnText: { fontSize: 13, color: colors.text },
    dayBtnTextActive: { color: colors.textInverse, fontWeight: '700' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    cancelBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    cancelBtnText: { fontSize: 15, color: colors.textMuted },
    confirmBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
    confirmBtnText: { fontSize: 15, color: colors.textInverse, fontWeight: '700' },
  });
