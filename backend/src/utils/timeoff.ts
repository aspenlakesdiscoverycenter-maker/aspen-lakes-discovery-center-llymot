/**
 * Time-off utility functions for balance calculations and validations
 */

/**
 * Calculate years of employment from hire date
 */
export function calculateYearsOfEmployment(hireDate: Date): number {
  const now = new Date();
  const years = now.getFullYear() - hireDate.getFullYear();
  const monthDiff = now.getMonth() - hireDate.getMonth();

  if (monthDiff < 0) {
    return years - 1;
  }
  return years;
}

/**
 * Calculate vacation days allotted based on tenure
 * 0-1 years: 10 days per year
 * 1-3 years: 15 days per year
 * 3-5 years: 20 days per year
 * 5+ years: 25 days per year
 */
export function calculateVacationDaysAllotted(yearsOfEmployment: number): number {
  if (yearsOfEmployment < 1) {
    return 10;
  } else if (yearsOfEmployment < 3) {
    return 15;
  } else if (yearsOfEmployment < 5) {
    return 20;
  } else {
    return 25;
  }
}

/**
 * Sick days are fixed at 10 per year for all staff
 */
export function calculateSickDaysAllotted(): number {
  return 10;
}

/**
 * Convert display days (with decimals like 5.5) to storage format (integer * 10)
 * This allows half-day support without floating point issues
 */
export function daysToStorageFormat(days: number): number {
  return Math.round(days * 10);
}

/**
 * Convert storage format (integer * 10) back to display days
 */
export function storageToDays(storageValue: number): number {
  return storageValue / 10;
}

/**
 * Calculate number of days between two dates (inclusive)
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return (end.getTime() - start.getTime()) / oneDay + 1; // +1 to include both start and end days
}

/**
 * Check if sufficient balance exists for a request
 */
export function hasSufficientBalance(
  type: 'vacation' | 'sick' | 'unpaid',
  daysRequested: number,
  allotted: number,
  used: number
): boolean {
  if (type === 'unpaid') {
    // Unpaid time off is unlimited
    return true;
  }

  const available = allotted - used;
  return daysRequested <= available;
}

/**
 * Calculate available days remaining
 */
export function calculateAvailableDays(allotted: number, used: number): number {
  return Math.max(0, allotted - used);
}
