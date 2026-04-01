/**
 * Theme Test
 *
 * Note: This file previously tested the MUI theme configuration.
 * Since the project has migrated from MUI to shadcn/ui + Tailwind CSS,
 * the MUI theme object no longer exists.
 *
 * The new styling approach uses:
 * - Tailwind CSS utility classes
 * - CSS variables defined in globals.css
 * - shadcn/ui component theming
 *
 * This test file is kept for reference but skipped since the tested
 * functionality no longer exists.
 *
 * To re-enable theme testing, consider:
 * 1. Testing CSS variables from globals.css
 * 2. Testing Tailwind configuration
 * 3. Testing shadcn/ui theming configuration
 */

describe.skip('Theme Configuration (MUI - Deprecated)', () => {
  it.skip('should have primary color set to #667eea', () => {
    // MUI theme.palette.primary.main
    // This is now handled by Tailwind color utilities
  });

  it.skip('should have secondary color set to #764ba2', () => {
    // MUI theme.palette.secondary.main
    // This is now handled by Tailwind color utilities
  });

  it.skip('should have border radius set to 8px', () => {
    // MUI theme.shape.borderRadius
    // This is now handled by Tailwind rounded utilities
  });

  it.skip('should have correct font family configuration', () => {
    // MUI theme.typography.fontFamily
    // This is now handled by Tailwind font family utilities and CSS variables
  });
});

/**
 * Example tests for the new shadcn/ui + Tailwind approach:
 *
 * describe('Tailwind CSS Configuration', () => {
 *   it('should have primary brand color defined', () => {
 *     const styles = getComputedStyle(document.documentElement)
 *     expect(styles.getPropertyValue('--primary')).toBeDefined()
 *   })
 * })
 */
