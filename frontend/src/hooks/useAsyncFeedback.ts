import { useCallback, useState } from 'react';

export type FeedbackStatus = 'info' | 'success' | 'error';

export interface AsyncFeedbackState {
  status: FeedbackStatus;
  message: string | null;
  setInfo: (message: string) => void;
  setSuccess: (message: string) => void;
  setError: (message: string) => void;
  clear: () => void;
}

export function useAsyncFeedback(initialStatus: FeedbackStatus = 'info'): AsyncFeedbackState {
  const [status, setStatus] = useState<FeedbackStatus>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);

  const setInfo = useCallback((nextMessage: string) => {
    setStatus('info');
    setMessage(nextMessage);
  }, []);

  const setSuccess = useCallback((nextMessage: string) => {
    setStatus('success');
    setMessage(nextMessage);
  }, []);

  const setError = useCallback((nextMessage: string) => {
    setStatus('error');
    setMessage(nextMessage);
  }, []);

  const clear = useCallback(() => {
    setMessage(null);
  }, []);

  return {
    status,
    message,
    setInfo,
    setSuccess,
    setError,
    clear
  };
}

export default useAsyncFeedback;

