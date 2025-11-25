# PHASE A6 — Actionable Refactor Tasks

**Date:** 2025-01-23  
**Status:** ✅ Complete  
**Based on:** PHASE_A5_ARCHITECTURAL_VALIDATION.md + PHASE_A4_CONSOLIDATION_STRATEGY.md

---

## Prerequisites (Fix Phase A5 Issues First)

Before starting Phase A6, complete these fixes from Phase A5:

1. ✅ Fix Error Response Interface Alignment
2. ✅ Fix PasswordValidationResult Interface Alignment  
3. ✅ Create Password Validation Wrapper Function
4. ✅ Verify Frontend Error Format Compatibility

---

## Actionable Refactor Tasks

```json
{
  "actions": [
    {
      "name": "Fix Error Response Interface Alignment (Prerequisite)",
      "priority": "HIGH",
      "blocks": ["Error Response Helpers Consolidation"],
      "steps": [
        {
          "step": 1,
          "action": "Read frontend error handling code",
          "tool": "read_file",
          "files": [
            "frontend/src/lib/api.ts",
            "frontend/src/lib/errorMapper.ts",
            "frontend/src/lib/apiResponseUtils.ts"
          ],
          "purpose": "Verify frontend expects 'success: boolean' or 'status: error' format"
        },
        {
          "step": 2,
          "action": "Update routes/auth.ts to use responseHelpers.ts format",
          "tool": "search_replace",
          "file": "backend/src/routes/auth.ts",
          "oldImport": "import { createErrorResponse } from '../lib/apiErrors';",
          "newImport": "import { createErrorResponse } from '../lib/responseHelpers';",
          "note": "Change import from apiErrors to responseHelpers"
        },
        {
          "step": 3,
          "action": "Verify error response format compatibility",
          "tool": "grep",
          "pattern": "createErrorResponse|ApiErrorResponse",
          "path": "backend/src/routes/auth.ts",
          "purpose": "Ensure all usages are compatible with responseHelpers format"
        },
        {
          "step": 4,
          "action": "Update frontend if needed",
          "tool": "search_replace",
          "files": ["frontend/src/lib/api.ts", "frontend/src/lib/errorMapper.ts"],
          "condition": "If frontend expects 'status' field, update to handle 'success' field",
          "purpose": "Ensure frontend can parse responseHelpers format"
        },
        {
          "step": 5,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 6,
          "action": "Test error responses",
          "tool": "manual_test",
          "purpose": "Test error handling in routes/auth.ts still works"
        }
      ],
      "filesInvolved": [
        "backend/src/routes/auth.ts",
        "frontend/src/lib/api.ts (if needed)",
        "frontend/src/lib/errorMapper.ts (if needed)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Error responses in auth routes",
        "Frontend error handling test"
      ]
    },
    {
      "name": "Fix PasswordValidationResult Interface Alignment (Prerequisite)",
      "priority": "HIGH",
      "blocks": ["Password Validation Consolidation"],
      "steps": [
        {
          "step": 1,
          "action": "Update PasswordValidationResult interface in validation.ts",
          "tool": "search_replace",
          "file": "backend/src/middleware/validation.ts",
          "oldString": "export interface PasswordValidationResult {\n  valid: boolean;\n  errors: string[];\n}",
          "newString": "export interface PasswordValidationResult {\n  isValid: boolean;\n  errors: string[];\n}",
          "purpose": "Change 'valid' to 'isValid' to match passwordPolicyService"
        },
        {
          "step": 2,
          "action": "Update validatePasswordStrength return value",
          "tool": "search_replace",
          "file": "backend/src/middleware/validation.ts",
          "oldString": "  return {\n    valid: errors.length === 0,\n    errors\n  };",
          "newString": "  return {\n    isValid: errors.length === 0,\n    errors\n  };",
          "purpose": "Change return property from 'valid' to 'isValid'"
        },
        {
          "step": 3,
          "action": "Update authValidation.ts to use isValid",
          "tool": "search_replace",
          "file": "backend/src/services/authValidation.ts",
          "oldString": "  const passwordValidation = validatePasswordStrength(input.password);\n  if (!passwordValidation.valid) {",
          "newString": "  const passwordValidation = validatePasswordStrength(input.password);\n  if (!passwordValidation.isValid) {",
          "purpose": "Change .valid to .isValid"
        },
        {
          "step": 4,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 5,
          "action": "Test password validation",
          "tool": "manual_test",
          "purpose": "Test password validation in registration and auth flows"
        }
      ],
      "filesInvolved": [
        "backend/src/middleware/validation.ts",
        "backend/src/services/authValidation.ts"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Password validation in registration",
        "Manual test: Password validation in password reset"
      ]
    },
    {
      "name": "Create Password Validation Wrapper Function (Prerequisite)",
      "priority": "MEDIUM",
      "blocks": ["Password Validation Consolidation"],
      "steps": [
        {
          "step": 1,
          "action": "Read passwordPolicyService to understand default policy",
          "tool": "read_file",
          "file": "backend/src/services/security/passwordPolicyService.ts",
          "purpose": "Understand how to get default policy"
        },
        {
          "step": 2,
          "action": "Create wrapper function in validation.ts",
          "tool": "search_replace",
          "file": "backend/src/middleware/validation.ts",
          "oldString": "export function validatePasswordStrength(password: string): PasswordValidationResult {",
          "newString": "import { validatePassword, getPasswordPolicy, type PasswordPolicy } from '../services/security/passwordPolicyService';\nimport { getPool } from '../db/connection';\n\n/**\n * @deprecated Use passwordPolicyService.validatePassword() with policy instead.\n * This wrapper is kept for backward compatibility.\n */\nexport async function validatePasswordStrength(password: string): Promise<PasswordValidationResult> {",
          "purpose": "Convert to async and import passwordPolicyService"
        },
        {
          "step": 3,
          "action": "Replace implementation with policy-based call",
          "tool": "search_replace",
          "file": "backend/src/middleware/validation.ts",
          "oldString": "  const errors: string[] = [];\n\n  if (password.length < 8) {\n    errors.push('Password must be at least 8 characters long');\n  }\n\n  if (!/[A-Z]/.test(password)) {\n    errors.push('Password must contain at least one uppercase letter');\n  }\n\n  if (!/[a-z]/.test(password)) {\n    errors.push('Password must contain at least one lowercase letter');\n  }\n\n  if (!/[0-9]/.test(password)) {\n    errors.push('Password must contain at least one number');\n  }\n\n  if (!/[^A-Za-z0-9]/.test(password)) {\n    errors.push('Password must contain at least one symbol');\n  }\n\n  return {\n    isValid: errors.length === 0,\n    errors\n  };",
          "newString": "  const pool = getPool();\n  const client = await pool.connect();\n  try {\n    const defaultPolicy = await getPasswordPolicy(client);\n    const result = validatePassword(password, defaultPolicy);\n    return {\n      isValid: result.isValid,\n      errors: result.errors\n    };\n  } finally {\n    client.release();\n  }",
          "purpose": "Use policy-based validation with default policy"
        },
        {
          "step": 4,
          "action": "Update authValidation.ts to handle async",
          "tool": "search_replace",
          "file": "backend/src/services/authValidation.ts",
          "oldString": "export function validateSignupInput(input: SignUpInputRaw): SignUpInputNormalized {",
          "newString": "export async function validateSignupInput(input: SignUpInputRaw): Promise<SignUpInputNormalized> {",
          "purpose": "Make function async to support async password validation"
        },
        {
          "step": 5,
          "action": "Update password validation call to await",
          "tool": "search_replace",
          "file": "backend/src/services/authValidation.ts",
          "oldString": "  const passwordValidation = validatePasswordStrength(input.password);",
          "newString": "  const passwordValidation = await validatePasswordStrength(input.password);",
          "purpose": "Await async password validation"
        },
        {
          "step": 6,
          "action": "Find all callers of validateSignupInput",
          "tool": "grep",
          "pattern": "validateSignupInput",
          "path": "backend/src",
          "purpose": "Find all usages that need to be updated to await"
        },
        {
          "step": 7,
          "action": "Update all callers to await validateSignupInput",
          "tool": "search_replace",
          "files": "All files using validateSignupInput",
          "purpose": "Add await to all calls"
        },
        {
          "step": 8,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 9,
          "action": "Test password validation",
          "tool": "manual_test",
          "purpose": "Test password validation works with policy-based approach"
        }
      ],
      "filesInvolved": [
        "backend/src/middleware/validation.ts",
        "backend/src/services/authValidation.ts",
        "All files calling validateSignupInput (need to find and update)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Password validation with default policy",
        "Manual test: Registration flow",
        "Manual test: Password reset flow"
      ]
    },
    {
      "name": "IP Extraction Logic Consolidation",
      "priority": "HIGH",
      "steps": [
        {
          "step": 1,
          "action": "Read extractIpAddress from superuserHelpers.ts",
          "tool": "read_file",
          "file": "backend/src/lib/superuserHelpers.ts",
          "offset": 25,
          "limit": 15,
          "purpose": "Copy the most comprehensive implementation"
        },
        {
          "step": 2,
          "action": "Create new file requestUtils.ts",
          "tool": "write",
          "file": "backend/src/lib/requestUtils.ts",
          "content": "import type { Request } from 'express';\n\n/**\n * Extract IP address from request\n * Handles proxy headers (x-forwarded-for, x-real-ip)\n */\nexport function extractIpAddress(req: Request): string | null {\n  const forwardedFor = req.headers['x-forwarded-for'];\n  if (forwardedFor) {\n    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];\n    return ips.trim();\n  }\n\n  const realIp = req.headers['x-real-ip'];\n  if (realIp) {\n    return Array.isArray(realIp) ? realIp[0] : realIp;\n  }\n\n  return req.ip || req.socket.remoteAddress || null;\n}\n\n/**\n * Get client identifier for rate limiting\n * Uses user ID if authenticated, otherwise uses IP address\n */\nexport function getClientIdentifier(req: Request): string {\n  if (req.user?.id) {\n    return `user:${req.user.id}`;\n  }\n  \n  const ip = extractIpAddress(req);\n  return `ip:${ip || 'unknown'}`;\n}",
          "purpose": "Create canonical IP extraction utility"
        },
        {
          "step": 3,
          "action": "Update rateLimiter.ts to import from requestUtils",
          "tool": "search_replace",
          "file": "backend/src/middleware/rateLimiter.ts",
          "oldString": "import rateLimit from 'express-rate-limit';\nimport { Request } from 'express';",
          "newString": "import rateLimit from 'express-rate-limit';\nimport { Request } from 'express';\nimport { getClientIdentifier } from '../lib/requestUtils';",
          "purpose": "Add import for getClientIdentifier"
        },
        {
          "step": 4,
          "action": "Remove getClientIdentifier function from rateLimiter.ts",
          "tool": "search_replace",
          "file": "backend/src/middleware/rateLimiter.ts",
          "oldString": "/**\n * Get client identifier for rate limiting\n */\nexport function getClientIdentifier(req: Request): string {\n  // Use user ID if authenticated, otherwise use IP\n  if (req.user?.id) {\n    return `user:${req.user.id}`;\n  }\n  \n  // Get IP from various headers (for proxy/load balancer scenarios)\n  const forwarded = req.headers['x-forwarded-for'];\n  const ip = forwarded\n    ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])\n    : req.socket.remoteAddress || 'unknown';\n  \n  return `ip:${ip}`;\n}",
          "newString": "",
          "purpose": "Remove duplicate function, now using requestUtils"
        },
        {
          "step": 5,
          "action": "Update mutationRateLimiter.ts to import extractIpAddress",
          "tool": "search_replace",
          "file": "backend/src/middleware/mutationRateLimiter.ts",
          "oldString": "import rateLimit from 'express-rate-limit';\nimport { Request } from 'express';",
          "newString": "import rateLimit from 'express-rate-limit';\nimport { Request } from 'express';\nimport { extractIpAddress } from '../lib/requestUtils';",
          "purpose": "Add import for extractIpAddress"
        },
        {
          "step": 6,
          "action": "Replace inline IP extraction in mutationRateLimiter.ts keyGenerator functions",
          "tool": "search_replace",
          "file": "backend/src/middleware/mutationRateLimiter.ts",
          "oldString": "    const forwarded = req.headers['x-forwarded-for'];\n    const ip = forwarded\n      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])\n      : req.socket.remoteAddress || 'unknown';",
          "newString": "    const ip = extractIpAddress(req) || 'unknown';",
          "replaceAll": true,
          "purpose": "Replace all inline IP extraction with extractIpAddress call"
        },
        {
          "step": 7,
          "action": "Update ipWhitelist.ts to import extractIpAddress",
          "tool": "search_replace",
          "file": "backend/src/middleware/ipWhitelist.ts",
          "oldString": "import type { Request, Response, NextFunction } from 'express';\nimport { getPool } from '../db/connection';\nimport { isIpWhitelisted } from '../services/security/ipWhitelistService';",
          "newString": "import type { Request, Response, NextFunction } from 'express';\nimport { getPool } from '../db/connection';\nimport { isIpWhitelisted } from '../services/security/ipWhitelistService';\nimport { extractIpAddress } from '../lib/requestUtils';",
          "purpose": "Add import for extractIpAddress"
        },
        {
          "step": 8,
          "action": "Replace inline IP extraction in ipWhitelist.ts",
          "tool": "search_replace",
          "file": "backend/src/middleware/ipWhitelist.ts",
          "oldString": "    // Get IP address\n    const forwarded = req.headers['x-forwarded-for'];\n    const ipAddress = forwarded\n      ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])\n      : req.socket.remoteAddress || req.ip || 'unknown';",
          "newString": "    // Get IP address\n    const ipAddress = extractIpAddress(req) || 'unknown';",
          "purpose": "Replace inline IP extraction"
        },
        {
          "step": 9,
          "action": "Update superuserHelpers.ts to import extractIpAddress",
          "tool": "search_replace",
          "file": "backend/src/lib/superuserHelpers.ts",
          "oldString": "import { Request } from 'express';",
          "newString": "import { Request } from 'express';\nimport { extractIpAddress } from './requestUtils';",
          "purpose": "Add import for extractIpAddress"
        },
        {
          "step": 10,
          "action": "Remove extractIpAddress function from superuserHelpers.ts",
          "tool": "search_replace",
          "file": "backend/src/lib/superuserHelpers.ts",
          "oldString": "/**\n * Extract IP address from request\n * Handles proxy headers (x-forwarded-for, x-real-ip)\n */\nexport function extractIpAddress(req: Request): string | null {\n  const forwardedFor = req.headers['x-forwarded-for'];\n  if (forwardedFor) {\n    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];\n    return ips.trim();\n  }\n\n  const realIp = req.headers['x-real-ip'];\n  if (realIp) {\n    return Array.isArray(realIp) ? realIp[0] : realIp;\n  }\n\n  return req.ip || req.socket.remoteAddress || null;\n}",
          "newString": "",
          "purpose": "Remove duplicate function, now using requestUtils"
        },
        {
          "step": 11,
          "action": "Update rateLimitPerTenant.ts to import extractIpAddress",
          "tool": "search_replace",
          "file": "backend/src/middleware/rateLimitPerTenant.ts",
          "oldString": "import type { Request, Response, NextFunction } from 'express';\nimport { getPool } from '../db/connection';",
          "newString": "import type { Request, Response, NextFunction } from 'express';\nimport { getPool } from '../db/connection';\nimport { extractIpAddress } from '../lib/requestUtils';",
          "purpose": "Add import for extractIpAddress"
        },
        {
          "step": 12,
          "action": "Replace simple IP extraction in rateLimitPerTenant.ts",
          "tool": "search_replace",
          "file": "backend/src/middleware/rateLimitPerTenant.ts",
          "oldString": "        const identifier = req.user?.id || req.ip || 'anonymous';",
          "newString": "        const identifier = req.user?.id || extractIpAddress(req) || 'anonymous';",
          "purpose": "Replace simple IP extraction with extractIpAddress"
        },
        {
          "step": 13,
          "action": "Check for other files using extractIpAddress from superuserHelpers",
          "tool": "grep",
          "pattern": "from.*superuserHelpers.*extractIpAddress|extractIpAddress.*superuserHelpers",
          "path": "backend/src",
          "purpose": "Find any other files importing extractIpAddress from superuserHelpers"
        },
        {
          "step": 14,
          "action": "Update any other files to import from requestUtils",
          "tool": "search_replace",
          "files": "Any files found in step 13",
          "oldImport": "from '../lib/superuserHelpers' (extractIpAddress)",
          "newImport": "from '../lib/requestUtils' (extractIpAddress)",
          "purpose": "Update imports to use requestUtils"
        },
        {
          "step": 15,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 16,
          "action": "Test rate limiting",
          "tool": "manual_test",
          "purpose": "Test all rate limiters still work correctly"
        },
        {
          "step": 17,
          "action": "Test IP whitelist",
          "tool": "manual_test",
          "purpose": "Test IP whitelist middleware correctly extracts IPs"
        }
      ],
      "filesInvolved": [
        "backend/src/lib/requestUtils.ts (NEW)",
        "backend/src/middleware/rateLimiter.ts",
        "backend/src/middleware/mutationRateLimiter.ts",
        "backend/src/middleware/ipWhitelist.ts",
        "backend/src/lib/superuserHelpers.ts",
        "backend/src/middleware/rateLimitPerTenant.ts",
        "Any other files using extractIpAddress (from step 13)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Rate limiting with x-forwarded-for header",
        "Manual test: Rate limiting with direct connection",
        "Manual test: IP whitelist middleware",
        "Manual test: Audit logging IP capture",
        "Manual test: Superuser services IP logging"
      ]
    },
    {
      "name": "Error Response Helpers Consolidation",
      "priority": "HIGH",
      "prerequisites": ["Fix Error Response Interface Alignment"],
      "steps": [
        {
          "step": 1,
          "action": "Compare createErrorResponse implementations",
          "tool": "read_file",
          "files": [
            "backend/src/lib/apiErrors.ts",
            "backend/src/lib/responseHelpers.ts"
          ],
          "purpose": "Ensure we keep the most comprehensive version"
        },
        {
          "step": 2,
          "action": "Verify routes/auth.ts already uses responseHelpers",
          "tool": "grep",
          "pattern": "from.*responseHelpers|from.*apiErrors",
          "path": "backend/src/routes/auth.ts",
          "purpose": "Confirm prerequisite fix is complete"
        },
        {
          "step": 3,
          "action": "Check if apiErrors has any unique functions",
          "tool": "read_file",
          "file": "backend/src/lib/apiErrors.ts",
          "purpose": "Identify any functions not in responseHelpers"
        },
        {
          "step": 4,
          "action": "Add any unique functions from apiErrors to responseHelpers",
          "tool": "search_replace",
          "file": "backend/src/lib/responseHelpers.ts",
          "condition": "If apiErrors has unique functions, add them to responseHelpers",
          "purpose": "Preserve any unique functionality"
        },
        {
          "step": 5,
          "action": "Verify no files import from apiErrors",
          "tool": "grep",
          "pattern": "from.*apiErrors|import.*apiErrors",
          "path": "backend/src",
          "purpose": "Confirm all imports are updated (should be 0 matches)"
        },
        {
          "step": 6,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 7,
          "action": "Test error responses",
          "tool": "manual_test",
          "purpose": "Test error handling in all routes"
        },
        {
          "step": 8,
          "action": "Mark apiErrors.ts for deletion (DO NOT DELETE YET)",
          "tool": "read_file",
          "file": "backend/src/lib/apiErrors.ts",
          "purpose": "Verify file can be safely deleted in Phase B",
          "note": "File will be deleted in Phase B, not Phase A6"
        }
      ],
      "filesInvolved": [
        "backend/src/lib/responseHelpers.ts",
        "backend/src/lib/apiErrors.ts (marked for deletion in Phase B)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Error responses in all routes",
        "Frontend error parsing test",
        "Error logging test"
      ]
    },
    {
      "name": ".dockerignore Files Consolidation",
      "priority": "HIGH",
      "steps": [
        {
          "step": 1,
          "action": "Read backend/.dockerignore content",
          "tool": "read_file",
          "file": "backend/.dockerignore",
          "purpose": "Get content to consolidate"
        },
        {
          "step": 2,
          "action": "Read frontend/.dockerignore content",
          "tool": "read_file",
          "file": "frontend/.dockerignore",
          "purpose": "Verify they are identical"
        },
        {
          "step": 3,
          "action": "Create/update root .dockerignore",
          "tool": "write",
          "file": ".dockerignore",
          "content": "node_modules\ndist\nnpm-debug.log\ncoverage\n",
          "purpose": "Create consolidated .dockerignore at root"
        },
        {
          "step": 4,
          "action": "Verify Dockerfile build contexts",
          "tool": "read_file",
          "files": [
            "backend/Dockerfile",
            "frontend/Dockerfile"
          ],
          "purpose": "Ensure build contexts will work with root .dockerignore"
        },
        {
          "step": 5,
          "action": "Test backend Docker build",
          "tool": "run_terminal_cmd",
          "command": "cd backend && docker build -t test-backend .",
          "purpose": "Verify backend Docker build succeeds",
          "note": "May need Docker installed, skip if not available"
        },
        {
          "step": 6,
          "action": "Test frontend Docker build",
          "tool": "run_terminal_cmd",
          "command": "cd frontend && docker build -t test-frontend .",
          "purpose": "Verify frontend Docker build succeeds",
          "note": "May need Docker installed, skip if not available"
        },
        {
          "step": 7,
          "action": "Mark backend/.dockerignore for deletion",
          "tool": "read_file",
          "file": "backend/.dockerignore",
          "purpose": "Verify can be deleted",
          "note": "File will be deleted in Phase B"
        },
        {
          "step": 8,
          "action": "Mark frontend/.dockerignore for deletion",
          "tool": "read_file",
          "file": "frontend/.dockerignore",
          "purpose": "Verify can be deleted",
          "note": "File will be deleted in Phase B"
        }
      ],
      "filesInvolved": [
        ".dockerignore (root, NEW/UPDATED)",
        "backend/.dockerignore (marked for deletion in Phase B)",
        "frontend/.dockerignore (marked for deletion in Phase B)",
        "backend/Dockerfile (verify only)",
        "frontend/Dockerfile (verify only)"
      ],
      "testsRequired": [
        "Docker build test: backend",
        "Docker build test: frontend",
        "Verify build context includes correct files",
        "Verify ignored files are not copied"
      ]
    },
    {
      "name": "User Registration Schemas Consolidation",
      "priority": "MEDIUM",
      "steps": [
        {
          "step": 1,
          "action": "Read adminCreateUserSchema from routes/users.ts",
          "tool": "read_file",
          "file": "backend/src/routes/users.ts",
          "offset": 24,
          "limit": 20,
          "purpose": "Extract schema definition"
        },
        {
          "step": 2,
          "action": "Read schemas from routes/admin/userManagement.ts",
          "tool": "read_file",
          "file": "backend/src/routes/admin/userManagement.ts",
          "offset": 24,
          "limit": 35,
          "purpose": "Extract all three schemas"
        },
        {
          "step": 3,
          "action": "Create userRegistrationValidator.ts",
          "tool": "write",
          "file": "backend/src/validators/userRegistrationValidator.ts",
          "content": "import { z } from 'zod';\n\n/**\n * Admin user creation schema\n * Used for creating students and teachers by admin\n */\nexport const adminCreateUserSchema = z.object({\n  email: z.string().email(),\n  password: z.string().min(8),\n  role: z.enum(['student', 'teacher']),\n  fullName: z.string().min(2),\n  gender: z.enum(['male', 'female', 'other']).optional(),\n  address: z.string().optional(),\n  // Student fields\n  dateOfBirth: z.string().optional(),\n  parentGuardianName: z.string().optional(),\n  parentGuardianContact: z.string().optional(),\n  studentId: z.string().optional(),\n  classId: z.string().optional(),\n  // Teacher fields\n  phone: z.string().optional(),\n  qualifications: z.string().optional(),\n  yearsOfExperience: z.number().optional(),\n  subjects: z.array(z.string()).optional(),\n  teacherId: z.string().optional()\n});\n\n/**\n * HOD creation schema\n */\nexport const createHODSchema = z.object({\n  email: z.string().email('Invalid email address'),\n  password: z.string().min(8, 'Password must be at least 8 characters'),\n  fullName: z.string().min(1, 'Full name is required'),\n  phone: z.string().optional().nullable(),\n  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),\n  qualifications: z.string().optional(),\n  yearsOfExperience: z.number().int().positive().optional(),\n  subjects: z.array(z.string()).optional()\n});\n\n/**\n * Teacher creation schema\n */\nexport const createTeacherSchema = z.object({\n  email: z.string().email('Invalid email address'),\n  password: z.string().min(8, 'Password must be at least 8 characters'),\n  fullName: z.string().min(1, 'Full name is required'),\n  phone: z.string().optional().nullable(),\n  qualifications: z.string().optional(),\n  yearsOfExperience: z.number().int().positive().optional(),\n  subjects: z.array(z.string()).optional(),\n  teacherId: z.string().optional()\n});\n\n/**\n * Student creation schema\n */\nexport const createStudentSchema = z.object({\n  email: z.string().email('Invalid email address'),\n  password: z.string().min(8, 'Password must be at least 8 characters'),\n  fullName: z.string().min(1, 'Full name is required'),\n  gender: z.enum(['male', 'female', 'other']).optional(),\n  dateOfBirth: z.string().optional(),\n  parentGuardianName: z.string().optional(),\n  parentGuardianContact: z.string().optional(),\n  studentId: z.string().optional(),\n  classId: z.string().uuid('Invalid class ID').optional().nullable()\n});",
          "purpose": "Create consolidated validator file with all schemas"
        },
        {
          "step": 4,
          "action": "Update routes/users.ts to import adminCreateUserSchema",
          "tool": "search_replace",
          "file": "backend/src/routes/users.ts",
          "oldString": "import { z } from 'zod';",
          "newString": "import { z } from 'zod';\nimport { adminCreateUserSchema } from '../validators/userRegistrationValidator';",
          "purpose": "Add import for shared schema"
        },
        {
          "step": 5,
          "action": "Remove local adminCreateUserSchema from routes/users.ts",
          "tool": "search_replace",
          "file": "backend/src/routes/users.ts",
          "oldString": "// Admin user registration schema\nconst adminCreateUserSchema = z.object({\n  email: z.string().email(),\n  password: z.string().min(8),\n  role: z.enum(['student', 'teacher']),\n  fullName: z.string().min(2),\n  gender: z.enum(['male', 'female', 'other']).optional(),\n  address: z.string().optional(),\n  // Student fields\n  dateOfBirth: z.string().optional(),\n  parentGuardianName: z.string().optional(),\n  parentGuardianContact: z.string().optional(),\n  studentId: z.string().optional(),\n  classId: z.string().optional(),\n  // Teacher fields\n  phone: z.string().optional(),\n  qualifications: z.string().optional(),\n  yearsOfExperience: z.number().optional(),\n  subjects: z.array(z.string()).optional(),\n  teacherId: z.string().optional()\n});",
          "newString": "",
          "purpose": "Remove local schema definition"
        },
        {
          "step": 6,
          "action": "Update routes/admin/userManagement.ts to import schemas",
          "tool": "search_replace",
          "file": "backend/src/routes/admin/userManagement.ts",
          "oldString": "import { z } from 'zod';",
          "newString": "import { z } from 'zod';\nimport { createHODSchema, createTeacherSchema, createStudentSchema } from '../../validators/userRegistrationValidator';",
          "purpose": "Add imports for shared schemas"
        },
        {
          "step": 7,
          "action": "Remove local schemas from routes/admin/userManagement.ts",
          "tool": "search_replace",
          "file": "backend/src/routes/admin/userManagement.ts",
          "oldString": "const createHODSchema = z.object({",
          "newString": "",
          "multiline": true,
          "purpose": "Remove createHODSchema definition"
        },
        {
          "step": 8,
          "action": "Remove createTeacherSchema from routes/admin/userManagement.ts",
          "tool": "search_replace",
          "file": "backend/src/routes/admin/userManagement.ts",
          "oldString": "const createTeacherSchema = z.object({",
          "newString": "",
          "multiline": true,
          "purpose": "Remove createTeacherSchema definition"
        },
        {
          "step": 9,
          "action": "Remove createStudentSchema from routes/admin/userManagement.ts",
          "tool": "search_replace",
          "file": "backend/src/routes/admin/userManagement.ts",
          "oldString": "const createStudentSchema = z.object({",
          "newString": "",
          "multiline": true,
          "purpose": "Remove createStudentSchema definition"
        },
        {
          "step": 10,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 11,
          "action": "Test user creation for all roles",
          "tool": "manual_test",
          "purpose": "Test admin can create students, teachers, and HODs"
        }
      ],
      "filesInvolved": [
        "backend/src/validators/userRegistrationValidator.ts (NEW)",
        "backend/src/routes/users.ts",
        "backend/src/routes/admin/userManagement.ts"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Admin creates student",
        "Manual test: Admin creates teacher",
        "Manual test: Admin creates HOD",
        "Manual test: Validation error messages",
        "Manual test: Optional fields handling",
        "Manual test: UUID validation for classId, departmentId"
      ]
    },
    {
      "name": "Password Validation Consolidation",
      "priority": "MEDIUM",
      "prerequisites": [
        "Fix PasswordValidationResult Interface Alignment",
        "Create Password Validation Wrapper Function"
      ],
      "steps": [
        {
          "step": 1,
          "action": "Verify validatePasswordStrength is now a wrapper",
          "tool": "read_file",
          "file": "backend/src/middleware/validation.ts",
          "purpose": "Confirm wrapper function exists and uses passwordPolicyService"
        },
        {
          "step": 2,
          "action": "Find all usages of validatePasswordStrength",
          "tool": "grep",
          "pattern": "validatePasswordStrength",
          "path": "backend/src",
          "purpose": "Find all callers"
        },
        {
          "step": 3,
          "action": "Verify all callers handle async correctly",
          "tool": "grep",
          "pattern": "await.*validatePasswordStrength|validatePasswordStrength.*await",
          "path": "backend/src",
          "purpose": "Ensure all calls are awaited"
        },
        {
          "step": 4,
          "action": "Mark validatePasswordStrength as deprecated",
          "tool": "search_replace",
          "file": "backend/src/middleware/validation.ts",
          "oldString": "/**\n * @deprecated Use passwordPolicyService.validatePassword() with policy instead.\n * This wrapper is kept for backward compatibility.\n */",
          "newString": "/**\n * @deprecated Use passwordPolicyService.validatePassword() with policy instead.\n * This wrapper is kept for backward compatibility.\n * \n * TODO: Migrate all callers to use passwordPolicyService.validatePassword() directly\n * and remove this function in a future phase.\n */",
          "purpose": "Add deprecation notice with migration note"
        },
        {
          "step": 5,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 6,
          "action": "Test password validation",
          "tool": "manual_test",
          "purpose": "Test password validation in all scenarios"
        },
        {
          "step": 7,
          "action": "Document migration path",
          "tool": "write",
          "file": "docs/password-validation-migration.md",
          "content": "# Password Validation Migration\n\nvalidatePasswordStrength is deprecated. Migrate to passwordPolicyService.validatePassword().\n\n## Migration Steps\n1. Import: `import { validatePassword, getPasswordPolicy } from '../services/security/passwordPolicyService'`\n2. Get policy: `const policy = await getPasswordPolicy(client, tenantId)`\n3. Validate: `const result = validatePassword(password, policy)`\n4. Check result: `if (!result.isValid) { ... }`\n",
          "purpose": "Document how to migrate from deprecated function",
          "note": "Optional documentation file"
        }
      ],
      "filesInvolved": [
        "backend/src/middleware/validation.ts",
        "backend/src/services/security/passwordPolicyService.ts",
        "All files using validatePasswordStrength (already migrated to async wrapper)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: Password validation with default policy",
        "Manual test: Registration password validation",
        "Manual test: Password reset validation",
        "Manual test: Admin password creation validation"
      ]
    },
    {
      "name": "Context Validation Consolidation",
      "priority": "MEDIUM",
      "steps": [
        {
          "step": 1,
          "action": "Read contextHelpers.ts implementation",
          "tool": "read_file",
          "file": "backend/src/lib/contextHelpers.ts",
          "purpose": "Understand canonical implementation"
        },
        {
          "step": 2,
          "action": "Read routeHelpers.ts context functions",
          "tool": "read_file",
          "file": "backend/src/lib/routeHelpers.ts",
          "offset": 12,
          "limit": 30,
          "purpose": "Understand current implementation"
        },
        {
          "step": 3,
          "action": "Update routeHelpers.ts to use contextHelpers internally",
          "tool": "search_replace",
          "file": "backend/src/lib/routeHelpers.ts",
          "oldString": "import { createSuccessResponse, createErrorResponse } from './responseHelpers';\nimport { safeAuditLogFromRequest } from './auditHelpers';",
          "newString": "import { createSuccessResponse, createErrorResponse } from './responseHelpers';\nimport { safeAuditLogFromRequest } from './auditHelpers';\nimport { validateContextOrRespond } from './contextHelpers';",
          "purpose": "Add import for contextHelpers"
        },
        {
          "step": 4,
          "action": "Update requireTenantContext to use contextHelpers",
          "tool": "search_replace",
          "file": "backend/src/lib/routeHelpers.ts",
          "oldString": "/**\n * Validates tenant context is available\n */\nexport function requireTenantContext(req: Request, res: Response): boolean {\n  if (!req.tenantClient || !req.tenant) {\n    res.status(500).json(createErrorResponse('Tenant context missing'));\n    return false;\n  }\n  return true;\n}",
          "newString": "/**\n * Validates tenant context is available\n * @deprecated Use validateContextOrRespond from contextHelpers.ts instead\n */\nexport function requireTenantContext(req: Request, res: Response): boolean {\n  const context = validateContextOrRespond(req, res);\n  return context !== null;\n}",
          "purpose": "Update to use contextHelpers, mark as deprecated"
        },
        {
          "step": 5,
          "action": "Update requireUserContext to use contextHelpers",
          "tool": "search_replace",
          "file": "backend/src/lib/routeHelpers.ts",
          "oldString": "/**\n * Validates user context is available\n */\nexport function requireUserContext(req: Request, res: Response): boolean {\n  if (!req.user) {\n    res.status(500).json(createErrorResponse('User context missing'));\n    return false;\n  }\n  return true;\n}",
          "newString": "/**\n * Validates user context is available\n * @deprecated Use validateContextOrRespond from contextHelpers.ts instead\n */\nexport function requireUserContext(req: Request, res: Response): boolean {\n  const context = validateContextOrRespond(req, res);\n  return context !== null;\n}",
          "purpose": "Update to use contextHelpers, mark as deprecated"
        },
        {
          "step": 6,
          "action": "Update requireContext to use contextHelpers",
          "tool": "search_replace",
          "file": "backend/src/lib/routeHelpers.ts",
          "oldString": "/**\n * Validates both tenant and user context\n */\nexport function requireContext(req: Request, res: Response): boolean {\n  return requireTenantContext(req, res) && requireUserContext(req, res);\n}",
          "newString": "/**\n * Validates both tenant and user context\n * @deprecated Use validateContextOrRespond from contextHelpers.ts instead\n */\nexport function requireContext(req: Request, res: Response): boolean {\n  const context = validateContextOrRespond(req, res);\n  return context !== null;\n}",
          "purpose": "Update to use contextHelpers, mark as deprecated"
        },
        {
          "step": 7,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd backend && npx tsc --noEmit",
          "purpose": "Verify no type errors"
        },
        {
          "step": 8,
          "action": "Test all routes using context validation",
          "tool": "manual_test",
          "purpose": "Test routes that use requireTenantContext, requireUserContext, requireContext"
        },
        {
          "step": 9,
          "action": "Document migration path",
          "tool": "write",
          "file": "docs/context-validation-migration.md",
          "content": "# Context Validation Migration\n\nrouteHelpers context functions are deprecated. Migrate to contextHelpers.validateContextOrRespond().\n\n## Migration Steps\n1. Import: `import { validateContextOrRespond } from '../lib/contextHelpers'`\n2. Replace: `if (!requireTenantContext(req, res)) return;`\n3. With: `const context = validateContextOrRespond(req, res); if (!context) return;`\n4. Use context.tenant, context.tenantClient, context.user\n",
          "purpose": "Document how to migrate from deprecated functions",
          "note": "Optional documentation file"
        }
      ],
      "filesInvolved": [
        "backend/src/lib/contextHelpers.ts",
        "backend/src/lib/routeHelpers.ts",
        "All files using routeHelpers context functions (backward compatible, no changes needed)"
      ],
      "testsRequired": [
        "TypeScript compilation (tsc --noEmit)",
        "Manual test: All routes with context validation",
        "Manual test: Error responses when context missing",
        "Manual test: Tenant context validation",
        "Manual test: User context validation"
      ]
    },
    {
      "name": "Permissions Type Sync",
      "priority": "MEDIUM",
      "steps": [
        {
          "step": 1,
          "action": "Read backend permissions.ts structure",
          "tool": "read_file",
          "file": "backend/src/config/permissions.ts",
          "limit": 100,
          "purpose": "Understand structure to generate from"
        },
        {
          "step": 2,
          "action": "Read frontend permissions.ts structure",
          "tool": "read_file",
          "file": "frontend/src/config/permissions.ts",
          "limit": 100,
          "purpose": "Understand target format"
        },
        {
          "step": 3,
          "action": "Create permissions generation script",
          "tool": "write",
          "file": "scripts/generate-permissions.ts",
          "content": "import * as fs from 'fs';\nimport * as path from 'path';\n\n/**\n * Generate frontend permissions.ts from backend permissions.ts\n * This ensures frontend and backend permissions stay in sync\n */\n\nconst backendPermissionsPath = path.join(__dirname, '../backend/src/config/permissions.ts');\nconst frontendPermissionsPath = path.join(__dirname, '../frontend/src/config/permissions.ts');\n\n// Read backend permissions\nconst backendContent = fs.readFileSync(backendPermissionsPath, 'utf-8');\n\n// Extract Role and Permission types and rolePermissions mapping\n// This is a simplified parser - may need enhancement based on actual structure\nconst roleTypeMatch = backendContent.match(/export type Role = ([^;]+);/);\nconst permissionTypeMatch = backendContent.match(/export type Permission = ([^;]+);/s);\nconst rolePermissionsMatch = backendContent.match(/export const rolePermissions[^=]+= ({[^}]+});/s);\n\nif (!roleTypeMatch || !permissionTypeMatch || !rolePermissionsMatch) {\n  console.error('Failed to parse backend permissions.ts');\n  process.exit(1);\n}\n\n// Generate frontend permissions.ts\nconst frontendContent = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY\n// This file is generated from backend/src/config/permissions.ts\n// Run 'npm run generate:permissions' to regenerate\n\n${roleTypeMatch[0]}\n\n${permissionTypeMatch[0]}\n\n${rolePermissionsMatch[0]}\n\n// Re-export utility functions if they exist in backend\n// Add any frontend-specific utilities here\n`;\n\n// Write to frontend\nfs.writeFileSync(frontendPermissionsPath, frontendContent, 'utf-8');\n\nconsole.log('✅ Generated frontend/src/config/permissions.ts from backend');\n",
          "purpose": "Create script to generate frontend permissions from backend"
        },
        {
          "step": 4,
          "action": "Add generate:permissions script to package.json",
          "tool": "read_file",
          "file": "package.json",
          "purpose": "Check current scripts section"
        },
        {
          "step": 5,
          "action": "Update package.json with generate script",
          "tool": "search_replace",
          "file": "package.json",
          "oldString": "\"scripts\": {",
          "newString": "\"scripts\": {\n    \"generate:permissions\": \"ts-node scripts/generate-permissions.ts\",",
          "purpose": "Add permissions generation script",
          "note": "May need to adjust based on actual package.json structure"
        },
        {
          "step": 6,
          "action": "Run generation script",
          "tool": "run_terminal_cmd",
          "command": "npm run generate:permissions",
          "purpose": "Test that script works",
          "note": "May need ts-node installed"
        },
        {
          "step": 7,
          "action": "Verify generated file",
          "tool": "read_file",
          "file": "frontend/src/config/permissions.ts",
          "purpose": "Verify file was generated correctly"
        },
        {
          "step": 8,
          "action": "Run TypeScript compilation",
          "tool": "run_terminal_cmd",
          "command": "cd frontend && npx tsc --noEmit",
          "purpose": "Verify frontend still compiles"
        },
        {
          "step": 9,
          "action": "Test RBAC checks",
          "tool": "manual_test",
          "purpose": "Test permission checks in frontend and backend"
        },
        {
          "step": 10,
          "action": "Update CI/CD to run generation",
          "tool": "read_file",
          "file": ".github/workflows/ci.yml",
          "purpose": "Add generation step to CI",
          "note": "If CI/CD exists, add generation step. Otherwise document in README"
        }
      ],
      "filesInvolved": [
        "scripts/generate-permissions.ts (NEW)",
        "package.json",
        "frontend/src/config/permissions.ts (GENERATED)",
        "backend/src/config/permissions.ts (SOURCE OF TRUTH)",
        "CI/CD configuration (if exists)"
      ],
      "testsRequired": [
        "TypeScript compilation: frontend (tsc --noEmit)",
        "TypeScript compilation: backend (tsc --noEmit)",
        "Manual test: RBAC checks in frontend",
        "Manual test: Permission checks in backend",
        "Manual test: Generation script produces correct output"
      ]
    }
  ],
  "finalNotes": "All file deletions will occur in Phase B, not Phase A6. Phase A6 only prepares the consolidation by creating new files, updating imports, and marking duplicates for deletion. After all consolidations are complete and tested, Phase B will handle the actual deletion of duplicate files. Ensure all tests pass before proceeding to Phase B."
}
```

---

## Execution Order

### Phase 1: Prerequisites (Must Complete First)
1. Fix Error Response Interface Alignment
2. Fix PasswordValidationResult Interface Alignment
3. Create Password Validation Wrapper Function
4. Verify Frontend Error Format Compatibility

### Phase 2: HIGH Priority Consolidations
5. IP Extraction Logic Consolidation
6. Error Response Helpers Consolidation
7. .dockerignore Files Consolidation

### Phase 3: MEDIUM Priority Consolidations
8. User Registration Schemas Consolidation
9. Password Validation Consolidation
10. Context Validation Consolidation
11. Permissions Type Sync

---

## Testing Checklist

After each consolidation, run:

- [ ] TypeScript compilation (`tsc --noEmit`)
- [ ] Manual testing of affected functionality
- [ ] Integration tests (if available)
- [ ] Verify no regressions

---

## Files Marked for Deletion (Phase B)

These files will be deleted in Phase B, not Phase A6:

- `backend/src/lib/apiErrors.ts`
- `backend/.dockerignore`
- `frontend/.dockerignore`
- Inline IP extraction code (already replaced with imports)

---

**Report Generated:** 2025-01-23  
**Status:** Ready for Implementation  
**Next Phase:** Phase B (File Deletion - after all consolidations tested)

