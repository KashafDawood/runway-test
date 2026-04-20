/**
 * Age helpers for onboarding and roster (single definition for minor threshold).
 */
export const MINOR_AGE_THRESHOLD = 18;

/** Whether a person with this date of birth is under MINOR_AGE_THRESHOLD on the given date (default: today). */
export function isMinorFromDateOfBirth(
  dateOfBirth: Date,
  asOf: Date = new Date()
): boolean {
  const today = asOf;
  const birthDate = new Date(dateOfBirth);
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 < MINOR_AGE_THRESHOLD;
  }
  return age < MINOR_AGE_THRESHOLD;
}
