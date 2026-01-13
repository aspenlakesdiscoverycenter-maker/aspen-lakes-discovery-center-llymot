/**
 * Test Data Generation Utilities
 * Generates realistic sample data for testing daycare app features
 */

import { randomUUID } from 'crypto';

// Sample data pools
const FIRST_NAMES_CHILDREN = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'Lucas', 'Mia', 'Logan', 'Charlotte', 'Jackson', 'Amelia',
  'Aiden', 'Harper', 'Benjamin', 'Evelyn', 'Michael', 'Abigail', 'Alexander',
  'Emily', 'Jacob', 'Elizabeth', 'Daniel', 'Mila', 'Matthew', 'Ella'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark'
];

const FIRST_NAMES_STAFF = [
  'Sarah', 'Jennifer', 'Amanda', 'Jessica', 'Rebecca', 'Lisa', 'Nancy',
  'Karen', 'Michelle', 'Stephanie', 'David', 'Michael', 'Robert', 'James',
  'John', 'William', 'Richard', 'Joseph', 'Thomas', 'Charles'
];

const ALLERGIES = [
  'Peanuts',
  'Tree nuts',
  'Milk',
  'Eggs',
  'Shellfish',
  'Soy',
  'Wheat',
  'Fish',
  'None',
  'None',
  'None',
];

const STREETS = [
  '123 Main St', '456 Oak Ave', '789 Elm St', '321 Maple Dr', '654 Pine Rd',
  '987 Cedar Ln', '111 Birch Ct', '222 Spruce Way', '333 Willow Blvd',
  '444 Ash Ave', '555 Walnut Dr', '666 Hickory Ln', '777 Sycamore Ct'
];

const CITIES = ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Medicine Hat'];
const PROVINCES = ['Alberta'];

const HEALTHCARE_PROVINCES = ['AB'];

// Classroom definitions
export const CLASSROOM_TEMPLATES = [
  {
    name: 'Infant Room',
    capacity: 4,
    ageGroup: '0-12 months',
    description: 'Room for infants (12-18 months)',
    minAgeMonths: 12,
    maxAgeMonths: 17,
  },
  {
    name: 'Toddler Room',
    capacity: 6,
    ageGroup: '19-35 months',
    description: 'Room for toddlers (19 months to under 3 years)',
    minAgeMonths: 19,
    maxAgeMonths: 35,
  },
  {
    name: 'Preschool Room',
    capacity: 8,
    ageGroup: '3-4 years',
    description: 'Room for preschoolers (3 to under 4 years)',
    minAgeMonths: 36,
    maxAgeMonths: 47,
  },
  {
    name: 'Pre-K Room',
    capacity: 10,
    ageGroup: '4-5 years',
    description: 'Room for pre-kindergarten (4 to under 5 years)',
    minAgeMonths: 48,
    maxAgeMonths: 59,
  },
  {
    name: 'Kindergarten Room',
    capacity: 15,
    ageGroup: '5-6 years',
    description: 'Room for kindergarten-enrolled children',
    minAgeMonths: 60,
    maxAgeMonths: 72,
  },
];

interface GeneratedChild {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  allergies: string;
  generalHealth: string;
  medicalNotes: string;
  albertaHealthcareNumber: string;
  isKindergartenEnrolled: boolean;
  parentIds: string[]; // Will be filled after parent generation
}

interface GeneratedParent {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  childIds: string[];
}

interface GeneratedStaff {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  hireDate: Date;
}

/**
 * Generate a random date of birth for a child
 * @param minAgeYears Minimum age in years
 * @param maxAgeYears Maximum age in years
 */
function randomDateOfBirth(minAgeYears: number, maxAgeYears: number): Date {
  const now = new Date();
  const minMs = now.getTime() - maxAgeYears * 365.25 * 24 * 60 * 60 * 1000;
  const maxMs = now.getTime() - minAgeYears * 365.25 * 24 * 60 * 60 * 1000;
  return new Date(minMs + Math.random() * (maxMs - minMs));
}

/**
 * Generate a random postal code for Alberta
 */
function randomAlbertaPostalCode(): string {
  const areas = ['T1A', 'T1B', 'T1C', 'T2A', 'T2B', 'T3A', 'T4A', 'T5A', 'T5B', 'T6A', 'T6B', 'T6H'];
  const area = areas[Math.floor(Math.random() * areas.length)];
  const second = Math.floor(Math.random() * 10);
  const third = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const fourth = Math.floor(Math.random() * 10);
  const fifth = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const sixth = Math.floor(Math.random() * 10);
  return `${area} ${second}${third}${fourth}${fifth}${sixth}`;
}

/**
 * Generate a random Alberta healthcare number
 */
function randomAlbertaHealthcareNumber(): string {
  const num1 = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  const num2 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${num1}${num2}`;
}

/**
 * Pick a random item from an array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate sample children
 */
export function generateChildren(count: number = 20): GeneratedChild[] {
  const children: GeneratedChild[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = pickRandom(FIRST_NAMES_CHILDREN);
    const lastName = pickRandom(LAST_NAMES);
    const dateOfBirth = randomDateOfBirth(1, 6);

    const kindergartenEnrolled = Math.random() < 0.3; // 30% kindergarten enrolled

    children.push({
      id: randomUUID(),
      firstName,
      lastName,
      dateOfBirth,
      street: pickRandom(STREETS),
      city: pickRandom(CITIES),
      province: 'Alberta',
      postalCode: randomAlbertaPostalCode(),
      allergies: pickRandom(ALLERGIES),
      generalHealth: 'Good',
      medicalNotes: '',
      albertaHealthcareNumber: randomAlbertaHealthcareNumber(),
      isKindergartenEnrolled: kindergartenEnrolled,
      parentIds: [],
    });
  }

  return children;
}

/**
 * Generate sample parents (2 per child)
 */
export function generateParents(children: GeneratedChild[]): GeneratedParent[] {
  const parents: GeneratedParent[] = [];

  for (const child of children) {
    // Generate 2 parents per child
    for (let i = 0; i < 2; i++) {
      const firstName = pickRandom(FIRST_NAMES_STAFF);
      const lastName = child.lastName; // Same last name as child
      const phone = `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;

      const parentId = `parent_${child.id}_${i}`;
      parents.push({
        userId: parentId,
        firstName,
        lastName,
        phone,
        address: child.street,
        city: child.city,
        state: child.province,
        zipCode: child.postalCode,
        childIds: [child.id],
      });

      child.parentIds.push(parentId);
    }
  }

  return parents;
}

/**
 * Generate sample staff members
 */
export function generateStaff(count: number = 8): GeneratedStaff[] {
  const staff: GeneratedStaff[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = pickRandom(FIRST_NAMES_STAFF);
    const lastName = pickRandom(LAST_NAMES);
    const phone = `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;

    // Hire date between 1 and 5 years ago
    const hireDate = new Date();
    hireDate.setFullYear(hireDate.getFullYear() - (Math.floor(Math.random() * 4) + 1));

    staff.push({
      userId: `staff_${i}`,
      firstName,
      lastName,
      phone,
      address: pickRandom(STREETS),
      city: pickRandom(CITIES),
      state: 'Alberta',
      zipCode: randomAlbertaPostalCode(),
      hireDate,
    });
  }

  return staff;
}

/**
 * Calculate age in months from date of birth
 */
export function calculateAgeMonths(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);

  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months += today.getMonth() - birthDate.getMonth();

  if (today.getDate() < birthDate.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

/**
 * Find appropriate classroom for a child
 */
export function findClassroomForChild(child: GeneratedChild): (typeof CLASSROOM_TEMPLATES)[0] | null {
  const ageMonths = calculateAgeMonths(child.dateOfBirth);

  if (child.isKindergartenEnrolled) {
    return CLASSROOM_TEMPLATES[4]; // Kindergarten Room
  }

  return CLASSROOM_TEMPLATES.find(
    (room) => ageMonths >= room.minAgeMonths && ageMonths <= room.maxAgeMonths
  ) || null;
}

export interface TestDataSummary {
  childrenCount: number;
  parentsCount: number;
  staffCount: number;
  classroomsCount: number;
  childrenByClassroom: Record<string, number>;
}

/**
 * Calculate test data summary
 */
export function calculateTestDataSummary(
  children: GeneratedChild[],
  parents: GeneratedParent[],
  staff: GeneratedStaff[]
): TestDataSummary {
  const childrenByClassroom: Record<string, number> = {};

  for (const child of children) {
    const classroom = findClassroomForChild(child);
    if (classroom) {
      childrenByClassroom[classroom.name] = (childrenByClassroom[classroom.name] || 0) + 1;
    }
  }

  return {
    childrenCount: children.length,
    parentsCount: parents.length,
    staffCount: staff.length,
    classroomsCount: CLASSROOM_TEMPLATES.length,
    childrenByClassroom,
  };
}
