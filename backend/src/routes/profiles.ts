import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray, ne } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * Helper to enrich child data with parent information
   */
  async function enrichChildWithParents(
    childId: string
  ): Promise<{
    child: typeof schema.children.$inferSelect;
    parents: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      relationship?: string;
      isPrimary: boolean;
    }>;
    siblings: Array<{
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
    }>;
  }> {
    const child = await app.db.query.children.findFirst({
      where: eq(schema.children.id, childId),
      with: {
        childParents: true,
      },
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Get parent details from Better Auth and user profiles
    const parentDetails = await Promise.all(
      child.childParents.map(async (cp) => {
        const userProfile = await app.db.query.userProfiles.findFirst({
          where: eq(schema.userProfiles.userId, cp.parentId),
        });

        const user = await app.db
          .select()
          .from(authSchema.user)
          .where(eq(authSchema.user.id, cp.parentId))
          .limit(1);

        return {
          id: cp.parentId,
          firstName: userProfile?.firstName || 'N/A',
          lastName: userProfile?.lastName || 'N/A',
          email: user[0]?.email || 'N/A',
          phone: userProfile?.phone,
          relationship: cp.relationship,
          isPrimary: cp.isPrimary,
        };
      })
    );

    // Find siblings (other children with same parents)
    const siblingIds = await app.db
      .selectDistinct({
        childId: schema.childParents.childId,
      })
      .from(schema.childParents)
      .where(
        inArray(
          schema.childParents.parentId,
          child.childParents.map((cp) => cp.parentId)
        )
      );

    const siblingChildIds = siblingIds.map((s) => s.childId).filter((id) => id !== childId);
    const siblings =
      siblingChildIds.length > 0
        ? await app.db.query.children.findMany({
            where: inArray(schema.children.id, siblingChildIds),
          })
        : [];

    return {
      child,
      parents: parentDetails,
      siblings,
    };
  }

  /**
   * GET /api/profiles/children
   * Get all children with parent information (staff/directors only)
   */
  app.fastify.get(
    '/api/profiles/children',
    {
      schema: {
        description: 'Get all children with parent information',
        tags: ['profiles'],
        response: {
          200: {
            type: 'array',
            items: { type: 'object' },
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

      const children = await app.db.query.children.findMany({
        with: {
          childParents: true,
        },
      });

      // Enrich with parent info
      const enrichedChildren = await Promise.all(
        children.map(async (child) => {
          const parentDetails = await Promise.all(
            child.childParents.map(async (cp) => {
              const userProf = await app.db.query.userProfiles.findFirst({
                where: eq(schema.userProfiles.userId, cp.parentId),
              });

              const user = await app.db
                .select()
                .from(authSchema.user)
                .where(eq(authSchema.user.id, cp.parentId))
                .limit(1);

              return {
                id: cp.parentId,
                name: `${userProf?.firstName} ${userProf?.lastName}`,
                email: user[0]?.email,
                phone: userProf?.phone,
                relationship: cp.relationship,
                isPrimary: cp.isPrimary,
              };
            })
          );

          return {
            id: child.id,
            firstName: child.firstName,
            lastName: child.lastName,
            dateOfBirth: child.dateOfBirth,
            city: child.city,
            parents: parentDetails,
          };
        })
      );

      return enrichedChildren;
    }
  );

  /**
   * GET /api/profiles/child/:childId
   * Get individual child profile with full details including siblings
   */
  app.fastify.get(
    '/api/profiles/child/:childId',
    {
      schema: {
        description: 'Get individual child profile with full details',
        tags: ['profiles'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              dateOfBirth: { type: 'string' },
              street: { type: 'string' },
              city: { type: 'string' },
              parents: { type: 'array' },
              siblings: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { childId } = request.params as { childId: string };
      const userId = session.user.id;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      // Verify access: parents can only view their own children, staff/directors can view all
      if (userProfile?.role === 'parent') {
        const hasAccess = await app.db.query.childParents.findFirst({
          where: and(
            eq(schema.childParents.childId, childId),
            eq(schema.childParents.parentId, userId)
          ),
        });

        if (!hasAccess) {
          reply.code(403);
          return { error: 'Unauthorized' };
        }
      } else if (!userProfile || !['staff', 'director'].includes(userProfile.role)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      try {
        const enriched = await enrichChildWithParents(childId);

        return {
          id: enriched.child.id,
          firstName: enriched.child.firstName,
          lastName: enriched.child.lastName,
          dateOfBirth: enriched.child.dateOfBirth.toISOString(),
          street: enriched.child.street,
          city: enriched.child.city,
          province: enriched.child.province,
          postalCode: enriched.child.postalCode,
          allergies: enriched.child.allergies,
          generalHealth: enriched.child.generalHealth,
          medicalNotes: enriched.child.medicalNotes,
          albertaHealthcareNumber: enriched.child.albertaHealthcareNumber,
          emergencyContacts: enriched.child.emergencyContacts,
          parentNotes: enriched.child.parentNotes,
          enrollmentDate: enriched.child.enrollmentDate.toISOString(),
          parents: enriched.parents,
          siblings: enriched.siblings.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            dateOfBirth: s.dateOfBirth.toISOString(),
          })),
        };
      } catch (error) {
        reply.code(404);
        return { error: 'Child not found' };
      }
    }
  );

  /**
   * POST /api/profiles/children
   * Create new child profile with parent associations (staff/directors only)
   */
  app.fastify.post(
    '/api/profiles/children',
    {
      schema: {
        description: 'Create new child profile with parent associations',
        tags: ['profiles'],
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            dateOfBirth: { type: 'string', description: 'ISO date string' },
            street: { type: 'string' },
            city: { type: 'string' },
            province: { type: 'string' },
            postalCode: { type: 'string' },
            allergies: { type: 'string' },
            generalHealth: { type: 'string' },
            medicalNotes: { type: 'string' },
            albertaHealthcareNumber: { type: 'string' },
            emergencyContacts: { type: 'object' },
            parentNotes: { type: 'string' },
            isKindergarten: { type: 'boolean', description: 'Is child enrolled in kindergarten' },
            parentIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of parent user IDs to associate',
            },
          },
          required: ['firstName', 'lastName', 'dateOfBirth'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
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

      // Check authorization: user must have staff or director role, or default to director
      const userRole = userProfile?.role || 'director';
      if (!['staff', 'director'].includes(userRole)) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const {
        firstName,
        lastName,
        dateOfBirth,
        street,
        city,
        province,
        postalCode,
        allergies,
        generalHealth,
        medicalNotes,
        albertaHealthcareNumber,
        emergencyContacts,
        parentNotes,
        isKindergarten,
        parentIds,
      } = request.body as {
        firstName: string;
        lastName: string;
        dateOfBirth: string;
        street?: string;
        city?: string;
        province?: string;
        postalCode?: string;
        allergies?: string;
        generalHealth?: string;
        medicalNotes?: string;
        albertaHealthcareNumber?: string;
        emergencyContacts?: unknown;
        parentNotes?: string;
        isKindergarten?: boolean;
        parentIds?: string[];
      };

      const [child] = await app.db
        .insert(schema.children)
        .values({
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          street,
          city,
          province,
          postalCode,
          allergies,
          generalHealth,
          medicalNotes,
          albertaHealthcareNumber,
          isKindergartenEnrolled: isKindergarten || false,
          emergencyContacts: emergencyContacts || null,
          parentNotes,
        })
        .returning();

      app.logger.info(
        { childId: child.id, firstName, lastName },
        'Child profile created'
      );

      // Add parent associations
      if (parentIds && parentIds.length > 0) {
        await app.db.insert(schema.childParents).values(
          parentIds.map((parentId, idx) => ({
            childId: child.id,
            parentId,
            isPrimary: idx === 0, // First parent is primary
          }))
        );
      }

      reply.code(201);
      return {
        id: child.id,
        firstName: child.firstName,
        lastName: child.lastName,
      };
    }
  );

  /**
   * PUT /api/profiles/child/:childId
   * Update child profile information (staff/directors only)
   */
  app.fastify.put(
    '/api/profiles/child/:childId',
    {
      schema: {
        description: 'Update child profile information',
        tags: ['profiles'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            province: { type: 'string' },
            postalCode: { type: 'string' },
            allergies: { type: 'string' },
            generalHealth: { type: 'string' },
            medicalNotes: { type: 'string' },
            albertaHealthcareNumber: { type: 'string' },
            emergencyContacts: { type: 'object' },
            parentNotes: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string' },
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

      const { childId } = request.params as { childId: string };
      const updates = request.body as Record<string, unknown>;

      // Filter to only allowed fields
      const allowedFields = [
        'firstName',
        'lastName',
        'street',
        'city',
        'province',
        'postalCode',
        'allergies',
        'generalHealth',
        'medicalNotes',
        'albertaHealthcareNumber',
        'emergencyContacts',
        'parentNotes',
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in updates) {
          updateData[field] = updates[field];
        }
      }

      updateData.updatedAt = new Date();

      const [updated] = await app.db
        .update(schema.children)
        .set(updateData)
        .where(eq(schema.children.id, childId))
        .returning();

      if (!updated) {
        reply.code(404);
        return { error: 'Child not found' };
      }

      return {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
      };
    }
  );

  /**
   * DELETE /api/profiles/child/:childId
   * Delete child profile (directors only)
   */
  app.fastify.delete(
    '/api/profiles/child/:childId',
    {
      schema: {
        description: 'Delete child profile (directors only)',
        tags: ['profiles'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
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

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can delete profiles' };
      }

      const { childId } = request.params as { childId: string };

      await app.db.delete(schema.children).where(eq(schema.children.id, childId));

      return { success: true };
    }
  );

  /**
   * POST /api/profiles/child/:childId/parents
   * Add parent association to child (staff/directors only)
   */
  app.fastify.post(
    '/api/profiles/child/:childId/parents',
    {
      schema: {
        description: 'Add parent association to child',
        tags: ['profiles'],
        params: {
          type: 'object',
          properties: { childId: { type: 'string' } },
          required: ['childId'],
        },
        body: {
          type: 'object',
          properties: {
            parentId: { type: 'string' },
            relationship: { type: 'string' },
            isPrimary: { type: 'boolean' },
          },
          required: ['parentId'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              childId: { type: 'string' },
              parentId: { type: 'string' },
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

      const { childId } = request.params as { childId: string };
      const { parentId, relationship, isPrimary } = request.body as {
        parentId: string;
        relationship?: string;
        isPrimary?: boolean;
      };

      const [link] = await app.db
        .insert(schema.childParents)
        .values({
          childId,
          parentId,
          relationship,
          isPrimary: isPrimary || false,
        })
        .returning();

      reply.code(201);
      return {
        id: link.id,
        childId: link.childId,
        parentId: link.parentId,
      };
    }
  );
}
