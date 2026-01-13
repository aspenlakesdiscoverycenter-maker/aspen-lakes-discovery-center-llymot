import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import {
  calculateYearsOfEmployment,
  calculateVacationDaysAllotted,
  calculateSickDaysAllotted,
  daysToStorageFormat,
  storageToDays,
  calculateDaysBetween,
  hasSufficientBalance,
  calculateAvailableDays,
} from '../utils/timeoff.js';

export function registerTimeOffRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * Helper function to get or create staff profile with hire date
   */
  async function getOrCreateStaffProfile(
    userId: string
  ): Promise<typeof schema.staffProfiles.$inferSelect | null> {
    let staffProfile = await app.db.query.staffProfiles.findFirst({
      where: eq(schema.staffProfiles.userId, userId),
    });

    if (!staffProfile) {
      // If no hire date exists, assume today
      const [created] = await app.db
        .insert(schema.staffProfiles)
        .values({
          userId,
          hireDate: new Date(),
        })
        .returning();
      staffProfile = created;
    }

    return staffProfile;
  }

  /**
   * Helper function to get or create balance for current year
   */
  async function getOrCreateBalance(
    userId: string,
    hireDate: Date
  ): Promise<typeof schema.timeOffBalances.$inferSelect> {
    const currentYear = new Date().getFullYear();
    const yearsOfEmployment = calculateYearsOfEmployment(hireDate);
    const vacationDaysAllotted = daysToStorageFormat(calculateVacationDaysAllotted(yearsOfEmployment));
    const sickDaysAllotted = daysToStorageFormat(calculateSickDaysAllotted());

    let balance = await app.db.query.timeOffBalances.findFirst({
      where: and(
        eq(schema.timeOffBalances.staffId, userId),
        eq(schema.timeOffBalances.year, currentYear)
      ),
    });

    if (!balance) {
      const [created] = await app.db
        .insert(schema.timeOffBalances)
        .values({
          staffId: userId,
          year: currentYear,
          vacationDaysAllotted,
          sickDaysAllotted,
        })
        .returning();
      balance = created;
    }

    return balance;
  }

  /**
   * GET /api/timeoff/balance
   * Get current year's time-off balance for authenticated staff
   */
  app.fastify.get(
    '/api/timeoff/balance',
    {
      schema: {
        description: "Get current year's time-off balance",
        tags: ['timeoff'],
        response: {
          200: {
            type: 'object',
            properties: {
              year: { type: 'number' },
              yearsOfEmployment: { type: 'number' },
              vacationDaysAllotted: { type: 'number' },
              vacationDaysUsed: { type: 'number' },
              vacationDaysAvailable: { type: 'number' },
              sickDaysAllotted: { type: 'number' },
              sickDaysUsed: { type: 'number' },
              sickDaysAvailable: { type: 'number' },
              unpaidDaysUsed: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const staffProfile = await getOrCreateStaffProfile(userId);
      if (!staffProfile) {
        reply.code(404);
        return { error: 'Staff profile not found' };
      }

      const balance = await getOrCreateBalance(userId, staffProfile.hireDate);
      const yearsOfEmployment = calculateYearsOfEmployment(staffProfile.hireDate);

      return {
        year: balance.year,
        yearsOfEmployment,
        vacationDaysAllotted: storageToDays(balance.vacationDaysAllotted),
        vacationDaysUsed: storageToDays(balance.vacationDaysUsed),
        vacationDaysAvailable: storageToDays(
          calculateAvailableDays(balance.vacationDaysAllotted, balance.vacationDaysUsed)
        ),
        sickDaysAllotted: storageToDays(balance.sickDaysAllotted),
        sickDaysUsed: storageToDays(balance.sickDaysUsed),
        sickDaysAvailable: storageToDays(
          calculateAvailableDays(balance.sickDaysAllotted, balance.sickDaysUsed)
        ),
        unpaidDaysUsed: storageToDays(balance.unpaidDaysUsed),
      };
    }
  );

  /**
   * GET /api/timeoff/balance/history
   * Get time-off balance history for all years
   */
  app.fastify.get(
    '/api/timeoff/balance/history',
    {
      schema: {
        description: "Get time-off balance history for all years",
        tags: ['timeoff'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                year: { type: 'number' },
                vacationDaysAllotted: { type: 'number' },
                vacationDaysUsed: { type: 'number' },
                sickDaysAllotted: { type: 'number' },
                sickDaysUsed: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const balances = await app.db.query.timeOffBalances.findMany({
        where: eq(schema.timeOffBalances.staffId, userId),
      });

      return balances.map((b) => ({
        year: b.year,
        vacationDaysAllotted: storageToDays(b.vacationDaysAllotted),
        vacationDaysUsed: storageToDays(b.vacationDaysUsed),
        sickDaysAllotted: storageToDays(b.sickDaysAllotted),
        sickDaysUsed: storageToDays(b.sickDaysUsed),
      }));
    }
  );

  /**
   * POST /api/timeoff/request
   * Submit a time-off request
   */
  app.fastify.post(
    '/api/timeoff/request',
    {
      schema: {
        description: 'Submit a time-off request',
        tags: ['timeoff'],
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'ISO date string' },
            endDate: { type: 'string', description: 'ISO date string' },
            daysRequested: { type: 'number', description: 'Can be partial (e.g., 2.5)' },
            type: {
              type: 'string',
              enum: ['vacation', 'sick', 'unpaid'],
            },
            reason: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['startDate', 'endDate', 'daysRequested', 'type'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              daysRequested: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { startDate, endDate, daysRequested, type, reason, notes } = request.body as {
        startDate: string;
        endDate: string;
        daysRequested: number;
        type: 'vacation' | 'sick' | 'unpaid';
        reason?: string;
        notes?: string;
      };

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate dates
      if (start > end) {
        reply.code(400);
        return { error: 'Start date must be before end date' };
      }

      const staffProfile = await getOrCreateStaffProfile(userId);
      if (!staffProfile) {
        reply.code(404);
        return { error: 'Staff profile not found' };
      }

      const balance = await getOrCreateBalance(userId, staffProfile.hireDate);

      // Check balance for paid time-off
      const storageDays = daysToStorageFormat(daysRequested);
      if (type === 'vacation') {
        if (
          !hasSufficientBalance(
            type,
            storageDays,
            balance.vacationDaysAllotted,
            balance.vacationDaysUsed
          )
        ) {
          reply.code(400);
          return {
            error: 'Insufficient vacation days available',
            available: storageToDays(
              calculateAvailableDays(balance.vacationDaysAllotted, balance.vacationDaysUsed)
            ),
          };
        }
      } else if (type === 'sick') {
        if (
          !hasSufficientBalance(
            type,
            storageDays,
            balance.sickDaysAllotted,
            balance.sickDaysUsed
          )
        ) {
          reply.code(400);
          return {
            error: 'Insufficient sick days available',
            available: storageToDays(
              calculateAvailableDays(balance.sickDaysAllotted, balance.sickDaysUsed)
            ),
          };
        }
      }

      const [timeOffRequest] = await app.db
        .insert(schema.timeOffRequests)
        .values({
          staffId: userId,
          startDate: start,
          endDate: end,
          daysRequested: storageDays,
          type,
          reason,
          notes,
          status: 'pending',
        })
        .returning();

      reply.code(201);
      return {
        id: timeOffRequest.id,
        status: timeOffRequest.status,
        daysRequested: storageToDays(timeOffRequest.daysRequested),
      };
    }
  );

  /**
   * GET /api/timeoff/requests
   * Get time-off requests for authenticated staff
   */
  app.fastify.get(
    '/api/timeoff/requests',
    {
      schema: {
        description: 'Get time-off requests for authenticated staff',
        tags: ['timeoff'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'approved', 'denied', 'cancelled'] },
            year: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                daysRequested: { type: 'number' },
                type: { type: 'string' },
                status: { type: 'string' },
                approvalDate: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is staff or director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { status, year } = request.query as {
        status?: 'pending' | 'approved' | 'denied' | 'cancelled';
        year?: number;
      };

      const conditions = [eq(schema.timeOffRequests.staffId, userId)];

      if (status) {
        conditions.push(eq(schema.timeOffRequests.status, status));
      }

      if (year) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year + 1, 0, 1);
        conditions.push(gte(schema.timeOffRequests.startDate, yearStart));
        conditions.push(lte(schema.timeOffRequests.startDate, yearEnd));
      }

      const requests = await app.db.query.timeOffRequests.findMany({
        where: and(...conditions),
      });

      return requests.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        daysRequested: storageToDays(r.daysRequested),
        type: r.type,
        status: r.status,
        reason: r.reason,
        approvalDate: r.approvalDate?.toISOString(),
        approvalNotes: r.approvalNotes,
      }));
    }
  );

  /**
   * GET /api/timeoff/requests/:requestId
   * Get details of a specific time-off request
   */
  app.fastify.get(
    '/api/timeoff/requests/:requestId',
    {
      schema: {
        description: 'Get details of a specific time-off request',
        tags: ['timeoff'],
        params: {
          type: 'object',
          properties: { requestId: { type: 'string' } },
          required: ['requestId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              startDate: { type: 'string' },
              endDate: { type: 'string' },
              daysRequested: { type: 'number' },
              type: { type: 'string' },
              status: { type: 'string' },
              reason: { type: 'string' },
              notes: { type: 'string' },
              approvalDate: { type: 'string' },
              approvalNotes: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { requestId } = request.params as { requestId: string };

      const timeOffRequest = await app.db.query.timeOffRequests.findFirst({
        where: eq(schema.timeOffRequests.id, requestId),
      });

      if (!timeOffRequest) {
        reply.code(404);
        return { error: 'Request not found' };
      }

      // Only allow viewing own requests unless director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (
        timeOffRequest.staffId !== userId &&
        userProfile?.role !== 'director'
      ) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      return {
        id: timeOffRequest.id,
        startDate: timeOffRequest.startDate.toISOString(),
        endDate: timeOffRequest.endDate.toISOString(),
        daysRequested: storageToDays(timeOffRequest.daysRequested),
        type: timeOffRequest.type,
        status: timeOffRequest.status,
        reason: timeOffRequest.reason,
        notes: timeOffRequest.notes,
        approvalDate: timeOffRequest.approvalDate?.toISOString(),
        approvalNotes: timeOffRequest.approvalNotes,
      };
    }
  );

  /**
   * POST /api/timeoff/requests/:requestId/cancel
   * Cancel a pending time-off request
   */
  app.fastify.post(
    '/api/timeoff/requests/:requestId/cancel',
    {
      schema: {
        description: 'Cancel a pending time-off request',
        tags: ['timeoff'],
        params: {
          type: 'object',
          properties: { requestId: { type: 'string' } },
          required: ['requestId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { requestId } = request.params as { requestId: string };

      const timeOffRequest = await app.db.query.timeOffRequests.findFirst({
        where: eq(schema.timeOffRequests.id, requestId),
      });

      if (!timeOffRequest) {
        reply.code(404);
        return { error: 'Request not found' };
      }

      if (timeOffRequest.staffId !== userId) {
        reply.code(403);
        return { error: 'Can only cancel your own requests' };
      }

      if (timeOffRequest.status !== 'pending') {
        reply.code(400);
        return { error: 'Can only cancel pending requests' };
      }

      const [updated] = await app.db
        .update(schema.timeOffRequests)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.timeOffRequests.id, requestId))
        .returning();

      return {
        id: updated.id,
        status: updated.status,
      };
    }
  );

  /**
   * GET /api/timeoff/admin/pending-requests
   * Get all pending time-off requests (directors only)
   */
  app.fastify.get(
    '/api/timeoff/admin/pending-requests',
    {
      schema: {
        description: 'Get all pending time-off requests (directors only)',
        tags: ['timeoff-admin'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                staffName: { type: 'string' },
                staffEmail: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                daysRequested: { type: 'number' },
                type: { type: 'string' },
                reason: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can view all requests' };
      }

      const requests = await app.db.query.timeOffRequests.findMany({
        where: eq(schema.timeOffRequests.status, 'pending'),
      });

      // Enrich with staff information
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          const staff = await app.db.query.userProfiles.findFirst({
            where: eq(schema.userProfiles.userId, req.staffId),
          });

          // Get email from Better Auth user table
          const user = await app.db
            .select()
            .from(authSchema.user)
            .where(eq(authSchema.user.id, req.staffId))
            .limit(1);

          return {
            id: req.id,
            staffName: `${staff?.firstName} ${staff?.lastName}`,
            staffEmail: user[0]?.email || 'N/A',
            startDate: req.startDate.toISOString(),
            endDate: req.endDate.toISOString(),
            daysRequested: storageToDays(req.daysRequested),
            type: req.type,
            reason: req.reason,
            status: req.status,
          };
        })
      );

      return enrichedRequests;
    }
  );

  /**
   * POST /api/timeoff/admin/requests/:requestId/approve
   * Approve a time-off request (directors only)
   */
  app.fastify.post(
    '/api/timeoff/admin/requests/:requestId/approve',
    {
      schema: {
        description: 'Approve a time-off request (directors only)',
        tags: ['timeoff-admin'],
        params: {
          type: 'object',
          properties: { requestId: { type: 'string' } },
          required: ['requestId'],
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              approvalDate: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { requestId } = request.params as { requestId: string };
      const { notes } = request.body as { notes?: string };

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can approve requests' };
      }

      const timeOffRequest = await app.db.query.timeOffRequests.findFirst({
        where: eq(schema.timeOffRequests.id, requestId),
      });

      if (!timeOffRequest) {
        reply.code(404);
        return { error: 'Request not found' };
      }

      if (timeOffRequest.status !== 'pending') {
        reply.code(400);
        return { error: 'Can only approve pending requests' };
      }

      // Get the balance for the staff member
      const staffUserId = timeOffRequest.staffId;
      const requestYear = timeOffRequest.startDate.getFullYear();
      const balance = await app.db.query.timeOffBalances.findFirst({
        where: and(
          eq(schema.timeOffBalances.staffId, staffUserId),
          eq(schema.timeOffBalances.year, requestYear)
        ),
      });

      if (!balance) {
        reply.code(500);
        return { error: 'Balance record not found' };
      }

      // Update balance based on type (use transaction for atomicity)
      const now = new Date();
      let updatedBalance = balance;

      if (timeOffRequest.type === 'vacation') {
        updatedBalance = await app.db
          .update(schema.timeOffBalances)
          .set({
            vacationDaysUsed: balance.vacationDaysUsed + timeOffRequest.daysRequested,
            updatedAt: now,
          })
          .where(eq(schema.timeOffBalances.id, balance.id))
          .returning()
          .then((results) => results[0]);
      } else if (timeOffRequest.type === 'sick') {
        updatedBalance = await app.db
          .update(schema.timeOffBalances)
          .set({
            sickDaysUsed: balance.sickDaysUsed + timeOffRequest.daysRequested,
            updatedAt: now,
          })
          .where(eq(schema.timeOffBalances.id, balance.id))
          .returning()
          .then((results) => results[0]);
      } else if (timeOffRequest.type === 'unpaid') {
        updatedBalance = await app.db
          .update(schema.timeOffBalances)
          .set({
            unpaidDaysUsed: balance.unpaidDaysUsed + timeOffRequest.daysRequested,
            updatedAt: now,
          })
          .where(eq(schema.timeOffBalances.id, balance.id))
          .returning()
          .then((results) => results[0]);
      }

      // Approve the request
      const [approvedRequest] = await app.db
        .update(schema.timeOffRequests)
        .set({
          status: 'approved',
          approvedBy: userId,
          approvalDate: now,
          approvalNotes: notes,
          updatedAt: now,
        })
        .where(eq(schema.timeOffRequests.id, requestId))
        .returning();

      return {
        id: approvedRequest.id,
        status: approvedRequest.status,
        approvalDate: approvedRequest.approvalDate?.toISOString(),
      };
    }
  );

  /**
   * POST /api/timeoff/admin/requests/:requestId/deny
   * Deny a time-off request (directors only)
   */
  app.fastify.post(
    '/api/timeoff/admin/requests/:requestId/deny',
    {
      schema: {
        description: 'Deny a time-off request (directors only)',
        tags: ['timeoff-admin'],
        params: {
          type: 'object',
          properties: { requestId: { type: 'string' } },
          required: ['requestId'],
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              approvalDate: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { requestId } = request.params as { requestId: string };
      const { reason } = request.body as { reason?: string };

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can deny requests' };
      }

      const timeOffRequest = await app.db.query.timeOffRequests.findFirst({
        where: eq(schema.timeOffRequests.id, requestId),
      });

      if (!timeOffRequest) {
        reply.code(404);
        return { error: 'Request not found' };
      }

      if (timeOffRequest.status !== 'pending') {
        reply.code(400);
        return { error: 'Can only deny pending requests' };
      }

      const now = new Date();
      const [deniedRequest] = await app.db
        .update(schema.timeOffRequests)
        .set({
          status: 'denied',
          approvedBy: userId,
          approvalDate: now,
          approvalNotes: reason,
          updatedAt: now,
        })
        .where(eq(schema.timeOffRequests.id, requestId))
        .returning();

      return {
        id: deniedRequest.id,
        status: deniedRequest.status,
        approvalDate: deniedRequest.approvalDate?.toISOString(),
      };
    }
  );

  /**
   * GET /api/timeoff/admin/staff/:staffId/balance
   * Get specific staff member's current balance (directors only)
   */
  app.fastify.get(
    '/api/timeoff/admin/staff/:staffId/balance',
    {
      schema: {
        description: "Get specific staff member's time-off balance (directors only)",
        tags: ['timeoff-admin'],
        params: {
          type: 'object',
          properties: { staffId: { type: 'string' } },
          required: ['staffId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              staffName: { type: 'string' },
              year: { type: 'number' },
              yearsOfEmployment: { type: 'number' },
              vacationDaysAllotted: { type: 'number' },
              vacationDaysUsed: { type: 'number' },
              sickDaysAllotted: { type: 'number' },
              sickDaysUsed: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;
      const { staffId } = request.params as { staffId: string };

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can view staff balances' };
      }

      const staffProfile = await app.db.query.staffProfiles.findFirst({
        where: eq(schema.staffProfiles.userId, staffId),
      });

      if (!staffProfile) {
        reply.code(404);
        return { error: 'Staff member not found' };
      }

      const staffUserProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, staffId),
      });

      const balance = await getOrCreateBalance(staffId, staffProfile.hireDate);
      const yearsOfEmployment = calculateYearsOfEmployment(staffProfile.hireDate);

      return {
        staffName: `${staffUserProfile?.firstName} ${staffUserProfile?.lastName}`,
        year: balance.year,
        yearsOfEmployment,
        vacationDaysAllotted: storageToDays(balance.vacationDaysAllotted),
        vacationDaysUsed: storageToDays(balance.vacationDaysUsed),
        sickDaysAllotted: storageToDays(balance.sickDaysAllotted),
        sickDaysUsed: storageToDays(balance.sickDaysUsed),
      };
    }
  );

  /**
   * GET /api/timeoff/admin/requests
   * Get all time-off requests with filtering (directors only)
   */
  app.fastify.get(
    '/api/timeoff/admin/requests',
    {
      schema: {
        description: 'Get all time-off requests with filtering (directors only)',
        tags: ['timeoff-admin'],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'approved', 'denied', 'cancelled'] },
            year: { type: 'number' },
            staffId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                staffName: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                daysRequested: { type: 'number' },
                type: { type: 'string' },
                status: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const userId = session.user.id;

      // Verify user is director
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can view all requests' };
      }

      const { status, year, staffId } = request.query as {
        status?: 'pending' | 'approved' | 'denied' | 'cancelled';
        year?: number;
        staffId?: string;
      };

      const conditions = [];

      if (status) {
        conditions.push(eq(schema.timeOffRequests.status, status));
      }

      if (year) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year + 1, 0, 1);
        conditions.push(gte(schema.timeOffRequests.startDate, yearStart));
        conditions.push(lte(schema.timeOffRequests.startDate, yearEnd));
      }

      if (staffId) {
        conditions.push(eq(schema.timeOffRequests.staffId, staffId));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const requests = await app.db.query.timeOffRequests.findMany({
        where: whereClause,
      });

      // Enrich with staff information
      const enrichedRequests = await Promise.all(
        requests.map(async (req) => {
          const staff = await app.db.query.userProfiles.findFirst({
            where: eq(schema.userProfiles.userId, req.staffId),
          });

          return {
            id: req.id,
            staffName: `${staff?.firstName} ${staff?.lastName}`,
            staffId: req.staffId,
            startDate: req.startDate.toISOString(),
            endDate: req.endDate.toISOString(),
            daysRequested: storageToDays(req.daysRequested),
            type: req.type,
            status: req.status,
            reason: req.reason,
            approvedBy: req.approvedBy,
            approvalDate: req.approvalDate?.toISOString(),
          };
        })
      );

      return enrichedRequests;
    }
  );
}
