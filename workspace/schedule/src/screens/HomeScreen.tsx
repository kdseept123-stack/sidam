import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import {
  Category, TodayStats, CategorySummary, MemberTaskCount,
  getTodayStats, getWeekCategorySummary, getMemberTaskCounts,
  generateDailyTasks,
} from '../modules/checklist/checklistService';
import type { RootTabParamList } from '../navigation/AppNavigator';

interface Props {
  groupId: string;
  groupName: string;
}

const CATEGORY_CONFIG: Record<Category, { label: string; dot: string; dotColor: string; bg: string }> = {
  urgent:   { label: '지금 해야 할 일',   dot: '🔴', dotColor: '#FF4757', bg: '#FFF0F1' },
  quick:    { label: '빠르게 끝낼 일',    dot: '🟡', dotColor: '#FFA502', bg: '#FFFBF0' },
  longterm: { label: '장기로 가져갈 일',  dot: '🔵', dotColor: '#1E90FF', bg: '#F0F5FF' },
  reduce:   { label: '줄일 일',           dot: '⚪', dotColor: '#A0A0A0', bg: '#F5F5F5' },
};

export default function HomeScreen({ groupId, groupName }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  function onNavigateToTasks(category?: Category) {
    navigation.navigate('Tasks', category ? { initialCategory: category } : undefined);
  }
  const { colors } = useTheme();
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<TodayStats>({ total: 0, done: 0, remaining: 0 });
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [members, setMembers] = useState<MemberTaskCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      await generateDailyTasks(profile.id);
      const [s, sum, mem] = await Promise.all([
        getTodayStats(profile.id),
        getWeekCategorySummary(groupId),
        getMemberTaskCounts(groupId),
      ]);
      setStats(s);
      setSummary(sum);
      setMembers(mem);
    } finally {
      setLoading(false);
    }
  }, [profile, groupId]);

  useEffect(() => { load(); }, [load]);

  const topUrgent = summary.find(s => s.category === 'urgent' && s.count > 0)
    ?? summary.find(s => s.count > 0);

  const s = styles(colors);
  const initial = profile?.display_name?.[0]?.toUpperCase() ?? '?';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.profileRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <Text style={s.name}>{profile?.display_name ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.dateText}>
        {format(new Date(), 'yyyy년 M월 d일 (E)', { locale: ko })}
      </Text>

      {/* Priority card */}
      {topUrgent && topUrgent.topTitle && (
        <View style={s.priorityCard}>
          <Text style={s.priorityIcon}>✦ 오늘의 우선순위</Text>
          <Text style={s.priorityText} numberOfLines={2}>
            {CATEGORY_CONFIG[topUrgent.category].label}에 "{topUrgent.topTitle}" 외 {topUrgent.count - 1}건을 처리하세요.
          </Text>
        </View>
      )}

      {/* Today stats */}
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
      ) : (
        <View style={s.statsCard}>
          <Text style={s.statsLabel}>오늘</Text>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.text }]}>{stats.total}</Text>
              <Text style={s.statSub}>할 일</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.success }]}>{stats.done}</Text>
              <Text style={s.statSub}>완료</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>{stats.remaining}</Text>
              <Text style={s.statSub}>남은 일</Text>
            </View>
          </View>
        </View>
      )}

      {/* 이번주 한눈에 */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>이번주 한눈에</Text>
        <Text style={s.sectionSub}>할 일 기준</Text>
        <TouchableOpacity onPress={() => onNavigateToTasks()} style={s.moreBtn}>
          <Text style={s.moreText}>더보기 &gt;</Text>
        </TouchableOpacity>
      </View>

      <View style={s.grid}>
        {(summary.length > 0
          ? summary
          : (['urgent', 'quick', 'longterm', 'reduce'] as Category[]).map(cat => ({
              category: cat, count: 0, topTitle: null,
            }))
        ).map(item => {
          const cfg = CATEGORY_CONFIG[item.category];
          return (
            <TouchableOpacity
              key={item.category}
              style={[s.gridCard, { backgroundColor: cfg.bg }]}
              onPress={() => onNavigateToTasks(item.category)}
            >
              <Text style={s.gridDot}>{cfg.dot} {cfg.label}</Text>
              <Text style={[s.gridCount, { color: item.count > 0 ? colors.text : colors.textMuted }]}>
                {item.count}
              </Text>
              <Text style={s.gridTop} numberOfLines={1}>
                {item.topTitle ?? '없음'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 멤버별 남은 일 */}
      {members.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>멤버별 남은 일</Text>
            <Text style={s.sectionSub}>{groupName}</Text>
          </View>
          <View style={s.membersGrid}>
            {members.map(m => (
              <View key={m.user_id} style={s.memberCard}>
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{m.display_name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={s.memberName} numberOfLines={1}>{m.display_name}</Text>
                <Text style={s.memberCount}>{m.remaining}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, paddingTop: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.textInverse, fontWeight: '700', fontSize: 16 },
    name: { fontSize: 18, fontWeight: '700', color: colors.text },
    signOutBtn: { padding: 6 },
    signOutText: { fontSize: 13, color: colors.textMuted },
    dateText: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },
    priorityCard: { backgroundColor: '#3B5BDB', borderRadius: 16, padding: 18, marginBottom: 16 },
    priorityIcon: { color: '#A5B4FC', fontSize: 13, fontWeight: '600', marginBottom: 8 },
    priorityText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
    statsCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
    statsLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: 32, fontWeight: '800' },
    statSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    statDivider: { width: 1, backgroundColor: colors.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    sectionSub: { fontSize: 12, color: colors.textMuted },
    moreBtn: { marginLeft: 'auto' },
    moreText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
    gridCard: { width: '48%', borderRadius: 16, padding: 16 },
    gridDot: { fontSize: 12, color: '#555', fontWeight: '600', marginBottom: 8 },
    gridCount: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
    gridTop: { fontSize: 12, color: '#777' },
    membersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    memberCard: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    memberAvatarText: { color: colors.textInverse, fontWeight: '700', fontSize: 18 },
    memberName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
    memberCount: { fontSize: 22, fontWeight: '800', color: colors.primary },
  });
