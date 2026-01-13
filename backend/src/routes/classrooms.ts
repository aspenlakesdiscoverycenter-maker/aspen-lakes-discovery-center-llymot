import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Helper to calculate hours from timestamps
 */
function calculateHours(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
}

/**
 * Helper to get current classroom assignments for a child
 */
async function getCurrentClassroomAssignment(
  app: App,
  childId: string
): Promise<typeof schema.classroomAssignments.$inferSelect | null> {
  return app.db.query.classroomAssignments.findFirst({
    where: and(
      eq(schema.classroomAssignments.childId, childId),
      isNull(schema.classroomAssignments.removedAt)
    ),
  });
}

/**
 * Helper to get current check-in for a child (if not checked out yet)
 */
async function getCurrentCheckIn(
  app: App,
  childId: string
): Promise<typeof schema.childCheckIns.$inferSelect | null> {
  return app.db.query.childCheckIns.findFirst({
    where: and(
      eq(schema.childCheckIns.childId, childId),
      isNull(schema.childCheckIns.checkOutTime)
    ),
  });
}

export function registerClassroomRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // ==================== CLASSROOM MANAGEMENT ====================

  /**
   * POST /api/classrooms
   * Create a new classroom
   */
  app.fastify.post(
    '/api/classrooms',
    {
      schema: {
        description: 'Create a new classroom',
        tags: ['classrooms'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            capacity: { type: 'number' },
            ageGroup: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'capacity'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              capacity: { type: 'number' },
            },
          },
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
        return { error: 'Unauthorized' };
      }

      const { name, capacity, ageGroup, description } = request.body as {
        name: string;
        capacity: number;
        ageGroup?: string;
        description?: string;
      };

      const [classroom] = await app.db
        .insert(schema.classrooms)
        .values({
          name,
          capacity,
          ageGroup,
          description,
        })
        .returning();

      reply.code(201);
      return {
        id: classroom.id,
        name: classroom.name,
        capacity: classroom.capacity,
      };
    }
  );

  /**
   * GET /api/classrooms
   * Get all active classrooms with occupancy counts
   */
  app.fastify.get(
    '/api/classrooms',
    {
      schema: {
        description: 'Get all active classrooms with occupancy',
        tags: ['classrooms'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                capacity: { type: 'number' },
                ageGroup: { type: 'string' },
                description: { type: 'string' },
                currentOccupancy: { type: 'number' },
                childrenCheckedIn: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const classrooms = await app.db.query.classrooms.findMany({
        where: eq(schema.classrooms.isActive, true),
      });

      const enriched = await Promise.all(
        classrooms.map(async (classroom) => {
          // Count children currently assigned to this classroom
          const assignments = await app.db.query.classroomAssignments.findMany({
            where: and(
              eq(schema.classroomAssignments.classroomId, classroom.id),
              isNull(schema.classroomAssignments.removedAt)
            ),
          });

          // Count children currently checked in to this classroom
          const checkedIn = await app.db.query.childCheckIns.findMany({
            where: and(
              eq(schema.childCheckIns.classroomId, classroom.id),
              isNull(schema.childCheckIns.checkOutTime)
            ),
          });

          return {
            id: classroom.id,
            name: classroom.name,
            capacity: classroom.capacity,
            ageGroup: classroom.ageGroup,
            description: classroom.description,
            currentOccupancy: assignments.length,
            childrenCheckedIn: checkedIn.length,
          };
        })
      );

      return enriched;
    }
  );

  /**
   * GET /api/classrooms/:classroomId
   * Get detailed classroom information with children
   */
  app.fastify.get(
    '/api/classrooms/:classroomId',
    {
      schema: {
        description: 'Get detailed classroom information',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              capacity: { type: 'number' },
              children: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { classroomId } = request.params as { classroomId: string };

      const classroom = await app.db.query.classrooms.findFirst({
        where: eq(schema.classrooms.id, classroomId),
      });

      if (!classroom) {
        reply.code(404);
        return { error: 'Classroom not found' };
      }

      const assignments = await app.db.query.classroomAssignments.findMany({
        where: and(
          eq(schema.classroomAssignments.classroomId, classroomId),
          isNull(schema.classroomAssignments.removedAt)
        ),
        with: {
          child: true,
        },
      });

      const childrenWithStatus = await Promise.all(
        assignments.map(async (assignment) => {
          const checkedIn = await app.db.query.childCheckIns.findFirst({
            where: and(
              eq(schema.childCheckIns.childId, assignment.childId),
              isNull(schema.childCheckIns.checkOutTime)
            ),
          });

          return {
            childId: assignment.child.id,
            name: `${assignment.child.firstName} ${assignment.child.lastName}`,
            isCheckedIn: !!checkedIn,
            checkInTime: checkedIn?.checkInTime.toISOString(),
          };
        })
      );

      return {
        id: classroom.id,
        name: classroom.name,
        capacity: classroom.capacity,
        ageGroup: classroom.ageGroup,
        description: classroom.description,
        currentOccupancy: assignments.length,
        children: childrenWithStatus,
      };
    }
  );

  /**
   * PUT /api/classrooms/:classroomId
   * Update classroom information
   */
  app.fastify.put(
    '/api/classrooms/:classroomId',
    {
      schema: {
        description: 'Update classroom information',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            capacity: { type: 'number' },
            ageGroup: { type: 'string' },
            description: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
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
        return { error: 'Only directors can update classrooms' };
      }

      const { classroomId } = request.params as { classroomId: string };
      const { name, capacity, ageGroup, description } = request.body as {
        name?: string;
        capacity?: number;
        ageGroup?: string;
        description?: string;
      };

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (capacity !== undefined) updateData.capacity = capacity;
      if (ageGroup !== undefined) updateData.ageGroup = ageGroup;
      if (description !== undefined) updateData.description = description;
      updateData.updatedAt = new Date();

      const [updated] = await app.db
        .update(schema.classrooms)
        .set(updateData)
        .where(eq(schema.classrooms.id, classroomId))
        .returning();

      return { id: updated.id };
    }
  );

  /**
   * DELETE /api/classrooms/:classroomId
   * Soft delete classroom (mark as inactive)
   */
  app.fastify.delete(
    '/api/classrooms/:classroomId',
    {
      schema: {
        description: 'Deactivate classroom (soft delete)',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
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
        return { error: 'Only directors can delete classrooms' };
      }

      const { classroomId } = request.params as { classroomId: string };

      await app.db
        .update(schema.classrooms)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.classrooms.id, classroomId));

      return { success: true };
    }
  );

  // ==================== CLASSROOM ASSIGNMENTS ====================

  /**
   * POST /api/classrooms/:classroomId/assign-child
   * Assign a child to a classroom
   */
  app.fastify.post(
    '/api/classrooms/:classroomId/assign-child',
    {
      schema: {
        description: 'Assign a child to a classroom',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
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
        return { error: 'Unauthorized' };
      }

      const { classroomId } = request.params as { classroomId: string };
      const { childId } = request.body as { childId: string };

      // Remove from previous classroom if assigned
      const existing = await getCurrentClassroomAssignment(app, childId);
      if (existing) {
        await app.db
          .update(schema.classroomAssignments)
          .set({ removedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.classroomAssignments.id, existing.id));
      }

      const [assignment] = await app.db
        .insert(schema.classroomAssignments)
        .values({
          childId,
          classroomId,
        })
        .returning();

      reply.code(201);
      return { id: assignment.id };
    }
  );

  /**
   * POST /api/classrooms/:classroomId/remove-child
   * Remove a child from a classroom
   */
  app.fastify.post(
    '/api/classrooms/:classroomId/remove-child',
    {
      schema: {
        description: 'Remove a child from a classroom',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
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
        return { error: 'Unauthorized' };
      }

      const { childId } = request.body as { childId: string };

      const assignment = await getCurrentClassroomAssignment(app, childId);
      if (!assignment) {
        reply.code(404);
        return { error: 'Child not assigned to a classroom' };
      }

      await app.db
        .update(schema.classroomAssignments)
        .set({ removedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.classroomAssignments.id, assignment.id));

      return { success: true };
    }
  );

  // ==================== CHILD CHECK-IN / CHECK-OUT ====================

  /**
   * POST /api/classrooms/:classroomId/check-in
   * Check a child into a classroom
   */
  app.fastify.post(
    '/api/classrooms/:classroomId/check-in',
    {
      schema: {
        description: 'Check a child into a classroom',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['childId'],
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
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
        return { error: 'Unauthorized' };
      }

      const { classroomId } = request.params as { classroomId: string };
      const { childId, notes } = request.body as { childId: string; notes?: string };

      const now = new Date();
      const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [checkIn] = await app.db
        .insert(schema.childCheckIns)
        .values({
          childId,
          classroomId,
          checkInTime: now,
          date: dateOnly,
          checkedInBy: session.user.id,
          notes,
        })
        .returning();

      reply.code(201);
      return { id: checkIn.id };
    }
  );

  /**
   * POST /api/classrooms/:classroomId/check-out
   * Check a child out of a classroom
   */
  app.fastify.post(
    '/api/classrooms/:classroomId/check-out',
    {
      schema: {
        description: 'Check a child out of a classroom',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string' },
          },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              totalHours: { type: 'number' },
            },
          },
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
        return { error: 'Unauthorized' };
      }

      const { childId } = request.body as { childId: string };

      const checkIn = await getCurrentCheckIn(app, childId);
      if (!checkIn) {
        reply.code(400);
        return { error: 'Child not checked in' };
      }

      const now = new Date();
      const totalHours = calculateHours(checkIn.checkInTime, now);

      const [updated] = await app.db
        .update(schema.childCheckIns)
        .set({
          checkOutTime: now,
          totalHours: totalHours.toString(),
          checkedOutBy: session.user.id,
          updatedAt: now,
        })
        .where(eq(schema.childCheckIns.id, checkIn.id))
        .returning();

      return {
        id: updated.id,
        totalHours,
      };
    }
  );

  /**
   * GET /api/classrooms/:classroomId/checked-in
   * Get all children currently checked into a classroom
   */
  app.fastify.get(
    '/api/classrooms/:classroomId/checked-in',
    {
      schema: {
        description: 'Get children currently checked into a classroom',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { classroomId: { type: 'string' } },
          required: ['classroomId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                childId: { type: 'string' },
                name: { type: 'string' },
                checkInTime: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { classroomId } = request.params as { classroomId: string };

      const checkedIn = await app.db.query.childCheckIns.findMany({
        where: and(
          eq(schema.childCheckIns.classroomId, classroomId),
          isNull(schema.childCheckIns.checkOutTime)
        ),
        with: {
          child: true,
        },
      });

      return checkedIn.map((c) => ({
        childId: c.child.id,
        name: `${c.child.firstName} ${c.child.lastName}`,
        checkInTime: c.checkInTime.toISOString(),
      }));
    }
  );

  /**
   * GET /api/child/:childId/attendance
   * Get child's check-in history with date range
   */
  app.fastify.get(
    '/api/child/:childId/attendance',
    {
      schema: {
        description: 'Get child check-in history',
        tags: ['classrooms'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                checkInTime: { type: 'string' },
                checkOutTime: { type: 'string' },
                totalHours: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { childId } = request.params as { childId: string };
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const conditions = [eq(schema.childCheckIns.childId, childId)];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(schema.childCheckIns.date, start));
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.childCheckIns.date, end));
      }

      const records = await app.db.query.childCheckIns.findMany({
        where: and(...conditions),
      });

      return records.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        checkInTime: r.checkInTime.toISOString(),
        checkOutTime: r.checkOutTime?.toISOString(),
        totalHours: r.totalHours ? parseFloat(r.totalHours as string) : null,
      }));
    }
  );

  // ==================== STAFF ATTENDANCE ====================

  /**
   * POST /api/staff/sign-in
   * Staff sign in for the day
   */
  app.fastify.post(
    '/api/staff/sign-in',
    {
      schema: {
        description: 'Staff sign in for the day',
        tags: ['staff-attendance'],
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
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
        return { error: 'Unauthorized' };
      }

      const { notes } = request.body as { notes?: string };
      const now = new Date();
      const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [attendance] = await app.db
        .insert(schema.staffAttendance)
        .values({
          staffId: session.user.id,
          signInTime: now,
          date: dateOnly,
          notes,
        })
        .returning();

      reply.code(201);
      return { id: attendance.id };
    }
  );

  /**
   * POST /api/staff/sign-out
   * Staff sign out for the day
   */
  app.fastify.post(
    '/api/staff/sign-out',
    {
      schema: {
        description: 'Staff sign out for the day',
        tags: ['staff-attendance'],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              totalHours: { type: 'number' },
            },
          },
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
        return { error: 'Unauthorized' };
      }

      const now = new Date();
      const dateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find today's sign-in record
      const signIn = await app.db.query.staffAttendance.findFirst({
        where: and(
          eq(schema.staffAttendance.staffId, session.user.id),
          isNull(schema.staffAttendance.signOutTime),
          gte(schema.staffAttendance.date, dateOnly)
        ),
      });

      if (!signIn) {
        reply.code(400);
        return { error: 'Staff not signed in today' };
      }

      const totalHours = calculateHours(signIn.signInTime, now);

      const [updated] = await app.db
        .update(schema.staffAttendance)
        .set({
          signOutTime: now,
          totalHours: totalHours.toString(),
          updatedAt: now,
        })
        .where(eq(schema.staffAttendance.id, signIn.id))
        .returning();

      return {
        id: updated.id,
        totalHours,
      };
    }
  );

  /**
   * GET /api/staff/attendance
   * Get staff attendance history with date range
   */
  app.fastify.get(
    '/api/staff/attendance',
    {
      schema: {
        description: 'Get staff attendance history',
        tags: ['staff-attendance'],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                signInTime: { type: 'string' },
                signOutTime: { type: 'string' },
                totalHours: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const conditions = [eq(schema.staffAttendance.staffId, session.user.id)];

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        conditions.push(gte(schema.staffAttendance.date, start));
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.staffAttendance.date, end));
      }

      const records = await app.db.query.staffAttendance.findMany({
        where: and(...conditions),
      });

      return records.map((r) => ({
        date: r.date.toISOString().split('T')[0],
        signInTime: r.signInTime.toISOString(),
        signOutTime: r.signOutTime?.toISOString(),
        totalHours: r.totalHours ? parseFloat(r.totalHours as string) : null,
      }));
    }
  );

  /**
   * GET /api/staff/currently-signed-in
   * Get all staff currently signed in today
   */
  app.fastify.get(
    '/api/staff/currently-signed-in',
    {
      schema: {
        description: 'Get staff currently signed in',
        tags: ['staff-attendance'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                staffId: { type: 'string' },
                name: { type: 'string' },
                signInTime: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const today = new Date();
      const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const signedIn = await app.db.query.staffAttendance.findMany({
        where: and(
          eq(schema.staffAttendance.date, dateOnly),
          isNull(schema.staffAttendance.signOutTime)
        ),
      });

      const enriched = await Promise.all(
        signedIn.map(async (attendance) => {
          const profile = await app.db.query.userProfiles.findFirst({
            where: eq(schema.userProfiles.userId, attendance.staffId),
          });

          return {
            staffId: attendance.staffId,
            name: profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown',
            signInTime: attendance.signInTime.toISOString(),
          };
        })
      );

      return enriched;
    }
  );

  /**
   * GET /api/dashboard/overview
   * Get overview dashboard with classrooms, children checked in, and staff signed in
   */
  app.fastify.get(
    '/api/dashboard/overview',
    {
      schema: {
        description: 'Get dashboard overview',
        tags: ['dashboard'],
        response: {
          200: {
            type: 'object',
            properties: {
              classrooms: { type: 'array' },
              totalChildrenCheckedIn: { type: 'number' },
              totalStaffSignedIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Get classrooms with occupancy
      const classrooms = await app.db.query.classrooms.findMany({
        where: eq(schema.classrooms.isActive, true),
      });

      const classroomData = await Promise.all(
        classrooms.map(async (classroom) => {
          const checkedIn = await app.db.query.childCheckIns.findMany({
            where: and(
              eq(schema.childCheckIns.classroomId, classroom.id),
              isNull(schema.childCheckIns.checkOutTime)
            ),
          });

          return {
            id: classroom.id,
            name: classroom.name,
            checkedInCount: checkedIn.length,
            capacity: classroom.capacity,
          };
        })
      );

      // Get total children checked in
      const today = new Date();
      const dateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const totalCheckedIn = await app.db.query.childCheckIns.findMany({
        where: and(
          gte(schema.childCheckIns.date, dateOnly),
          isNull(schema.childCheckIns.checkOutTime)
        ),
      });

      // Get total staff signed in
      const totalSignedIn = await app.db.query.staffAttendance.findMany({
        where: and(
          eq(schema.staffAttendance.date, dateOnly),
          isNull(schema.staffAttendance.signOutTime)
        ),
      });

      return {
        classrooms: classroomData,
        totalChildrenCheckedIn: totalCheckedIn.length,
        totalStaffSignedIn: totalSignedIn.length,
      };
    }
  );
}
