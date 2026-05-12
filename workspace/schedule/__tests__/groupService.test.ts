import { generateInviteCode } from '../src/modules/group/groupService';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    })),
    functions: { invoke: jest.fn() },
  },
}));

describe('generateInviteCode', () => {
  it('생성된 코드는 6자리이다', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });

  it('생성된 코드는 영문 대문자와 숫자만 포함한다', () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('두 번 생성한 코드는 다를 가능성이 높다 (확률: 1 - 1/36^6)', () => {
    const codes = new Set(Array.from({ length: 20 }, generateInviteCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});
