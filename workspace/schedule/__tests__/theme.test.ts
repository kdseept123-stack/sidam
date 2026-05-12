import { lightColors, darkColors } from '../src/modules/theme/colors';

describe('ThemeModule color tokens', () => {
  const requiredKeys: (keyof typeof lightColors)[] = [
    'background', 'surface', 'primary', 'text', 'textMuted', 'textInverse', 'border',
  ];

  it('light 테마는 모든 필수 색상 토큰을 포함한다', () => {
    requiredKeys.forEach(key => {
      expect(lightColors[key]).toBeDefined();
      expect(typeof lightColors[key]).toBe('string');
    });
  });

  it('dark 테마는 모든 필수 색상 토큰을 포함한다', () => {
    requiredKeys.forEach(key => {
      expect(darkColors[key]).toBeDefined();
      expect(typeof darkColors[key]).toBe('string');
    });
  });

  it('light와 dark의 background 색상은 다르다', () => {
    expect(lightColors.background).not.toBe(darkColors.background);
  });

  it('dark 테마 background는 light보다 어둡다 (낮은 밝기값)', () => {
    // 간단한 hex 비교: dark background가 더 어두움
    const lightBrightness = parseInt(lightColors.background.slice(1), 16);
    const darkBrightness = parseInt(darkColors.background.slice(1), 16);
    expect(darkBrightness).toBeLessThan(lightBrightness);
  });

  it('primary 색상은 light와 dark 테마에서 동일하다 (브랜드 일관성)', () => {
    expect(lightColors.primary).toBe(darkColors.primary);
  });
});
