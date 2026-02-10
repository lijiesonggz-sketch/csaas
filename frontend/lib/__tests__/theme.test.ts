import { theme } from '../theme';

describe('MUI Theme Configuration', () => {
  it('should have primary color set to #667eea', () => {
    expect(theme.palette.primary.main).toBe('#667eea');
  });

  it('should have secondary color set to #764ba2', () => {
    expect(theme.palette.secondary.main).toBe('#764ba2');
  });

  it('should have border radius set to 8px', () => {
    expect(theme.shape.borderRadius).toBe(8);
  });

  it('should have correct font family configuration', () => {
    expect(theme.typography.fontFamily).toBe('var(--font-inter), "Inter", "Roboto", "Helvetica", "Arial", sans-serif');
  });
});
