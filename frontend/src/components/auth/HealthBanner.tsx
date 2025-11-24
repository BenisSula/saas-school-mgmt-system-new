import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface HealthCheckResult {
  status: 'ok' | 'error' | 'checking';
  message: string;
}

export function HealthBanner() {
  const [health, setHealth] = useState<HealthCheckResult>({
    status: 'checking',
    message: 'Checking server connection...',
  });

  const checkHealth = async () => {
    setHealth({ status: 'checking', message: 'Checking server connection...' });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch('/api/auth/health', {
        method: 'GET',
        signal: controller.signal,
        credentials: 'include',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.db === 'ok') {
          setHealth({ status: 'ok', message: '' });
          return;
        }
      }

      // Health check failed
      setHealth({
        status: 'error',
        message:
          "We can't reach the authentication server. Try again in a moment. (If you're a developer, check VITE_API_BASE_URL and that the backend is running on port 3001.)",
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setHealth({
          status: 'error',
          message:
            "Connection timeout. The server may be slow or unavailable. (If you're a developer, check that the backend is running on port 3001.)",
        });
      } else {
        setHealth({
          status: 'error',
          message:
            "We can't reach the authentication server. Try again in a moment. (If you're a developer, check VITE_API_BASE_URL and that the backend is running on port 3001.)",
        });
      }
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Don't render if health is ok
  if (health.status === 'ok') {
    return null;
  }

  return (
    <div
      className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-200"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
        <div className="flex-1">
          <p className="font-medium text-yellow-300">{health.message}</p>
        </div>
        <button
          onClick={checkHealth}
          disabled={health.status === 'checking'}
          className="ml-2 flex-shrink-0 rounded px-2 py-1 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Retry connection check"
        >
          {health.status === 'checking' ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}
