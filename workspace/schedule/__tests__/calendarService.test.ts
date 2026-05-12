import { getEventsForMonth, getEventsForDay } from '../src/modules/calendar/calendarService';

const mockEvents = [
  { id: '1', group_id: 'g1', created_by: 'u1', title: '아침 회의', start_at: '2026-05-12T09:00:00', end_at: '2026-05-12T10:00:00', memo: null, created_at: '', updated_at: '' },
  { id: '2', group_id: 'g1', created_by: 'u2', title: '점심 약속', start_at: '2026-05-12T12:00:00', end_at: null, memo: null, created_at: '', updated_at: '' },
  { id: '3', group_id: 'g1', created_by: 'u1', title: '병원 예약', start_at: '2026-05-20T14:00:00', end_at: null, memo: '내과', created_at: '', updated_at: '' },
];

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockQueryBuilder),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
  },
}));

let mockQueryBuilder: any;

beforeEach(() => {
  mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: mockEvents, error: null }),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: mockEvents[0], error: null }),
  };
});

describe('getEventsForMonth', () => {
  it('이벤트를 날짜(yyyy-MM-dd) 키로 그룹핑해서 반환한다', async () => {
    const result = await getEventsForMonth('g1', 2026, 5);
    expect(result['2026-05-12']).toHaveLength(2);
    expect(result['2026-05-20']).toHaveLength(1);
  });

  it('이벤트가 없는 날짜는 결과에 포함되지 않는다', async () => {
    const result = await getEventsForMonth('g1', 2026, 5);
    expect(result['2026-05-01']).toBeUndefined();
  });
});

describe('getEventsForDay', () => {
  it('특정 날의 이벤트만 반환한다', async () => {
    mockQueryBuilder.order = jest.fn().mockResolvedValue({
      data: [mockEvents[0], mockEvents[1]],
      error: null,
    });
    const result = await getEventsForDay('g1', new Date('2026-05-12'));
    expect(result).toHaveLength(2);
    expect(result.every(e => e.start_at.startsWith('2026-05-12'))).toBe(true);
  });

  it('Supabase 에러 시 예외를 throw한다', async () => {
    mockQueryBuilder.order = jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') });
    await expect(getEventsForDay('g1', new Date('2026-05-12'))).rejects.toThrow('DB error');
  });
});
