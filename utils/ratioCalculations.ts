
/**
 * Utility functions for calculating staff-to-child ratios
 */

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  isKindergarten?: boolean;
  ageInMonths?: number;
}

export interface RatioGroup {
  ratio: number;
  count: number;
  label: string;
}

export interface RatioCalculation {
  effectiveRatio: number;
  ratioGroups: RatioGroup[];
  isOverRatio: boolean;
  maxAllowedChildren: number;
  status: 'good' | 'warning' | 'critical';
}

/**
 * Calculate age in months from date of birth
 */
export function calculateAgeInMonths(dateOfBirth: string): number {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  const years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  
  return years * 12 + months;
}

/**
 * Get the required staff-to-child ratio based on age and kindergarten status
 * 
 * Ratios:
 * - 12-18 months: 1:4
 * - 19 months - 2 years 11 months: 1:6
 * - 3 years - 3 years 11 months: 1:8
 * - 4 years - 4 years 11 months: 1:10
 * - Kindergarten OR 6-9 years: 1:15
 */
export function getRequiredRatio(ageInMonths: number, isKindergarten: boolean = false): number {
  // Kindergarten or 6-9 years (72-108 months)
  if (isKindergarten || (ageInMonths >= 72 && ageInMonths <= 108)) {
    return 15;
  }
  
  // 4 to not yet 5 years (48-59 months)
  if (ageInMonths >= 48 && ageInMonths < 60) {
    return 10;
  }
  
  // 3 to not yet 4 years (36-47 months)
  if (ageInMonths >= 36 && ageInMonths < 48) {
    return 8;
  }
  
  // 19 months to not yet 3 years (19-35 months)
  if (ageInMonths >= 19 && ageInMonths < 36) {
    return 6;
  }
  
  // 12 months to just under 19 months (12-18 months)
  if (ageInMonths >= 12 && ageInMonths < 19) {
    return 4;
  }
  
  // Default for children under 12 months or over 9 years
  return 4; // Use strictest ratio as default
}

/**
 * Get a human-readable label for a ratio
 */
export function getRatioLabel(ratio: number): string {
  switch (ratio) {
    case 4:
      return '12-18 months (1:4)';
    case 6:
      return '19mo-2yrs (1:6)';
    case 8:
      return '3 years (1:8)';
    case 10:
      return '4 years (1:10)';
    case 15:
      return 'Kindergarten/6-9yrs (1:15)';
    default:
      return `1:${ratio}`;
  }
}

/**
 * Calculate the effective ratio for a mixed-age classroom
 * Uses majority rule: if there are more children in a younger ratio group, use that ratio
 * In case of a tie, use the stricter (younger) ratio
 */
export function calculateEffectiveRatio(children: Child[]): {
  effectiveRatio: number;
  ratioGroups: RatioGroup[];
} {
  if (children.length === 0) {
    return { effectiveRatio: 15, ratioGroups: [] };
  }

  // Count children by ratio requirement
  const ratioCounts = new Map<number, number>();
  
  children.forEach(child => {
    const ageInMonths = child.ageInMonths || calculateAgeInMonths(child.dateOfBirth || '');
    const ratio = getRequiredRatio(ageInMonths, child.isKindergarten);
    ratioCounts.set(ratio, (ratioCounts.get(ratio) || 0) + 1);
  });

  // Convert to array and sort by ratio (strictest first)
  const ratioGroups: RatioGroup[] = Array.from(ratioCounts.entries())
    .map(([ratio, count]) => ({
      ratio,
      count,
      label: getRatioLabel(ratio),
    }))
    .sort((a, b) => a.ratio - b.ratio);

  // Find the majority ratio
  let maxCount = 0;
  let effectiveRatio = 15;

  ratioGroups.forEach(group => {
    if (group.count > maxCount) {
      maxCount = group.count;
      effectiveRatio = group.ratio;
    } else if (group.count === maxCount && group.ratio < effectiveRatio) {
      // In case of tie, use stricter (lower) ratio
      effectiveRatio = group.ratio;
    }
  });

  return { effectiveRatio, ratioGroups };
}

/**
 * Calculate if a classroom is over ratio and the status
 */
export function calculateRatioStatus(
  childrenCount: number,
  staffCount: number,
  effectiveRatio: number
): RatioCalculation {
  const maxAllowedChildren = staffCount * effectiveRatio;
  const isOverRatio = childrenCount > maxAllowedChildren;
  
  let status: 'good' | 'warning' | 'critical';
  if (isOverRatio) {
    status = 'critical';
  } else if (childrenCount === maxAllowedChildren) {
    status = 'warning';
  } else {
    status = 'good';
  }

  return {
    effectiveRatio,
    ratioGroups: [],
    isOverRatio,
    maxAllowedChildren,
    status,
  };
}

/**
 * Format ratio for display (e.g., "1:4")
 */
export function formatRatio(ratio: number): string {
  return `1:${ratio}`;
}

/**
 * Get status color based on ratio status
 */
export function getStatusColor(status: 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'good':
      return '#27AE60'; // Green
    case 'warning':
      return '#F39C12'; // Orange
    case 'critical':
      return '#E74C3C'; // Red
    default:
      return '#95A5A6'; // Gray
  }
}
