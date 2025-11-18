/**
 * WebSocket-ready structure for real-time features
 * This provides the foundation for future WebSocket implementation
 */

import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import jwt from 'jsonwebtoken';
import { logger } from './logger';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

type WSSLike = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  close?: () => void;
};

export interface AuthenticatedWebSocket {
  userId?: string;
  tenantId?: string;
  role?: string;
  isAuthenticated: boolean;
  readyState?: number;
  send?: (data: string) => void;
  close?: (code?: number, reason?: string) => void;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
}

/**
 * WebSocket server manager
 */
export class WebSocketManager {
  private wss: WSSLike | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  /**
   * Initialize WebSocket server
   * Note: Requires 'ws' package to be installed: npm install ws @types/ws
   */
  initialize(server: HttpServer | HttpsServer): void {
    try {
      // Dynamic import to avoid requiring ws package if not needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WebSocketServer: WSS } = require('ws');
      
      this.wss = (new WSS({
        server,
        path: '/ws',
        verifyClient: (info: { origin: string }) => {
          // Verify origin in production
          if (process.env.NODE_ENV === 'production') {
            const origin = info.origin;
            const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
            if (!allowedOrigins.includes(origin)) {
              logger.warn({ origin }, '[WebSocket] Rejected connection from origin');
              return false;
            }
          }
          return true;
        }
      }) as unknown) as WSSLike;

      this.wss.on('connection', (ws: unknown, req: unknown) => {
        this.handleConnection(ws as AuthenticatedWebSocket, req);
      });

      logger.info({}, '[WebSocket] Server initialized');
    } catch (error) {
      // WebSocket is optional - only log once in dev mode, silently ignore in production
      if (process.env.NODE_ENV !== 'production') {
        const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : 'UNKNOWN';
        if (errorCode === 'MODULE_NOT_FOUND') {
          // Expected: 'ws' package not installed - this is fine, WebSocket is optional
          logger.info({}, '[WebSocket] Optional WebSocket support not available (install "ws" package to enable)');
        } else {
          // Unexpected error - log it
          logger.warn({ err: error }, '[WebSocket] Unexpected error during initialization');
        }
      }
      // In production, fail silently since WebSocket is optional
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: AuthenticatedWebSocket, req: unknown): Promise<void> {
    ws.isAuthenticated = false;

    // Authenticate via token in query string or header
    const token = this.extractToken(req);
    
    if (!token) {
      ws.close?.(1008, 'Authentication required');
      return;
    }

    try {
      const secret = process.env.JWT_ACCESS_SECRET ?? 'change-me-access';
      const payload = jwt.verify(token, secret) as {
        sub: string;
        tenantId?: string;
        role: string;
      };

      ws.userId = payload.sub;
      ws.tenantId = payload.tenantId || '';
      ws.role = payload.role;
      ws.isAuthenticated = true;

      // Add to client map
      this.addClient(ws.userId ?? '', ws);

      ws.on?.('message', (data: unknown) => {
        if (data instanceof Buffer) {
          this.handleMessage(ws, data as Buffer);
        } else if (typeof data === 'string') {
          this.handleMessage(ws, Buffer.from(data));
        }
      });

      ws.on?.('close', () => {
        this.removeClient(ws.userId ?? '', ws);
      });

      ws.on?.('error', (error: unknown) => {
        logger.error({ err: error }, '[WebSocket] Connection error');
      });

      // Send welcome message
      this.send(ws, {
        type: 'connected',
        payload: { userId: ws.userId, tenantId: ws.tenantId },
        timestamp: Date.now()
      });

      logger.info({ userId: ws.userId }, '[WebSocket] Client connected');
    } catch (error) {
      logger.error({ err: error }, '[WebSocket] Authentication failed');
      ws.close?.(1008, 'Authentication failed');
    }
  }

  /**
   * Extract token from request
   */
  private extractToken(req: unknown): string | null {
    const request = req as { url?: string; headers?: { authorization?: string } };
    
    // Try Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Try query parameter
    if (request.url) {
      try {
        const url = new URL(request.url, 'http://localhost');
        return url.searchParams.get('token');
      } catch {
        // Invalid URL
      }
    }
    
    return null;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer): void {
    if (!ws.isAuthenticated) {
      ws.close?.(1008, 'Not authenticated');
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      // Validate message structure
      if (!message.type || !message.payload) {
        this.sendError(ws, 'Invalid message format');
        return;
      }

      // Route message based on type
      this.routeMessage(ws, message);
    } catch (error) {
      logger.error({ err: error }, '[WebSocket] Message parsing error');
      this.sendError(ws, 'Failed to parse message');
    }
  }

  /**
   * Route message to appropriate handler
   */
  private routeMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong', payload: {}, timestamp: Date.now() });
        break;
      case 'subscribe':
        // Handle subscription to channels
        this.handleSubscribe(ws);
        break;
      case 'unsubscribe':
        // Handle unsubscription
        this.handleUnsubscribe(ws);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle subscription
   */
  private handleSubscribe(ws: AuthenticatedWebSocket): void {
    // Implementation for channel subscriptions
    logger.info({ userId: ws.userId }, '[WebSocket] Client subscribed to channel');
  }

  /**
   * Handle unsubscription
   */
  private handleUnsubscribe(ws: AuthenticatedWebSocket): void {
    // Implementation for channel unsubscriptions
    logger.info({ userId: ws.userId }, '[WebSocket] Client unsubscribed from channel');
  }

  /**
   * Send message to client
   */
  private send(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    // WebSocket.OPEN = 1
    if (ws.readyState === 1) {
      ws.send?.(JSON.stringify(message));
    }
  }

  /**
   * Send error message
   */
  private sendError(ws: AuthenticatedWebSocket, error: string): void {
    this.send(ws, {
      type: 'error',
      payload: { message: error },
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast message to all clients in a tenant
   */
  broadcastToTenant(tenantId: string, message: WebSocketMessage): void {
    const clients = Array.from(this.clients.values()).flatMap((set) => Array.from(set)) as AuthenticatedWebSocket[];
    const tenantClients = clients.filter((ws) => ws.tenantId === tenantId && ws.isAuthenticated);
    
    tenantClients.forEach((ws) => {
      this.send(ws, message);
    });
  }

  /**
   * Broadcast message to specific user
   */
  broadcastToUser(userId: string, message: WebSocketMessage): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((ws) => {
        this.send(ws, message);
      });
    }
  }

  /**
   * Add client to map
   */
  private addClient(userId: string, ws: AuthenticatedWebSocket): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);
  }

  /**
   * Remove client from map
   */
  private removeClient(userId: string, ws: AuthenticatedWebSocket): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Close all connections
   */
  close(): void {
    if (this.wss) {
      this.wss.close?.();
      this.clients.clear();
      logger.info({}, '[WebSocket] Server closed');
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
