import { Milliseconds } from './milliseconds';

describe('Milliseconds', () => {
  it('converts seconds to milliseconds', () => {
    expect(Milliseconds.fromSeconds(10)).toBe(10_000);
  });

  it('converts minutes to milliseconds', () => {
    expect(Milliseconds.fromMinutes(10)).toBe(600_000);
  });

  it('converts hours to milliseconds', () => {
    expect(Milliseconds.fromHours(1)).toBe(3_600_000);
  });

  it('converts days to milliseconds', () => {
    expect(Milliseconds.fromDays(1)).toBe(86_400_000);
  });
});
