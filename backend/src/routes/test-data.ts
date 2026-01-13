/**
 * Test Data Management Routes
 * Endpoints to generate and clear test data for testing
 * Restricted to authenticated users only
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, ilike, or, inArray } from 'drizzle-orm';
import type { App } from '../index.js';
import * as schema from '../db/schema.js';
import {
  generateChildren,
  generateParents,
  generateStaff,
  CLASSROOM_TEMPLATES,
  findClassroomForChild,
  calculateTestDataSummary,
} from '../utils/test-data.js';

// Marker to identify generated test data
const TEST_DATA_MARKER = 'TEST_DATA_';

/**
 * Check if email is test data
 */
function isTestDataEmail(email: string): boolean {
  return email.includes(TEST_DATA_MARKER);
}

/**
 * Generate test email
 */
function generateTestEmail(prefix: string, id: string): string {
  return `${prefix}_${TEST_DATA_MARKER}_${id}@test.local`;
}

export async function registerTestDataRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/test-data/generate
   * Generate sample test data
   */
  app.fastify.post(
    '/api/test-data/generate',
    {
      schema: {
        description: 'Generate test data (requires authentication)',
        tags: ['test-data'],
        body: {
          type: 'object',
          properties: {
            childrenCount: { type: 'number', default: 20 },
            staffCount: { type: 'number', default: 8 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { childrenCount = 20, staffCount = 8 } = request.body as {
        childrenCount?: number;
        staffCount?: number;
      };

      try {
        // Generate test data
        const children = generateChildren(childrenCount);
        const parents = generateParents(children);
        const staff = generateStaff(staffCount);

        // Create classrooms
        const classrooms = [];
        for (const template of CLASSROOM_TEMPLATES) {
          const [classroom] = await app.db
            .insert(schema.classrooms)
            .values({
              name: template.name,
              capacity: template.capacity,
              ageGroup: template.ageGroup,
              description: template.description,
              isActive: true,
            })
            .returning();
          classrooms.push(classroom);
        }

        // Create user profiles and get created users
        const createdUsers = [];

        // Create staff user profiles
        for (const staffMember of staff) {
          const [profile] = await app.db
            .insert(schema.userProfiles)
            .values({
              userId: generateTestEmail('staff', staffMember.userId),
              role: 'staff',
              firstName: staffMember.firstName,
              lastName: staffMember.lastName,
              phone: staffMember.phone,
              address: staffMember.address,
              city: staffMember.city,
              state: staffMember.state,
              zipCode: staffMember.zipCode,
            })
            .returning();
          createdUsers.push(profile);
        }

        // Create parent user profiles
        for (const parent of parents) {
          const [profile] = await app.db
            .insert(schema.userProfiles)
            .values({
              userId: generateTestEmail('parent', parent.userId),
              role: 'parent',
              firstName: parent.firstName,
              lastName: parent.lastName,
              phone: parent.phone,
              address: parent.address,
              city: parent.city,
              state: parent.state,
              zipCode: parent.zipCode,
            })
            .returning();
          createdUsers.push(profile);
        }

        // Create staff profiles
        for (const staffMember of staff) {
          const emailId = generateTestEmail('staff', staffMember.userId);
          await app.db
            .insert(schema.staffProfiles)
            .values({
              userId: emailId,
              hireDate: staffMember.hireDate,
              employmentStatus: 'active',
            })
            .catch(() => null); // Ignore if already exists
        }

        // Create children
        const createdChildren = [];
        for (const child of children) {
          const [createdChild] = await app.db
            .insert(schema.children)
            .values({
              firstName: child.firstName,
              lastName: child.lastName,
              dateOfBirth: child.dateOfBirth,
              street: child.street,
              city: child.city,
              province: child.province,
              postalCode: child.postalCode,
              allergies: child.allergies,
              generalHealth: child.generalHealth,
              medicalNotes: child.medicalNotes,
              albertaHealthcareNumber: child.albertaHealthcareNumber,
              isKindergartenEnrolled: child.isKindergartenEnrolled,
            })
            .returning();
          createdChildren.push(createdChild);
        }

        // Create child-parent associations
        for (const [index, parent] of parents.entries()) {
          const childIndex = Math.floor(index / 2);
          if (childIndex < createdChildren.length) {
            const emailId = generateTestEmail('parent', parent.userId);
            await app.db
              .insert(schema.childParents)
              .values({
                childId: createdChildren[childIndex].id,
                parentId: emailId,
                relationship: index % 2 === 0 ? 'Mother' : 'Father',
                isPrimary: index % 2 === 0,
              })
              .catch(() => null); // Ignore if already exists
          }
        }

        // Assign children to classrooms
        for (const child of createdChildren) {
          const dbChild = createdChildren.find((c) => c.id === child.id);
          if (dbChild) {
            const childData = children.find((c) => c.firstName === dbChild.firstName && c.lastName === dbChild.lastName);
            if (childData) {
              const classroom = findClassroomForChild(childData);
              if (classroom) {
                const dbClassroom = classrooms.find((c) => c.name === classroom.name);
                if (dbClassroom) {
                  await app.db
                    .insert(schema.classroomAssignments)
                    .values({
                      childId: child.id,
                      classroomId: dbClassroom.id,
                    })
                    .catch(() => null); // Ignore if already exists
                }
              }
            }
          }
        }

        const summary = calculateTestDataSummary(children, parents, staff);

        return {
          success: true,
          message: 'Test data generated successfully',
          summary,
          details: {
            createdChildren: createdChildren.length,
            createdParents: parents.length,
            createdStaff: staff.length,
            createdClassrooms: classrooms.length,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        app.logger.error(`Error generating test data: ${errorMessage}`);
        reply.code(500);
        return {
          success: false,
          error: 'Failed to generate test data',
          details: errorMessage,
        };
      }
    }
  );

  /**
   * POST /api/test-data/clear
   * Clear all test data (keeps user accounts)
   */
  app.fastify.post(
    '/api/test-data/clear',
    {
      schema: {
        description: 'Clear test data (requires authentication)',
        tags: ['test-data'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        // Get all test data user profiles
        const testProfiles = await app.db.query.userProfiles.findMany({
          where: ilike(schema.userProfiles.userId, `%${TEST_DATA_MARKER}%`),
        });

        const testUserIds: string[] = testProfiles.map((p) => p.userId);

        // Count items to delete
        let deletedCount = 0;

        if (testUserIds.length > 0) {
          // Delete child-parent associations (test parents)
          await app.db
            .delete(schema.childParents)
            .where(inArray(schema.childParents.parentId, testUserIds))
            .catch(() => null);

          // Delete staff profile associations
          await app.db
            .delete(schema.staffProfiles)
            .where(inArray(schema.staffProfiles.userId, testUserIds))
            .catch(() => null);

          // Delete staff classroom assignments
          const testStaffIds = testProfiles
            .filter((p) => p.role === 'staff')
            .map((p) => p.userId);

          if (testStaffIds.length > 0) {
            await app.db
              .delete(schema.staffClassroomAssignments)
              .where(inArray(schema.staffClassroomAssignments.staffId, testStaffIds))
              .catch(() => null);

            // Delete staff attendance
            await app.db
              .delete(schema.staffAttendance)
              .where(inArray(schema.staffAttendance.staffId, testStaffIds))
              .catch(() => null);
          }

          // Get test children (from test parents)
          const childParentRels = await app.db.query.childParents.findMany();
          const testChildIds = childParentRels
            .filter((cp) => testUserIds.includes(cp.parentId as string))
            .map((cp) => cp.childId as string);

          if (testChildIds.length > 0) {
            const childIdArray = testChildIds as string[];

            // Delete child check-ins
            await app.db
              .delete(schema.childCheckIns)
              .where(inArray(schema.childCheckIns.childId, childIdArray))
              .catch(() => null);

            // Delete classroom assignments
            await app.db
              .delete(schema.classroomAssignments)
              .where(inArray(schema.classroomAssignments.childId, childIdArray))
              .catch(() => null);

            // Delete daily reports
            await app.db
              .delete(schema.dailyReports)
              .where(inArray(schema.dailyReports.childId, childIdArray))
              .catch(() => null);

            // Delete attendance
            await app.db
              .delete(schema.attendance)
              .where(inArray(schema.attendance.childId, childIdArray))
              .catch(() => null);

            // Delete invoices
            await app.db
              .delete(schema.invoices)
              .where(inArray(schema.invoices.childId, childIdArray))
              .catch(() => null);

            // Delete form submissions
            await app.db
              .delete(schema.formSubmissions)
              .where(inArray(schema.formSubmissions.childId, childIdArray))
              .catch(() => null);

            // Delete children
            await app.db
              .delete(schema.children)
              .where(inArray(schema.children.id, childIdArray))
              .catch(() => null);

            deletedCount += testChildIds.length;
          }

          // Delete message groups (test parents)
          await app.db
            .delete(schema.messageGroups)
            .where(inArray(schema.messageGroups.createdBy, testUserIds))
            .catch(() => null);

          // Delete test classrooms
          const testClassrooms = await app.db.query.classrooms.findMany({
            where: ilike(schema.classrooms.name, `%TEST%`),
          });

          if (testClassrooms.length > 0) {
            const classroomIds = testClassrooms.map((c) => c.id);
            await app.db
              .delete(schema.classrooms)
              .where(inArray(schema.classrooms.id, classroomIds))
              .catch(() => null);
          }

          // Finally, delete test user profiles
          await app.db
            .delete(schema.userProfiles)
            .where(inArray(schema.userProfiles.userId, testUserIds))
            .catch(() => null);
        }

        return {
          success: true,
          message: 'Test data cleared successfully',
          summary: {
            testProfilesDeleted: testUserIds.length,
            childrenDeleted: deletedCount,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        app.logger.error(`Error clearing test data: ${errorMessage}`);
        reply.code(500);
        return {
          success: false,
          error: 'Failed to clear test data',
          details: errorMessage,
        };
      }
    }
  );

  /**
   * GET /api/test-data/status
   * Get current test data status
   */
  app.fastify.get(
    '/api/test-data/status',
    {
      schema: {
        description: 'Get test data status (requires authentication)',
        tags: ['test-data'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const testProfiles = await app.db.query.userProfiles.findMany({
          where: ilike(schema.userProfiles.userId, `%${TEST_DATA_MARKER}%`),
        });

        const testStaffCount = testProfiles.filter((p) => p.role === 'staff').length;
        const testParentCount = testProfiles.filter((p) => p.role === 'parent').length;

        const testClassrooms = await app.db.query.classrooms.findMany({
          where: ilike(schema.classrooms.name, `%TEST%`),
        });

        return {
          hasTestData: testProfiles.length > 0,
          summary: {
            testProfiles: testProfiles.length,
            testStaff: testStaffCount,
            testParents: testParentCount,
            testClassrooms: testClassrooms.length,
          },
          profiles: testProfiles.map((p) => ({
            userId: p.userId,
            role: p.role,
            name: `${p.firstName} ${p.lastName}`,
          })),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        app.logger.error(`Error getting test data status: ${errorMessage}`);
        reply.code(500);
        return {
          success: false,
          error: 'Failed to get test data status',
          details: errorMessage,
        };
      }
    }
  );
}
