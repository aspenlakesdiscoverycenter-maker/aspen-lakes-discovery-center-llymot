import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { user } from './auth-schema.js';

/**
 * USER ROLES
 * parent - Guardian/parent of children
 * staff - Daycare staff member
 * director - Daycare director/administrator
 */

/**
 * USERS PROFILE TABLE
 * Extends Better Auth user with daycare-specific profile information
 */
export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().unique(),
    role: text('role', { enum: ['parent', 'staff', 'director'] }).notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    address: text('address'),
    city: text('city'),
    state: text('state'),
    zipCode: text('zip_code'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('user_profiles_user_id_idx').on(table.userId),
    index('user_profiles_role_idx').on(table.role),
  ]
);

/**
 * CHILDREN TABLE
 * Profile information for children in the daycare
 */
export const children = pgTable(
  'children',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    dateOfBirth: timestamp('date_of_birth').notNull(),
    // Address Information
    street: text('street'),
    city: text('city'),
    province: text('province'),
    postalCode: text('postal_code'),
    // Health Information
    allergies: text('allergies'),
    generalHealth: text('general_health'),
    medicalNotes: text('medical_notes'),
    albertaHealthcareNumber: text('alberta_healthcare_number'),
    // Emergency and Family
    emergencyContacts: jsonb('emergency_contacts'),
    parentNotes: text('parent_notes'),
    enrollmentDate: timestamp('enrollment_date').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('children_first_name_idx').on(table.firstName),
    index('children_last_name_idx').on(table.lastName),
  ]
);

/**
 * CHILD_PARENT JUNCTION TABLE
 * Links children to their parent guardians
 */
export const childParents = pgTable(
  'child_parents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').notNull(),
    relationship: text('relationship'), // e.g., "Mother", "Father", "Guardian"
    isPrimary: boolean('is_primary').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('child_parents_child_id_idx').on(table.childId),
    index('child_parents_parent_id_idx').on(table.parentId),
    uniqueIndex('child_parents_unique_idx').on(table.childId, table.parentId),
  ]
);

/**
 * ATTENDANCE TABLE
 * Records check-in and check-out times for children
 */
export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
    staffId: text('staff_id').notNull(), // References user.id
    checkInTime: timestamp('check_in_time').notNull(),
    checkOutTime: timestamp('check_out_time'),
    notes: text('notes'),
    date: timestamp('date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('attendance_child_id_idx').on(table.childId),
    index('attendance_date_idx').on(table.date),
    index('attendance_staff_id_idx').on(table.staffId),
  ]
);

/**
 * DAILY_REPORTS TABLE
 * Staff-created daily reports for children (meals, naps, activities, mood)
 */
export const dailyReports = pgTable(
  'daily_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
    staffId: text('staff_id').notNull(), // References user.id
    date: timestamp('date').notNull(),
    // Meals with descriptions
    mealsTaken: jsonb('meals_taken'), // { breakfast, lunch, snack, dinner } with descriptions
    napTime: jsonb('nap_time'), // { startTime, endTime, duration }
    activities: text('activities'), // Description of activities done
    mood: text('mood', { enum: ['happy', 'good', 'neutral', 'fussy', 'upset'] }),
    notes: text('notes'),
    // Media
    photos: jsonb('photos'), // Array of { url, filename, uploadedAt }
    videos: jsonb('videos'), // Array of { url, filename, uploadedAt }
    // Medications and Incidents
    medications: jsonb('medications'), // Array of medication reports
    incidents: jsonb('incidents'), // Array of incident reports
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('daily_reports_child_id_idx').on(table.childId),
    index('daily_reports_date_idx').on(table.date),
    index('daily_reports_staff_id_idx').on(table.staffId),
  ]
);

/**
 * REPORT_REACTIONS TABLE
 * Parents' reactions (heart, thumbs_up, smile, love) to daily reports
 */
export const reportReactions = pgTable(
  'report_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').notNull(), // References user.id
    reactionType: text('reaction_type', {
      enum: ['heart', 'thumbs_up', 'smile', 'love'],
    }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('report_reactions_report_id_idx').on(table.reportId),
    index('report_reactions_parent_id_idx').on(table.parentId),
    uniqueIndex('report_reactions_unique_idx').on(table.reportId, table.parentId),
  ]
);

/**
 * REPORT_COMMENTS TABLE
 * Parents' comments on daily reports
 */
export const reportComments = pgTable(
  'report_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => dailyReports.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').notNull(), // References user.id
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('report_comments_report_id_idx').on(table.reportId),
    index('report_comments_parent_id_idx').on(table.parentId),
  ]
);

/**
 * MESSAGES TABLE
 * Both direct (parent-staff) and group messages
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderId: text('sender_id').notNull(), // References user.id
    recipientId: text('recipient_id'), // For direct messages; null for group messages
    groupId: uuid('group_id'), // For group messages; null for direct messages
    childId: uuid('child_id'), // Optional: if message is about specific child
    subject: text('subject'),
    content: text('content').notNull(),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_sender_id_idx').on(table.senderId),
    index('messages_recipient_id_idx').on(table.recipientId),
    index('messages_group_id_idx').on(table.groupId),
    index('messages_child_id_idx').on(table.childId),
    index('messages_created_at_idx').on(table.createdAt),
  ]
);

/**
 * MESSAGE_GROUPS TABLE
 * Group chat channels (daily plans, classroom chats, important updates)
 */
export const messageGroups = pgTable(
  'message_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    groupType: text('group_type', {
      enum: ['daily_plans', 'classroom', 'announcements', 'custom'],
    }).notNull(),
    createdBy: text('created_by').notNull(), // References user.id
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('message_groups_created_by_idx').on(table.createdBy)]
);

/**
 * GROUP_MEMBERS TABLE
 * Links staff members to message groups they're part of
 */
export const groupMembers = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => messageGroups.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(), // References user.id
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    index('group_members_group_id_idx').on(table.groupId),
    index('group_members_user_id_idx').on(table.userId),
    uniqueIndex('group_members_unique_idx').on(table.groupId, table.userId),
  ]
);

/**
 * STAFF_SCHEDULES TABLE
 * Staff shift schedules and availability
 */
export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: text('staff_id').notNull(), // References user.id
    date: timestamp('date').notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    status: text('status', {
      enum: ['scheduled', 'confirmed', 'off', 'sick_leave', 'vacation'],
    }).default('scheduled'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('staff_schedules_staff_id_idx').on(table.staffId),
    index('staff_schedules_date_idx').on(table.date),
    index('staff_schedules_status_idx').on(table.status),
  ]
);

/**
 * INVOICES TABLE
 * Billing/tuition invoices for parents
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: text('parent_id').notNull(), // References user.id
    childId: uuid('child_id').references(() => children.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(), // In cents
    currency: text('currency').default('USD'),
    invoiceNumber: text('invoice_number').notNull().unique(),
    dueDate: timestamp('due_date').notNull(),
    paidDate: timestamp('paid_date'),
    status: text('status', {
      enum: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'],
    }).default('draft'),
    description: text('description'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('invoices_parent_id_idx').on(table.parentId),
    index('invoices_child_id_idx').on(table.childId),
    index('invoices_status_idx').on(table.status),
  ]
);

/**
 * PAYMENTS TABLE
 * Payment records for invoices
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // In cents
    paymentMethod: text('payment_method', {
      enum: ['credit_card', 'bank_transfer', 'check', 'cash'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    }).default('pending'),
    transactionId: text('transaction_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_invoice_id_idx').on(table.invoiceId),
    index('payments_status_idx').on(table.status),
  ]
);

/**
 * TIME_OFF_REQUESTS TABLE
 * Tracks staff time-off requests with status and approval workflow
 */
export const timeOffRequests = pgTable(
  'time_off_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: text('staff_id').notNull(), // References user.id
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    daysRequested: integer('days_requested').notNull(), // Can be partial: 5, 2.5, etc (stored as integer * 10)
    type: text('type', {
      enum: ['vacation', 'sick', 'unpaid'],
    }).notNull(),
    reason: text('reason'),
    notes: text('notes'),
    status: text('status', {
      enum: ['pending', 'approved', 'denied', 'cancelled'],
    }).default('pending'),
    approvedBy: text('approved_by'), // References user.id (director who approved)
    approvalDate: timestamp('approval_date'),
    approvalNotes: text('approval_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('time_off_requests_staff_id_idx').on(table.staffId),
    index('time_off_requests_status_idx').on(table.status),
    index('time_off_requests_start_date_idx').on(table.startDate),
  ]
);

/**
 * TIME_OFF_BALANCES TABLE
 * Tracks annual time-off balances for each staff member
 * One record per staff member per year
 */
export const timeOffBalances = pgTable(
  'time_off_balances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: text('staff_id').notNull(), // References user.id
    year: integer('year').notNull(),
    vacationDaysAllotted: integer('vacation_days_allotted').notNull(), // Stored as value * 10 for half-day support
    vacationDaysUsed: integer('vacation_days_used').default(0).notNull(),
    sickDaysAllotted: integer('sick_days_allotted').notNull(), // Fixed at 10 per year
    sickDaysUsed: integer('sick_days_used').default(0).notNull(),
    unpaidDaysUsed: integer('unpaid_days_used').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('time_off_balances_staff_id_idx').on(table.staffId),
    index('time_off_balances_year_idx').on(table.year),
    uniqueIndex('time_off_balances_unique_idx').on(table.staffId, table.year),
  ]
);

/**
 * STAFF_PROFILES TABLE
 * Additional staff-specific information (hire date, etc.)
 * Extended from userProfiles
 */
export const staffProfiles = pgTable(
  'staff_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().unique().references(() => userProfiles.userId),
    hireDate: timestamp('hire_date').notNull(),
    employmentStatus: text('employment_status', {
      enum: ['active', 'on_leave', 'terminated'],
    }).default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('staff_profiles_user_id_idx').on(table.userId)]
);

/**
 * FORMS TABLE
 * Online forms created by the center for parents to fill out
 */
export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    content: jsonb('content').notNull(), // Form fields structure
    createdBy: text('created_by').notNull(), // References user.id (director/staff)
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('forms_created_by_idx').on(table.createdBy)]
);

/**
 * FORM_SUBMISSIONS TABLE
 * Tracks parent submissions of forms
 */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').notNull(), // References user.id
    childId: uuid('child_id').references(() => children.id, { onDelete: 'set null' }),
    responses: jsonb('responses').notNull(),
    status: text('status', {
      enum: ['draft', 'submitted', 'reviewed'],
    }).default('draft'),
    submittedAt: timestamp('submitted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('form_submissions_form_id_idx').on(table.formId),
    index('form_submissions_parent_id_idx').on(table.parentId),
    index('form_submissions_child_id_idx').on(table.childId),
  ]
);

/**
 * RELATIONS
 */

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  childParents: many(childParents),
}));

export const childrenRelations = relations(children, ({ many }) => ({
  childParents: many(childParents),
  attendance: many(attendance),
  dailyReports: many(dailyReports),
  invoices: many(invoices),
  formSubmissions: many(formSubmissions),
}));

export const childParentsRelations = relations(childParents, ({ one }) => ({
  child: one(children, {
    fields: [childParents.childId],
    references: [children.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  child: one(children, {
    fields: [attendance.childId],
    references: [children.id],
  }),
}));

export const dailyReportsRelations = relations(dailyReports, ({ one, many }) => ({
  child: one(children, {
    fields: [dailyReports.childId],
    references: [children.id],
  }),
  reactions: many(reportReactions),
  comments: many(reportComments),
}));

export const reportReactionsRelations = relations(reportReactions, ({ one }) => ({
  report: one(dailyReports, {
    fields: [reportReactions.reportId],
    references: [dailyReports.id],
  }),
}));

export const reportCommentsRelations = relations(reportComments, ({ one }) => ({
  report: one(dailyReports, {
    fields: [reportComments.reportId],
    references: [dailyReports.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  group: one(messageGroups, {
    fields: [messages.groupId],
    references: [messageGroups.id],
  }),
  child: one(children, {
    fields: [messages.childId],
    references: [children.id],
  }),
}));

export const messageGroupsRelations = relations(messageGroups, ({ many }) => ({
  members: many(groupMembers),
  messages: many(messages),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(messageGroups, {
    fields: [groupMembers.groupId],
    references: [messageGroups.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ many, one }) => ({
  payments: many(payments),
  child: one(children, {
    fields: [invoices.childId],
    references: [children.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const formsRelations = relations(forms, ({ many }) => ({
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  form: one(forms, {
    fields: [formSubmissions.formId],
    references: [forms.id],
  }),
  child: one(children, {
    fields: [formSubmissions.childId],
    references: [children.id],
  }),
}));

export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
  staffProfile: one(staffProfiles, {
    fields: [timeOffRequests.staffId],
    references: [staffProfiles.userId],
  }),
}));

export const timeOffBalancesRelations = relations(timeOffBalances, ({ one }) => ({
  staffProfile: one(staffProfiles, {
    fields: [timeOffBalances.staffId],
    references: [staffProfiles.userId],
  }),
}));

export const staffProfilesRelations = relations(staffProfiles, ({ many }) => ({
  timeOffRequests: many(timeOffRequests),
  timeOffBalances: many(timeOffBalances),
}));
