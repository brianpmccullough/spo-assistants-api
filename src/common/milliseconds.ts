export const Milliseconds = {
  fromSeconds: (seconds: number): number => seconds * 1000,
  fromMinutes: (minutes: number): number => minutes * 60 * 1000,
  fromHours: (hours: number): number => hours * 60 * 60 * 1000,
  fromDays: (days: number): number => days * 24 * 60 * 60 * 1000,
};
