import { useEffect, useRef, useState, useCallback } from 'react';
import { getRefreshToken } from '../lib/security/tokenSecurity';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Hook for WebSocket connection with automatic reconnection
 * Falls back gracefully if WebSocket is not available
 */
export function useWebSocket(
  path: string = '/ws',
  options: UseWebSocketOptions = {}
): {
  connected: boolean;
  send: (message: WebSocketMessage) => void;
  reconnect: () => void;
} {
  const { enabled = true, onMessage, onError, onConnect, onDisconnect } = options;
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    
    // If VITE_API_BASE_URL is set, use it; otherwise use current host
    if (apiBase) {
      const url = new URL(apiBase);
      return `${protocol}//${url.host}${path}`;
    }
    
    return `${protocol}//${host}${path}`;
  }, [path]);

  const connect = useCallback(() => {
    if (!enabled) {
      return;
    }

    // Get token from storage - WebSocket will authenticate via query param
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      console.warn('[WebSocket] No refresh token available');
      return;
    }

    try {
      const url = getWebSocketUrl();
      // Note: In production, you'd exchange refresh token for access token
      // For now, we'll use a placeholder - backend should handle auth
      const ws = new WebSocket(`${url}?token=${refreshToken}`);

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        setConnected(false);
        onDisconnect?.();

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      // WebSocket not available - graceful fallback
      console.warn('[WebSocket] Not available, using polling fallback');
      setConnected(false);
    }
  }, [enabled, getWebSocketUrl, onMessage, onError, onConnect, onDisconnect]);

  const send = useCallback(
    (message: WebSocketMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('[WebSocket] Cannot send message, not connected');
      }
    },
    []
  );

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, connect]);

  return { connected, send, reconnect };
}

