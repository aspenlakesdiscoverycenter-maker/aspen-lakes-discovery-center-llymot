/**
 * Staff-to-Child Ratio Utilities
 * Handles calculation of age groups, required ratios, and current occupancy ratios
 */

type AgeRatioGroup = 'infant' | 'toddler' | 'preschool' | 'pre-k' | 'kindergarten-plus';

interface RatioConfig {
  group: AgeRatioGroup;
  minMonths: number;
  maxMonths: number;
  requiredRatio: number; // 1 staff to N children
}

interface ChildWithAge {
  childId: string;
  firstName: string;
  lastName: string;
  ageMonths: number;
  ratioGroup: AgeRatioGroup;
  requiredRatio: number;
  isKindergartenEnrolled: boolean;
}

interface RatioStatus {
  staffCount: number;
  childrenCount: number;
  requiredRatio: number;
  actualRatio: number; // actual children per staff (calculated)
  isOverRatio: boolean; // true if too many children for staff
  childrenByGroup: {
    group: AgeRatioGroup;
    count: number;
    requiredRatio: number;
  }[];
}

/**
 * Age ratio configuration by age group
 * 12-18 months: 1:4
 * 19 months to <3 years: 1:6
 * 3 to <4 years: 1:8
 * 4 to <5 years: 1:10
 * 5+ years or kindergarten: 1:15
 */
const RATIO_CONFIGS: RatioConfig[] = [
  { group: 'infant', minMonths: 12, maxMonths: 17, requiredRatio: 4 },
  { group: 'toddler', minMonths: 19, maxMonths: 35, requiredRatio: 6 },
  { group: 'preschool', minMonths: 36, maxMonths: 47, requiredRatio: 8 },
  { group: 'pre-k', minMonths: 48, maxMonths: 59, requiredRatio: 10 },
  { group: 'kindergarten-plus', minMonths: 60, maxMonths: 150, requiredRatio: 15 },
];

/**
 * Calculate age in months from date of birth
 */
export function calculateAgeMonths(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months += today.getMonth() - birthDate.getMonth();

  // Adjust if birthday hasn't occurred this month
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

/**
 * Get age group for a child based on age and kindergarten enrollment
 */
export function getAgeRatioGroup(ageMonths: number, isKindergartenEnrolled: boolean): AgeRatioGroup {
  // Kindergarten-enrolled children are always 1:15 ratio
  if (isKindergartenEnrolled) {
    return 'kindergarten-plus';
  }

  const config = RATIO_CONFIGS.find(
    (c) => ageMonths >= c.minMonths && ageMonths <= c.maxMonths
  );

  return config?.group || 'kindergarten-plus';
}

/**
 * Get required ratio for an age group
 */
export function getRequiredRatio(group: AgeRatioGroup): number {
  const config = RATIO_CONFIGS.find((c) => c.group === group);
  return config?.requiredRatio || 15;
}

/**
 * Determine the effective ratio for a group of children using majority rule
 * If there's a tie, use the stricter (younger age group) ratio
 */
export function getEffectiveRatio(children: ChildWithAge[]): number {
  if (children.length === 0) {
    return 15; // Default to most lenient
  }

  // Count children by ratio group
  const groupCounts = new Map<AgeRatioGroup, number>();

  for (const child of children) {
    const count = groupCounts.get(child.ratioGroup) || 0;
    groupCounts.set(child.ratioGroup, count + 1);
  }

  // Find the group with the most children
  let maxCount = 0;
  let maxGroup: AgeRatioGroup = 'kindergarten-plus';

  // Order groups by age (youngest first) for tie-breaking
  const groupOrder: AgeRatioGroup[] = ['infant', 'toddler', 'preschool', 'pre-k', 'kindergarten-plus'];

  for (const group of groupOrder) {
    const count = groupCounts.get(group) || 0;
    if (count >= maxCount) {
      maxCount = count;
      maxGroup = group;
    }
  }

  return getRequiredRatio(maxGroup);
}

/**
 * Calculate ratio status for a classroom
 * Returns staff count, children count, and whether it's over ratio
 */
export function calculateRatioStatus(
  staffCount: number,
  children: ChildWithAge[]
): RatioStatus {
  const childrenCount = children.length;

  // Count children by group
  const groupCounts = new Map<AgeRatioGroup, number>();
  for (const child of children) {
    const count = groupCounts.get(child.ratioGroup) || 0;
    groupCounts.set(child.ratioGroup, count + 1);
  }

  // Build children by group array
  const childrenByGroup = RATIO_CONFIGS.map((config) => ({
    group: config.group,
    count: groupCounts.get(config.group) || 0,
    requiredRatio: config.requiredRatio,
  })).filter((item) => item.count > 0);

  // Get effective ratio for this mix of children
  const effectiveRatio = getEffectiveRatio(children);

  // Calculate actual ratio (children per staff member)
  const actualRatio = staffCount > 0 ? childrenCount / staffCount : 0;

  // Over ratio if more children than allowed per staff
  const isOverRatio = staffCount > 0 && childrenCount > staffCount * effectiveRatio;

  return {
    staffCount,
    childrenCount,
    requiredRatio: effectiveRatio,
    actualRatio: Math.round(actualRatio * 100) / 100, // Round to 2 decimal places
    isOverRatio,
    childrenByGroup,
  };
}

/**
 * Get status indicator based on ratio compliance
 */
export function getRatioStatusIndicator(status: RatioStatus): 'good' | 'at-ratio' | 'over-ratio' {
  if (status.childrenCount === 0) {
    return 'good';
  }

  if (status.isOverRatio) {
    return 'over-ratio';
  }

  // At ratio if close to maximum
  const maxAllowed = status.staffCount * status.requiredRatio;
  const utilizationPercent = (status.childrenCount / maxAllowed) * 100;

  if (utilizationPercent >= 80) {
    return 'at-ratio';
  }

  return 'good';
}
