import { Router } from 'express';
import authenticate from '../../middleware/authenticate';
import tenantResolver from '../../middleware/tenantResolver';
import { requirePermission } from '../../middleware/rbac';
import { getPool } from '../../db/connection';
import {
  createSamlProvider,
  getSamlProviders,
  generateSamlAuthnRequest,
  processSamlResponse,
} from '../../services/sso/samlService';
import {
  createOAuthProvider,
  getOAuthProviders,
  generateOAuthAuthorizationUrl,
  processOAuthCallback,
  refreshOAuthToken,
} from '../../services/sso/oauthService';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const createSamlProviderSchema = z.object({
  tenantId: z.string().uuid().optional(),
  providerName: z.string().min(1),
  metadataUrl: z.string().url().optional(),
  entityId: z.string().min(1),
  ssoUrl: z.string().url(),
  sloUrl: z.string().url().optional(),
  certificate: z.string().min(1),
  jitProvisioning: z.boolean().optional(),
  jitDefaultRole: z.string().optional(),
  attributeMapping: z.record(z.string(), z.string()).optional(),
});

const createOAuthProviderSchema = z.object({
  tenantId: z.string().uuid().optional(),
  providerName: z.string().min(1),
  providerType: z.enum(['oauth2', 'oidc']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  userinfoUrl: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  jitProvisioning: z.boolean().optional(),
  jitDefaultRole: z.string().optional(),
  attributeMapping: z.record(z.string(), z.string()).optional(),
});

// SAML SSO
router.get('/saml/providers', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const providers = await getSamlProviders(client, req.tenant?.id);
      res.json({ providers });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/saml/providers',
  authenticate,
  requirePermission('tenants:manage'),
  async (req, res, next) => {
    try {
      const parsed = createSamlProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const provider = await createSamlProvider(client, {
          ...parsed.data,
          tenantId: req.tenant?.id,
          createdBy: req.user?.id,
        });
        res.status(201).json(provider);
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

router.post('/saml/initiate', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const { providerId, relayState } = req.body;
    if (!providerId) {
      return res.status(400).json({ message: 'Provider ID required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const providers = await getSamlProviders(client, req.tenant?.id);
      const provider = providers.find((p: unknown) => {
        const typed = p as { id: string };
        return typed.id === providerId;
      }) as
        | {
            id: string;
            entity_id: string;
            sso_url: string;
          }
        | undefined;

      if (!provider) {
        return res.status(404).json({ message: 'SAML provider not found' });
      }

      // Generate SAML AuthnRequest
      const acsUrl = `${req.protocol}://${req.get('host')}/api/auth/sso/saml/acs`;
      const samlRequest = generateSamlAuthnRequest(
        provider.entity_id,
        provider.sso_url,
        acsUrl,
        relayState
      );

      // Store relay state in session or return it
      const state = relayState || crypto.randomBytes(16).toString('hex');

      res.json({
        samlRequest,
        ssoUrl: provider.sso_url,
        relayState: state,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/saml/acs', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const { SAMLResponse, RelayState } = req.body;
    if (!SAMLResponse) {
      return res.status(400).json({ message: 'SAMLResponse required' });
    }

    // Extract provider ID from RelayState or session
    const providerId = RelayState?.split(':')[0] || (req.query.providerId as string);
    if (!providerId) {
      return res.status(400).json({ message: 'Provider ID required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await processSamlResponse(client, providerId, SAMLResponse, RelayState);

      // In production, create session and redirect
      // For now, return user info
      res.json({
        success: true,
        userId: result.userId,
        email: result.email,
        isNewUser: result.isNewUser,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// OAuth2/OIDC SSO
router.get('/oauth/providers', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const providers = await getOAuthProviders(client, req.tenant?.id);
      res.json({ providers });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post(
  '/oauth/providers',
  authenticate,
  requirePermission('tenants:manage'),
  async (req, res, next) => {
    try {
      const parsed = createOAuthProviderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.message });
      }

      const pool = getPool();
      const client = await pool.connect();
      try {
        const provider = await createOAuthProvider(client, {
          ...parsed.data,
          tenantId: req.tenant?.id,
          createdBy: req.user?.id,
        });
        res.status(201).json(provider);
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

router.get('/oauth/authorize', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const { providerId } = req.query;
    if (!providerId) {
      return res.status(400).json({ message: 'Provider ID required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const providers = (await getOAuthProviders(client, req.tenant?.id)) as Array<{ id: string }>;
      const provider = providers.find((p) => p.id === providerId);

      if (!provider) {
        return res.status(404).json({ message: 'OAuth provider not found' });
      }

      const typedProvider = provider as {
        id: string;
        scopes?: string[];
        authorization_url: string;
        client_id: string;
      };

      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/sso/oauth/callback`;
      const state = crypto.randomBytes(16).toString('hex');
      const scopes = typedProvider.scopes || ['openid', 'profile', 'email'];

      const authUrl = generateOAuthAuthorizationUrl(
        typedProvider.authorization_url,
        typedProvider.client_id,
        redirectUri,
        scopes,
        state
      );

      // Store state in session or return it
      res.json({
        authorizationUrl: authUrl,
        state,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.get('/oauth/callback', tenantResolver({ optional: true }), async (req, res, next) => {
  try {
    const { code, state, providerId } = req.query;
    if (!code || !providerId) {
      return res.status(400).json({ message: 'Code and provider ID required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/sso/oauth/callback`;
      const result = await processOAuthCallback(
        client,
        providerId as string,
        code as string,
        redirectUri,
        state as string
      );

      // In production, create session and redirect
      res.json({
        success: true,
        userId: result.userId,
        email: result.email,
        isNewUser: result.isNewUser,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

router.post('/oauth/refresh', authenticate, async (req, res, next) => {
  try {
    const { providerId, refreshToken } = req.body;
    if (!providerId || !refreshToken) {
      return res.status(400).json({ message: 'Provider ID and refresh token required' });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const tokens = await refreshOAuthToken(client, providerId, refreshToken);
      res.json(tokens);
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
