/**
 * Route Helper Utilities
 * DRY principles: Reusable route handlers and middleware patterns
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { createSuccessResponse, createErrorResponse } from './responseHelpers';
import { safeAuditLogFromRequest } from './auditHelpers';
import { validateContextOrRespond } from './contextHelpers';

/**
 * Standardized error handler wrapper for async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Creates a standardized GET handler for a single resource
 */
export function createGetHandler<T>(options: {
  getResource: (client: PoolClient, schema: string, id: string) => Promise<T | null>;
  resourceName: string;
  auditAction?: string;
  requirePermission?: string;
}) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    try {
      const resource = await options.getResource(
        context.tenantClient,
        context.tenant.schema,
        req.params.id
      );

      if (!resource) {
        return res.status(404).json(createErrorResponse(`${options.resourceName} not found`));
      }

      // Audit log if specified
      if (options.auditAction && req.user) {
        await safeAuditLogFromRequest(
          req,
          {
            action: options.auditAction,
            resourceType: options.resourceName.toLowerCase(),
            resourceId: req.params.id,
            details: { [`${options.resourceName.toLowerCase()}Id`]: req.params.id },
            severity: 'info',
          },
          `${options.resourceName.toLowerCase()}s`
        );
      }

      res.json(createSuccessResponse(resource, `${options.resourceName} retrieved successfully`));
      return;
    } catch (error) {
      next(error);
      return;
    }
  });
}

/**
 * Creates a standardized POST handler for creating resources
 */
export function createPostHandler<TInput, TOutput>(options: {
  createResource: (
    client: PoolClient,
    schema: string,
    input: TInput,
    actorId?: string,
    tenantId?: string
  ) => Promise<TOutput>;
  resourceName: string;
  auditAction?: string;
}) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    try {
      const resource = await options.createResource(
        context.tenantClient,
        context.tenant.schema,
        req.body,
        context.user.id,
        context.tenant.id
      );

      // Audit log if specified
      if (options.auditAction) {
        await safeAuditLogFromRequest(
          req,
          {
            action: options.auditAction,
            resourceType: options.resourceName.toLowerCase(),
            resourceId: (resource as { id?: string })?.id,
            details: {
              [`${options.resourceName.toLowerCase()}Id`]: (resource as { id?: string })?.id,
            },
            severity: 'info',
          },
          `${options.resourceName.toLowerCase()}s`
        );
      }

      res
        .status(201)
        .json(createSuccessResponse(resource, `${options.resourceName} created successfully`));
      return;
    } catch (error) {
      next(error);
      return;
    }
  });
}

/**
 * Creates a standardized PUT handler for updating resources
 */
export function createPutHandler<TInput, TOutput>(options: {
  updateResource: (
    client: PoolClient,
    schema: string,
    id: string,
    input: Partial<TInput>
  ) => Promise<TOutput | null>;
  resourceName: string;
  auditAction?: string;
  getAuditDetails?: (req: Request, resource: TOutput) => Record<string, unknown>;
}) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    try {
      const resource = await options.updateResource(
        context.tenantClient,
        context.tenant.schema,
        req.params.id,
        req.body
      );

      if (!resource) {
        return res.status(404).json(createErrorResponse(`${options.resourceName} not found`));
      }

      // Audit log if specified
      if (options.auditAction) {
        const auditDetails = options.getAuditDetails
          ? options.getAuditDetails(req, resource)
          : {
              [`${options.resourceName.toLowerCase()}Id`]: req.params.id,
              updatedFields: Object.keys(req.body),
            };

        await safeAuditLogFromRequest(
          req,
          {
            action: options.auditAction,
            resourceType: options.resourceName.toLowerCase(),
            resourceId: req.params.id,
            details: auditDetails,
            severity: 'info',
          },
          `${options.resourceName.toLowerCase()}s`
        );
      }

      res.json(createSuccessResponse(resource, `${options.resourceName} updated successfully`));
      return;
    } catch (error) {
      next(error);
      return;
    }
  });
}

/**
 * Creates a standardized DELETE handler
 */
export function createDeleteHandler(options: {
  deleteResource: (client: PoolClient, schema: string, id: string) => Promise<void>;
  resourceName: string;
  auditAction?: string;
}) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    try {
      await options.deleteResource(context.tenantClient, context.tenant.schema, req.params.id);

      // Audit log if specified
      if (options.auditAction && req.user) {
        await safeAuditLogFromRequest(
          req,
          {
            action: options.auditAction,
            resourceType: options.resourceName.toLowerCase(),
            resourceId: req.params.id,
            details: { [`${options.resourceName.toLowerCase()}Id`]: req.params.id },
            severity: 'info',
          },
          `${options.resourceName.toLowerCase()}s`
        );
      }

      res
        .status(200)
        .json(createSuccessResponse(null, `${options.resourceName} deleted successfully`));
    } catch (error) {
      next(error);
    }
  });
}

/**
 * Creates a standardized GET/PUT handler for upsert operations (like school, branding)
 */
export function createUpsertHandlers<TInput, TOutput>(options: {
  getResource: (client: PoolClient, schema: string) => Promise<TOutput | null>;
  upsertResource: (client: PoolClient, schema: string, input: TInput) => Promise<TOutput>;
  resourceName: string;
  auditAction: string;
  schema: z.ZodSchema<TInput>;
}) {
  const getHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    try {
      const resource = await options.getResource(context.tenantClient, context.tenant.schema);
      res.json(resource ?? {});
      return;
    } catch (error) {
      next(error);
      return;
    }
  });

  const putHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const context = validateContextOrRespond(req, res);
    if (!context) return;

    const parsed = options.schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(createErrorResponse(parsed.error.message));
    }

    try {
      const resource = await options.upsertResource(
        context.tenantClient,
        context.tenant.schema,
        parsed.data
      );

      // Audit log
      await safeAuditLogFromRequest(
        req,
        {
          action: options.auditAction,
          resourceType: options.resourceName.toLowerCase(),
          resourceId: context.tenant.id,
          details: {
            updatedFields: Object.keys(parsed.data as Record<string, unknown>),
          },
          severity: 'info',
        },
        options.resourceName.toLowerCase()
      );

      res.json(resource);
    } catch (error) {
      next(error);
    }
  });

  return { getHandler, putHandler };
}

/**
 * Validates request body with Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(createErrorResponse(parsed.error.message));
      return;
    }
    req.body = parsed.data;
    next();
  };
}
