/**
 * Staff-to-Child Ratio Management Routes
 * Handles staff classroom assignments and ratio tracking
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, or } from 'drizzle-orm';
import type { App } from '../index.js';
import * as schema from '../db/schema.js';
import {
  calculateAgeMonths,
  getAgeRatioGroup,
  getEffectiveRatio,
  calculateRatioStatus,
  getRatioStatusIndicator,
} from '../utils/ratio.js';

export function registerRatioRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/ratio/staff-assignments
   * Assign a staff member to a classroom
   */
  app.fastify.post(
    '/api/ratio/staff-assignments',
    {
      schema: {
        description: 'Assign a staff member to a classroom',
        tags: ['ratio'],
        body: {
          type: 'object',
          properties: {
            staffId: { type: 'string' },
            classroomId: { type: 'string' },
          },
          required: ['staffId', 'classroomId'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can assign staff' };
      }

      const { staffId, classroomId } = request.body as {
        staffId: string;
        classroomId: string;
      };

      // Check if staff exists
      const staff = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, staffId),
      });

      if (!staff) {
        reply.code(404);
        return { error: 'Staff member not found' };
      }

      // Check if classroom exists
      const classroom = await app.db.query.classrooms.findFirst({
        where: eq(schema.classrooms.id, classroomId),
      });

      if (!classroom) {
        reply.code(404);
        return { error: 'Classroom not found' };
      }

      // Check if already assigned (and not removed)
      const existing = await app.db.query.staffClassroomAssignments.findFirst({
        where: and(
          eq(schema.staffClassroomAssignments.staffId, staffId),
          eq(schema.staffClassroomAssignments.classroomId, classroomId),
          isNull(schema.staffClassroomAssignments.removedAt)
        ),
      });

      if (existing) {
        reply.code(400);
        return { error: 'Staff member already assigned to this classroom' };
      }

      // Create assignment
      const [assignment] = await app.db
        .insert(schema.staffClassroomAssignments)
        .values({
          staffId,
          classroomId,
        })
        .returning();

      reply.code(201);
      return assignment;
    }
  );

  /**
   * DELETE /api/ratio/staff-assignments/:assignmentId
   * Remove a staff member from a classroom
   */
  app.fastify.delete(
    '/api/ratio/staff-assignments/:assignmentId',
    {
      schema: {
        description: 'Remove a staff member from a classroom',
        tags: ['ratio'],
        params: {
          type: 'object',
          properties: {
            assignmentId: { type: 'string' },
          },
          required: ['assignmentId'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can remove staff assignments' };
      }

      const { assignmentId } = request.params as { assignmentId: string };

      // Find assignment
      const assignment = await app.db.query.staffClassroomAssignments.findFirst({
        where: eq(schema.staffClassroomAssignments.id, assignmentId),
      });

      if (!assignment) {
        reply.code(404);
        return { error: 'Assignment not found' };
      }

      // Soft delete by setting removedAt
      const [updated] = await app.db
        .update(schema.staffClassroomAssignments)
        .set({ removedAt: new Date() })
        .where(eq(schema.staffClassroomAssignments.id, assignmentId))
        .returning();

      return { success: true, assignment: updated };
    }
  );

  /**
   * GET /api/ratio/classroom/:classroomId
   * Get current ratio status for a classroom with detailed breakdown
   */
  app.fastify.get(
    '/api/ratio/classroom/:classroomId',
    {
      schema: {
        description: 'Get current ratio status for a classroom',
        tags: ['ratio'],
        params: {
          type: 'object',
          properties: {
            classroomId: { type: 'string' },
          },
          required: ['classroomId'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Only staff and directors can view ratio status' };
      }

      const { classroomId } = request.params as { classroomId: string };

      // Get classroom
      const classroom = await app.db.query.classrooms.findFirst({
        where: eq(schema.classrooms.id, classroomId),
      });

      if (!classroom) {
        reply.code(404);
        return { error: 'Classroom not found' };
      }

      // Get currently signed in staff for this classroom
      const today = new Date();
      const staffSignedIn = await app.db.query.staffAttendance.findMany({
        where: and(
          eq(schema.staffAttendance.date, today),
          isNull(schema.staffAttendance.signOutTime)
        ),
      });

      // Get assigned staff for this classroom
      const assignedStaff = await app.db.query.staffClassroomAssignments.findMany({
        where: and(
          eq(schema.staffClassroomAssignments.classroomId, classroomId),
          isNull(schema.staffClassroomAssignments.removedAt)
        ),
      });

      // Count staff currently signed in and assigned to this classroom
      const staffCountInClassroom = staffSignedIn.filter((sa) =>
        assignedStaff.some((as) => as.staffId === sa.staffId)
      ).length;

      // Get currently checked-in children
      const checkedInChildren = await app.db.query.childCheckIns.findMany({
        where: and(
          eq(schema.childCheckIns.classroomId, classroomId),
          eq(schema.childCheckIns.date, today),
          isNull(schema.childCheckIns.checkOutTime)
        ),
      });

      // Get child details for age calculations
      const childIds = checkedInChildren.map((cci) => cci.childId);
      const childDetails = childIds.length > 0
        ? await app.db.query.children.findMany({
            where: (c) => {
              const conditions = [];
              for (const id of childIds) {
                conditions.push(eq(c.id, id));
              }
              return conditions.length === 1 ? conditions[0] : or(...conditions);
            },
          })
        : [];

      // Map children with age information
      const childrenWithAge = checkedInChildren
        .map((cci) => {
          const child = childDetails.find((c) => c.id === cci.childId);
          if (!child) return null;

          const ageMonths = calculateAgeMonths(new Date(child.dateOfBirth));
          const ratioGroup = getAgeRatioGroup(ageMonths, child.isKindergartenEnrolled);

          return {
            childId: child.id,
            firstName: child.firstName,
            lastName: child.lastName,
            ageMonths,
            ratioGroup,
            requiredRatio: getEffectiveRatio([
              {
                childId: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                ageMonths,
                ratioGroup,
                requiredRatio: 0,
                isKindergartenEnrolled: child.isKindergartenEnrolled,
              },
            ]),
            isKindergartenEnrolled: child.isKindergartenEnrolled,
            checkInTime: cci.checkInTime,
          };
        })
        .filter((c) => c !== null);

      // Calculate ratio status
      const ratioStatus = calculateRatioStatus(staffCountInClassroom, childrenWithAge);
      const statusIndicator = getRatioStatusIndicator(ratioStatus);

      // Get staff details
      const staffDetails = assignedStaff.length > 0
        ? await app.db.query.userProfiles.findMany({
            where: (up) => {
              const conditions = [];
              for (const staff of assignedStaff) {
                conditions.push(eq(up.userId, staff.staffId));
              }
              return conditions.length === 1 ? conditions[0] : or(...conditions);
            },
          })
        : [];

      return {
        classroom: {
          id: classroom.id,
          name: classroom.name,
          capacity: classroom.capacity,
          ageGroup: classroom.ageGroup,
        },
        staffAssignments: assignedStaff.map((sa) => {
          const staff = staffDetails.find((s) => s.userId === sa.staffId);
          const signed = staffSignedIn.find((si) => si.staffId === sa.staffId);

          return {
            assignmentId: sa.id,
            staffId: sa.staffId,
            staffName: staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown',
            isSignedIn: !!signed,
            signInTime: signed?.signInTime,
          };
        }),
        currentStatus: {
          ...ratioStatus,
          statusIndicator,
        },
        children: childrenWithAge.map((c) => ({
          id: c.childId,
          name: `${c.firstName} ${c.lastName}`,
          ageMonths: c.ageMonths,
          ratioGroup: c.ratioGroup,
          isKindergartenEnrolled: c.isKindergartenEnrolled,
          checkInTime: c.checkInTime,
        })),
      };
    }
  );

  /**
   * GET /api/ratio/overview
   * Get ratio status for all classrooms at a glance
   */
  app.fastify.get(
    '/api/ratio/overview',
    {
      schema: {
        description: 'Get ratio status overview for all classrooms',
        tags: ['ratio'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Only staff and directors can view ratio overview' };
      }

      // Get all active classrooms
      const allClassrooms = await app.db.query.classrooms.findMany({
        where: eq(schema.classrooms.isActive, true),
      });

      const today = new Date();

      // Get all staff currently signed in
      const allSignedInStaff = await app.db.query.staffAttendance.findMany({
        where: and(
          eq(schema.staffAttendance.date, today),
          isNull(schema.staffAttendance.signOutTime)
        ),
      });

      // Get all currently checked-in children
      const allCheckedInChildren = await app.db.query.childCheckIns.findMany({
        where: and(
          eq(schema.childCheckIns.date, today),
          isNull(schema.childCheckIns.checkOutTime)
        ),
      });

      // Get all child details
      const childDetailsMap = new Map();
      if (allCheckedInChildren.length > 0) {
        const allChildDetails = await app.db.query.children.findMany();
        for (const child of allChildDetails) {
          childDetailsMap.set(child.id, child);
        }
      }

      // Process each classroom
      const classroomStatuses = await Promise.all(
        allClassrooms.map(async (classroom) => {
          // Get assigned staff for this classroom
          const assignedStaff = await app.db.query.staffClassroomAssignments.findMany({
            where: and(
              eq(schema.staffClassroomAssignments.classroomId, classroom.id),
              isNull(schema.staffClassroomAssignments.removedAt)
            ),
          });

          // Count staff signed in for this classroom
          const staffInClassroom = allSignedInStaff.filter((sa) =>
            assignedStaff.some((as) => as.staffId === sa.staffId)
          ).length;

          // Get checked-in children for this classroom
          const childrenInClassroom = allCheckedInChildren.filter(
            (cci) => cci.classroomId === classroom.id
          );

          // Map children with age info
          const childrenWithAge = childrenInClassroom
            .map((cci) => {
              const child = childDetailsMap.get(cci.childId);
              if (!child) return null;

              const ageMonths = calculateAgeMonths(new Date(child.dateOfBirth));
              const ratioGroup = getAgeRatioGroup(ageMonths, child.isKindergartenEnrolled);

              return {
                childId: child.id,
                firstName: child.firstName,
                lastName: child.lastName,
                ageMonths,
                ratioGroup,
                requiredRatio: 0,
                isKindergartenEnrolled: child.isKindergartenEnrolled,
              };
            })
            .filter((c) => c !== null);

          // Calculate ratio status
          const ratioStatus = calculateRatioStatus(staffInClassroom, childrenWithAge);
          const statusIndicator = getRatioStatusIndicator(ratioStatus);

          return {
            classroomId: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            ageGroup: classroom.ageGroup,
            staffCount: staffInClassroom,
            childrenCount: ratioStatus.childrenCount,
            requiredRatio: ratioStatus.requiredRatio,
            actualRatio: ratioStatus.actualRatio,
            isOverRatio: ratioStatus.isOverRatio,
            statusIndicator,
            mainAgeGroup:
              childrenWithAge.length > 0
                ? childrenWithAge[0].ratioGroup
                : null,
          };
        })
      );

      // Summary statistics
      const totalStaffSignedIn = allSignedInStaff.length;
      const totalChildrenCheckedIn = allCheckedInChildren.length;
      const overRatioCount = classroomStatuses.filter((cs) => cs.isOverRatio).length;

      return {
        summary: {
          totalClassrooms: allClassrooms.length,
          totalStaffSignedIn,
          totalChildrenCheckedIn,
          classroomsOverRatio: overRatioCount,
        },
        classrooms: classroomStatuses.sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
  );

  /**
   * GET /api/ratio/staff/:staffId/assignments
   * Get all classroom assignments for a staff member
   */
  app.fastify.get(
    '/api/ratio/staff/:staffId/assignments',
    {
      schema: {
        description: 'Get classroom assignments for a staff member',
        tags: ['ratio'],
        params: {
          type: 'object',
          properties: {
            staffId: { type: 'string' },
          },
          required: ['staffId'],
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      const { staffId } = request.params as { staffId: string };

      // Verify user is the staff member or a director
      if (session.user.id !== staffId && userProfile?.role !== 'director') {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      // Get staff details
      const staff = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, staffId),
      });

      if (!staff) {
        reply.code(404);
        return { error: 'Staff member not found' };
      }

      // Get all active assignments
      const assignments = await app.db.query.staffClassroomAssignments.findMany({
        where: and(
          eq(schema.staffClassroomAssignments.staffId, staffId),
          isNull(schema.staffClassroomAssignments.removedAt)
        ),
      });

      // Get classroom details
      const classroomIds = assignments.map((a) => a.classroomId);
      const classroomDetails = classroomIds.length > 0
        ? await app.db.query.classrooms.findMany({
            where: (c) => {
              const conditions = [];
              for (const id of classroomIds) {
                conditions.push(eq(c.id, id));
              }
              return conditions.length === 1 ? conditions[0] : or(...conditions);
            },
          })
        : [];

      return {
        staffId: staff.userId,
        staffName: `${staff.firstName} ${staff.lastName}`,
        assignments: assignments.map((a) => {
          const classroom = classroomDetails.find((c) => c.id === a.classroomId);
          return {
            assignmentId: a.id,
            classroomId: a.classroomId,
            classroomName: classroom?.name || 'Unknown',
            assignedAt: a.assignedAt,
          };
        }),
      };
    }
  );
}
