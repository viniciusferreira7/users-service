import { normalizeEmail } from './normalize-email';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases every letter', () => {
    expect(normalizeEmail('  Ana@Marketplace.DEV \t')).toBe(
      'ana@marketplace.dev'
    );
  });

  it('leaves an already normalized email unchanged', () => {
    expect(normalizeEmail('ana@marketplace.dev')).toBe('ana@marketplace.dev');
  });
});
