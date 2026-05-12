import { expandRepeatRuleForDate, RepeatRule } from '../src/modules/checklist/checklistService';
import { format } from 'date-fns';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe('expandRepeatRuleForDate', () => {
  const monday = new Date('2026-05-11');  // 월요일 (1)
  const sunday = new Date('2026-05-10');  // 일요일 (0)
  const wednesday = new Date('2026-05-13'); // 수요일 (3)

  it('rule이 null이면 false를 반환한다', () => {
    expect(expandRepeatRuleForDate(null, monday)).toBe(false);
  });

  it('daily rule은 모든 날짜에 대해 true를 반환한다', () => {
    const rule: RepeatRule = { type: 'daily' };
    expect(expandRepeatRuleForDate(rule, monday)).toBe(true);
    expect(expandRepeatRuleForDate(rule, sunday)).toBe(true);
    expect(expandRepeatRuleForDate(rule, wednesday)).toBe(true);
  });

  it('weekly rule은 지정된 요일에만 true를 반환한다', () => {
    const rule: RepeatRule = { type: 'weekly', days: [1, 3] }; // 월, 수
    expect(expandRepeatRuleForDate(rule, monday)).toBe(true);
    expect(expandRepeatRuleForDate(rule, wednesday)).toBe(true);
    expect(expandRepeatRuleForDate(rule, sunday)).toBe(false);
  });

  it('custom rule은 지정된 요일에만 true를 반환한다', () => {
    const rule: RepeatRule = { type: 'custom', days: [0] }; // 일요일만
    expect(expandRepeatRuleForDate(rule, sunday)).toBe(true);
    expect(expandRepeatRuleForDate(rule, monday)).toBe(false);
  });
});

import { getTasksForToday } from '../src/modules/checklist/checklistService';

describe('getTasksForToday', () => {
  it('오늘 날짜의 tasks만 가져오도록 쿼리한다', async () => {
    const { supabase } = require('../src/lib/supabase');
    const eqMock = jest.fn().mockReturnThis();
    const orderMock = jest.fn().mockResolvedValue({ data: [], error: null });

    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: eqMock,
      order: orderMock,
    });

    await getTasksForToday('user-123');

    const today = format(new Date(), 'yyyy-MM-dd');
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    expect(eqMock).toHaveBeenCalledWith('date', today);
  });
});
