import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authenticate from '../middleware/authenticate';
import {
  login,
  refreshToken,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  signUp,
  verifyEmail,
  logout
} from '../services/authService';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(authLimiter);

router.post('/signup', async (req, res) => {
  try {
    const { email, password, role, tenantId } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: 'email, password, and role are required' });
    }

    const response = await signUp({ email, password, role, tenantId });
    return res.status(201).json(response);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const response = await login(
      { email, password },
      { ip: req.ip, userAgent: req.get('user-agent') ?? null }
    );
    return res.status(200).json(response);
  } catch (error) {
    return res.status(401).json({ message: (error as Error).message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const response = await refreshToken(token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(401).json({ message: (error as Error).message });
  }
});

router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    await requestPasswordReset(email);
    return res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'token and password are required' });
    }

    await resetPassword(token, password);
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.post('/request-email-verification', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ message: 'userId and email are required' });
    }

    await requestEmailVerification(userId, email);
    return res.status(200).json({ message: 'Verification email queued' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }

    await verifyEmail(token);
    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }
    await logout(req.user!.id, token, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
});

export default router;
