import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch, Share } from 'react-native';
import { useTheme } from '../modules/theme/ThemeContext';
import { useAuth } from '../modules/auth/AuthContext';
import { createInviteCode, getGroupMembers, GroupMember, leaveGroup, removeMember, updateNotifyChanges } from '../modules/group/groupService';

interface Props {
  groupId: string;
  groupName: string;
}

export default function SettingsScreen({ groupId, groupName }: Props) {
  const { colors } = useTheme();
  const { user, profile, signOut } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [notifyChanges, setNotifyChanges] = useState(true);

  useEffect(() => {
    getGroupMembers(groupId).then(setMembers);
    const me = members.find(m => m.user_id === user?.id);
    if (me) setNotifyChanges(me.notify_changes);
  }, [groupId]);

  async function handleShareInvite() {
    try {
      const code = await createInviteCode(groupId, user!.id);
      await Share.share({ message: `시담 앱에서 우리 가족 그룹에 참여하세요!\n초대 코드: ${code}\n(7일 이내 1회 사용 가능)` });
    } catch (e: any) {
      Alert.alert('오류', e.message);
    }
  }

  async function handleToggleNotify(value: boolean) {
    setNotifyChanges(value);
    await updateNotifyChanges(groupId, user!.id, value);
  }

  async function handleRemoveMember(memberId: string, name: string) {
    Alert.alert('멤버 제거', `${name}을(를) 그룹에서 제거할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '제거', style: 'destructive', onPress: async () => {
        await removeMember(groupId, memberId);
        setMembers(prev => prev.filter(m => m.user_id !== memberId));
      }},
    ]);
  }

  async function handleLeave() {
    Alert.alert('그룹 떠나기', '정말 그룹을 떠날까요? 공유 캘린더를 더 이상 볼 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '떠나기', style: 'destructive', onPress: async () => { await leaveGroup(groupId, user!.id); } },
    ]);
  }

  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const s = styles(colors);

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>그룹 정보</Text>
      <View style={s.card}>
        <Text style={s.groupName}>{groupName}</Text>
        <Text style={s.memberCount}>{members.length}명의 가족</Text>
      </View>

      <Text style={s.sectionTitle}>가족 멤버</Text>
      <View style={s.card}>
        {members.map(member => (
          <View key={member.user_id} style={s.memberRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{member.profiles.display_name[0]}</Text>
            </View>
            <Text style={s.memberName}>{member.profiles.display_name}</Text>
            {member.role === 'admin' && <Text style={s.adminBadge}>관리자</Text>}
            {myRole === 'admin' && member.user_id !== user?.id && (
              <TouchableOpacity onPress={() => handleRemoveMember(member.user_id, member.profiles.display_name)}>
                <Text style={s.removeText}>제거</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.inviteButton} onPress={handleShareInvite}>
        <Text style={s.inviteButtonText}>초대 코드 공유하기</Text>
      </TouchableOpacity>

      <Text style={s.sectionTitle}>알림 설정</Text>
      <View style={s.card}>
        <View style={s.settingRow}>
          <Text style={s.settingLabel}>가족 일정 변경 알림</Text>
          <Switch value={notifyChanges} onValueChange={handleToggleNotify} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <Text style={s.sectionTitle}>계정</Text>
      <View style={s.card}>
        <Text style={s.profileName}>{profile?.display_name}</Text>
        <TouchableOpacity style={s.leaveButton} onPress={handleLeave}>
          <Text style={s.leaveText}>그룹 떠나기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.signOutButton} onPress={signOut}>
          <Text style={s.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
    groupName: { fontSize: 18, fontWeight: '800', color: colors.text },
    memberCount: { fontSize: 14, color: colors.textMuted },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.textInverse, fontWeight: '700' },
    memberName: { flex: 1, fontSize: 15, color: colors.text },
    adminBadge: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    removeText: { fontSize: 13, color: colors.danger },
    inviteButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    inviteButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingLabel: { fontSize: 15, color: colors.text },
    profileName: { fontSize: 16, fontWeight: '600', color: colors.text },
    leaveButton: { paddingVertical: 8 },
    leaveText: { fontSize: 15, color: colors.danger },
    signOutButton: { paddingVertical: 8 },
    signOutText: { fontSize: 15, color: colors.textMuted },
  });
