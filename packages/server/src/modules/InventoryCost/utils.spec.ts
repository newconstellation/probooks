import { getEarlierDate } from './utils';

describe('getEarlierDate', () => {
  it('keeps the earlier pending date when a later-dated job replaces it', () => {
    expect(getEarlierDate('2026-11-05', '2026-11-02')).toBe('2026-11-02');
  });

  it('keeps the new date when it is earlier', () => {
    expect(getEarlierDate('2026-11-01', '2026-11-02')).toBe('2026-11-01');
  });

  it('accepts Date objects', () => {
    const early = new Date('2026-01-01');
    expect(getEarlierDate(new Date('2026-02-01'), early)).toBe(early);
  });

  it('ignores a missing or invalid pending date', () => {
    expect(getEarlierDate('2026-11-05', undefined)).toBe('2026-11-05');
    expect(getEarlierDate('2026-11-05', null)).toBe('2026-11-05');
    expect(getEarlierDate('2026-11-05', 'not a date')).toBe('2026-11-05');
  });
});
