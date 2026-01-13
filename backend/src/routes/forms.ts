import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Form field types supported
 */
interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date';
  label: string;
  required?: boolean;
  options?: string[]; // for select fields
  fieldMappingKey?: string; // optional key to map to child profile field
}

interface FormContent {
  fields: FormField[];
}

export function registerFormRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/forms
   * Create a new custom form (directors only)
   */
  app.fastify.post(
    '/api/forms',
    {
      schema: {
        description: 'Create a new custom form (directors only)',
        tags: ['forms'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content: {
              type: 'object',
              properties: {
                fields: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      type: { type: 'string' },
                      label: { type: 'string' },
                      required: { type: 'boolean' },
                      options: { type: 'array' },
                      fieldMappingKey: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          required: ['title', 'content'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
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

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can create forms' };
      }

      const { title, description, content } = request.body as {
        title: string;
        description?: string;
        content: FormContent;
      };

      const [form] = await app.db
        .insert(schema.forms)
        .values({
          title,
          description,
          content,
          createdBy: session.user.id,
          isActive: true,
        })
        .returning();

      reply.code(201);
      return {
        id: form.id,
        title: form.title,
        description: form.description,
      };
    }
  );

  /**
   * GET /api/forms
   * Get all active forms (parents) or all forms (staff/directors)
   */
  app.fastify.get(
    '/api/forms',
    {
      schema: {
        description: 'Get forms available to user',
        tags: ['forms'],
        querystring: {
          type: 'object',
          properties: {
            includeInactive: { type: 'boolean', description: 'Include inactive forms (directors only)' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                isActive: { type: 'boolean' },
              },
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

      if (!userProfile) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      const { includeInactive } = request.query as { includeInactive?: boolean };

      // Parents only see active forms
      // Staff/directors can optionally see inactive forms
      const isDirector = userProfile.role === 'director';
      const showInactive = includeInactive && isDirector;

      const forms = showInactive
        ? await app.db.query.forms.findMany({})
        : await app.db.query.forms.findMany({
            where: eq(schema.forms.isActive, true),
          });

      return forms.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        isActive: f.isActive,
        createdAt: f.createdAt.toISOString(),
      }));
    }
  );

  /**
   * GET /api/forms/:formId
   * Get form details with fields (public - form content visible to parents)
   */
  app.fastify.get(
    '/api/forms/:formId',
    {
      schema: {
        description: 'Get form details with fields',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              content: { type: 'object' },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { formId } = request.params as { formId: string };

      const form = await app.db.query.forms.findFirst({
        where: eq(schema.forms.id, formId),
      });

      if (!form) {
        reply.code(404);
        return { error: 'Form not found' };
      }

      // Check if form is active for non-director users
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, session.user.id),
      });

      if (!form.isActive && userProfile?.role !== 'director') {
        reply.code(404);
        return { error: 'Form not found' };
      }

      return {
        id: form.id,
        title: form.title,
        description: form.description,
        content: form.content,
        isActive: form.isActive,
      };
    }
  );

  /**
   * PUT /api/forms/:formId
   * Update form (directors only)
   */
  app.fastify.put(
    '/api/forms/:formId',
    {
      schema: {
        description: 'Update form (directors only)',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            content: { type: 'object' },
            isActive: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
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

      if (!userProfile || userProfile.role !== 'director') {
        reply.code(403);
        return { error: 'Only directors can update forms' };
      }

      const { formId } = request.params as { formId: string };
      const { title, description, content, isActive } = request.body as {
        title?: string;
        description?: string;
        content?: FormContent;
        isActive?: boolean;
      };

      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (content !== undefined) updateData.content = content;
      if (isActive !== undefined) updateData.isActive = isActive;
      updateData.updatedAt = new Date();

      const [updated] = await app.db
        .update(schema.forms)
        .set(updateData)
        .where(eq(schema.forms.id, formId))
        .returning();

      if (!updated) {
        reply.code(404);
        return { error: 'Form not found' };
      }

      return {
        id: updated.id,
        title: updated.title,
      };
    }
  );

  /**
   * DELETE /api/forms/:formId
   * Delete form (directors only)
   */
  app.fastify.delete(
    '/api/forms/:formId',
    {
      schema: {
        description: 'Delete form (directors only)',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
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
        return { error: 'Only directors can delete forms' };
      }

      const { formId } = request.params as { formId: string };

      await app.db.delete(schema.forms).where(eq(schema.forms.id, formId));

      return { success: true };
    }
  );

  /**
   * POST /api/forms/:formId/submit
   * Submit form response and auto-sync to child profile
   */
  app.fastify.post(
    '/api/forms/:formId/submit',
    {
      schema: {
        description: 'Submit form response and auto-sync to child profile',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        body: {
          type: 'object',
          properties: {
            childId: { type: 'string', description: 'Child to associate form with' },
            responses: { type: 'object', description: 'Form field responses' },
            finalSubmit: { type: 'boolean', description: 'Save as final submission vs draft' },
          },
          required: ['childId', 'responses'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              syncedFields: { type: 'array' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { formId } = request.params as { formId: string };
      const { childId, responses, finalSubmit } = request.body as {
        childId: string;
        responses: Record<string, unknown>;
        finalSubmit?: boolean;
      };

      const userId = session.user.id;

      // Verify parent has access to this child
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

      // Get form to extract field mappings
      const form = await app.db.query.forms.findFirst({
        where: eq(schema.forms.id, formId),
      });

      if (!form) {
        reply.code(404);
        return { error: 'Form not found' };
      }

      // Auto-sync responses to child profile
      const formContent = form.content as FormContent;
      const syncedFields: string[] = [];
      const childUpdates: Record<string, unknown> = {};

      if (formContent.fields) {
        for (const field of formContent.fields) {
          const responseValue = responses[field.id];

          if (responseValue && field.fieldMappingKey) {
            // Map to child profile field
            const mappingKey = field.fieldMappingKey;

            // Handle specific field mappings
            if (mappingKey === 'allergies') {
              childUpdates.allergies = responseValue;
              syncedFields.push('allergies');
            } else if (mappingKey === 'generalHealth') {
              childUpdates.generalHealth = responseValue;
              syncedFields.push('generalHealth');
            } else if (mappingKey === 'medicalNotes') {
              childUpdates.medicalNotes = responseValue;
              syncedFields.push('medicalNotes');
            } else if (mappingKey === 'albertaHealthcareNumber') {
              childUpdates.albertaHealthcareNumber = responseValue;
              syncedFields.push('albertaHealthcareNumber');
            } else if (mappingKey === 'parentNotes') {
              childUpdates.parentNotes = responseValue;
              syncedFields.push('parentNotes');
            } else if (mappingKey === 'street') {
              childUpdates.street = responseValue;
              syncedFields.push('street');
            } else if (mappingKey === 'city') {
              childUpdates.city = responseValue;
              syncedFields.push('city');
            } else if (mappingKey === 'province') {
              childUpdates.province = responseValue;
              syncedFields.push('province');
            } else if (mappingKey === 'postalCode') {
              childUpdates.postalCode = responseValue;
              syncedFields.push('postalCode');
            }
          }
        }
      }

      // Update child profile if there are synced fields
      if (syncedFields.length > 0) {
        childUpdates.updatedAt = new Date();
        await app.db
          .update(schema.children)
          .set(childUpdates)
          .where(eq(schema.children.id, childId));
      }

      // Create or update form submission
      const status = finalSubmit ? 'submitted' : 'draft';
      const submittedAt = finalSubmit ? new Date() : null;

      // Check if draft submission exists
      const existingSubmission = await app.db.query.formSubmissions.findFirst({
        where: and(
          eq(schema.formSubmissions.formId, formId),
          eq(schema.formSubmissions.parentId, userId),
          eq(schema.formSubmissions.childId, childId),
          eq(schema.formSubmissions.status, 'draft')
        ),
      });

      if (existingSubmission) {
        // Update existing draft
        const [updated] = await app.db
          .update(schema.formSubmissions)
          .set({
            responses,
            status,
            submittedAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.formSubmissions.id, existingSubmission.id))
          .returning();

        reply.code(201);
        return {
          id: updated.id,
          status: updated.status,
          syncedFields,
        };
      } else {
        // Create new submission
        const [submission] = await app.db
          .insert(schema.formSubmissions)
          .values({
            formId,
            parentId: userId,
            childId,
            responses,
            status,
            submittedAt,
          })
          .returning();

        reply.code(201);
        return {
          id: submission.id,
          status: submission.status,
          syncedFields,
        };
      }
    }
  );

  /**
   * GET /api/forms/:formId/submissions
   * Get form submissions (directors see all, parents see their own)
   */
  app.fastify.get(
    '/api/forms/:formId/submissions',
    {
      schema: {
        description: 'Get form submissions (directors see all, parents see their own)',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { formId: { type: 'string' } },
          required: ['formId'],
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                parentName: { type: 'string' },
                childName: { type: 'string' },
                status: { type: 'string' },
                submittedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { formId } = request.params as { formId: string };
      const userId = session.user.id;

      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (!userProfile) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      // Directors see all submissions, parents see only their own
      const submissions =
        userProfile.role === 'director'
          ? await app.db.query.formSubmissions.findMany({
              where: eq(schema.formSubmissions.formId, formId),
            })
          : await app.db.query.formSubmissions.findMany({
              where: and(
                eq(schema.formSubmissions.formId, formId),
                eq(schema.formSubmissions.parentId, userId)
              ),
            });

      // Enrich with names
      const enriched = await Promise.all(
        submissions.map(async (sub) => {
          const parent = await app.db.query.userProfiles.findFirst({
            where: eq(schema.userProfiles.userId, sub.parentId),
          });

          const child = await app.db.query.children.findFirst({
            where: eq(schema.children.id, sub.childId || ''),
          });

          return {
            id: sub.id,
            parentName: `${parent?.firstName} ${parent?.lastName}`,
            childName: child ? `${child.firstName} ${child.lastName}` : 'N/A',
            status: sub.status,
            submittedAt: sub.submittedAt?.toISOString(),
          };
        })
      );

      return enriched;
    }
  );

  /**
   * GET /api/forms/submissions/:submissionId
   * Get specific form submission details
   */
  app.fastify.get(
    '/api/forms/submissions/:submissionId',
    {
      schema: {
        description: 'Get specific form submission details',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { submissionId: { type: 'string' } },
          required: ['submissionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              formId: { type: 'string' },
              childId: { type: 'string' },
              responses: { type: 'object' },
              status: { type: 'string' },
              submittedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const { submissionId } = request.params as { submissionId: string };
      const userId = session.user.id;

      const submission = await app.db.query.formSubmissions.findFirst({
        where: eq(schema.formSubmissions.id, submissionId),
      });

      if (!submission) {
        reply.code(404);
        return { error: 'Submission not found' };
      }

      // Verify access: parents see only their own, directors see all
      const userProfile = await app.db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (userProfile?.role !== 'director' && submission.parentId !== userId) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      return {
        id: submission.id,
        formId: submission.formId,
        childId: submission.childId,
        responses: submission.responses,
        status: submission.status,
        submittedAt: submission.submittedAt?.toISOString(),
      };
    }
  );

  /**
   * PUT /api/forms/submissions/:submissionId
   * Update draft submission before final submission
   */
  app.fastify.put(
    '/api/forms/submissions/:submissionId',
    {
      schema: {
        description: 'Update draft submission before final submission',
        tags: ['forms'],
        params: {
          type: 'object',
          properties: { submissionId: { type: 'string' } },
          required: ['submissionId'],
        },
        body: {
          type: 'object',
          properties: {
            responses: { type: 'object' },
            finalSubmit: { type: 'boolean' },
          },
          required: ['responses'],
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

      const { submissionId } = request.params as { submissionId: string };
      const { responses, finalSubmit } = request.body as {
        responses: Record<string, unknown>;
        finalSubmit?: boolean;
      };
      const userId = session.user.id;

      const submission = await app.db.query.formSubmissions.findFirst({
        where: eq(schema.formSubmissions.id, submissionId),
      });

      if (!submission) {
        reply.code(404);
        return { error: 'Submission not found' };
      }

      if (submission.parentId !== userId) {
        reply.code(403);
        return { error: 'Unauthorized' };
      }

      if (submission.status !== 'draft') {
        reply.code(400);
        return { error: 'Can only update draft submissions' };
      }

      const status = finalSubmit ? 'submitted' : 'draft';
      const submittedAt = finalSubmit ? new Date() : null;

      const [updated] = await app.db
        .update(schema.formSubmissions)
        .set({
          responses,
          status,
          submittedAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.formSubmissions.id, submissionId))
        .returning();

      return {
        id: updated.id,
        status: updated.status,
      };
    }
  );
}
