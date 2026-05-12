import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../modules/theme/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) Alert.alert('로그인 실패', error.message);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (!email.trim() || !password || !name.trim()) return;
    if (password.length < 6) {
      Alert.alert('오류', '비밀번호는 6자 이상이어야 합니다');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) {
        Alert.alert('회원가입 실패', error.message);
        return;
      }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: name.trim(),
        });
      }
      Alert.alert('완료', '가입이 완료됐어요! 로그인해주세요.', [
        { text: '확인', onPress: () => setTab('login') },
      ]);
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setLoading(false);
    }
  }

  const s = styles(colors);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <Text style={s.emoji}>🏠</Text>
          <Text style={s.title}>시담</Text>
          <Text style={s.subtitle}>가족과 함께하는 일정 공유</Text>
        </View>

        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, tab === 'login' && s.tabActive]} onPress={() => setTab('login')}>
            <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, tab === 'signup' && s.tabActive]} onPress={() => setTab('signup')}>
            <Text style={[s.tabText, tab === 'signup' && s.tabTextActive]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={s.form}>
          {tab === 'signup' && (
            <TextInput
              style={s.input}
              placeholder="이름"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />
          )}
          <TextInput
            style={s.input}
            placeholder="이메일"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={s.input}
            placeholder="비밀번호 (6자 이상)"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={tab === 'login' ? handleLogin : handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.textInverse} />
              : <Text style={s.buttonText}>{tab === 'login' ? '로그인' : '가입하기'}</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 80, justifyContent: 'center' },
    hero: { alignItems: 'center', marginBottom: 40, gap: 8 },
    emoji: { fontSize: 64 },
    title: { fontSize: 40, fontWeight: '800', color: colors.primary, letterSpacing: -1 },
    subtitle: { fontSize: 15, color: colors.textMuted },
    tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.textInverse },
    form: { gap: 12 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 4,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontSize: 16, fontWeight: '700', color: colors.textInverse },
  });
