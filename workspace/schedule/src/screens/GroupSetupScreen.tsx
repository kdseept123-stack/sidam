import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../modules/auth/AuthContext';
import { createGroup, joinGroupWithCode } from '../modules/group/groupService';
import { useTheme } from '../modules/theme/ThemeContext';

interface Props {
  onGroupJoined: () => void;
}

export default function GroupSetupScreen({ onGroupJoined }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!groupName.trim() || !user) return;
    setLoading(true);
    try {
      await createGroup(groupName.trim(), user.id);
      onGroupJoined();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim() || !user) return;
    setLoading(true);
    try {
      await joinGroupWithCode(inviteCode.trim().toUpperCase(), user.id);
      onGroupJoined();
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }

  const s = styles(colors);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.title}>시작하기</Text>
      <Text style={s.subtitle}>가족 그룹을 만들거나 초대 코드로 참여하세요</Text>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'create' && s.tabActive]} onPress={() => setTab('create')}>
          <Text style={[s.tabText, tab === 'create' && s.tabTextActive]}>그룹 만들기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'join' && s.tabActive]} onPress={() => setTab('join')}>
          <Text style={[s.tabText, tab === 'join' && s.tabTextActive]}>코드로 참여</Text>
        </TouchableOpacity>
      </View>

      {tab === 'create' ? (
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="그룹 이름 (예: 우리 가족)"
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
          />
          <TouchableOpacity style={s.button} onPress={handleCreate} disabled={loading || !groupName.trim()}>
            {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={s.buttonText}>그룹 만들기</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.form}>
          <TextInput
            style={[s.input, s.codeInput]}
            placeholder="초대 코드 6자리"
            placeholderTextColor={colors.textMuted}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            maxLength={6}
          />
          <TouchableOpacity style={s.button} onPress={handleJoin} disabled={loading || inviteCode.length < 6}>
            {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={s.buttonText}>참여하기</Text>}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
      paddingTop: 80,
    },
    title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 32 },
    tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 4, marginBottom: 24 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.textInverse },
    form: { gap: 16 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 24, fontWeight: '700' },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },
    buttonText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
  });
