import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

interface ScheduleReportModalProps {
  reportId: string;
  reportName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
  reportId,
  reportName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>(
    'daily'
  );
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [time, setTime] = useState('09:00');
  const [cron, setCron] = useState('0 9 * * *');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel' | 'json'>('pdf');
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(`${reportName} - Scheduled`);
    }
  }, [isOpen, reportName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const recipientList = recipients
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email.length > 0);

    if (recipientList.length === 0) {
      setError('At least one recipient email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientList.filter((email) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      const scheduleConfig: Record<string, unknown> = {};

      if (scheduleType === 'daily') {
        scheduleConfig.time = time;
      } else if (scheduleType === 'weekly') {
        scheduleConfig.dayOfWeek = dayOfWeek;
        scheduleConfig.time = time;
      } else if (scheduleType === 'monthly') {
        scheduleConfig.dayOfMonth = dayOfMonth;
        scheduleConfig.time = time;
      } else if (scheduleType === 'custom') {
        scheduleConfig.cron = cron;
      }

      await api.reports.createScheduledReport({
        reportDefinitionId: reportId,
        name,
        scheduleType,
        scheduleConfig,
        exportFormat,
        recipients: recipientList,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scheduled report');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--brand-surface)] rounded-lg shadow-xl border border-[var(--brand-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-[var(--brand-text-primary)]">Schedule Report</h2>
            <button
              onClick={onClose}
              className="text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)] transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[var(--brand-error-light)] text-[var(--brand-error)] border border-[var(--brand-error)]/20 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                Schedule Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                placeholder="Enter schedule name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                Schedule Type *
              </label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as typeof scheduleType)}
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                aria-label="Select schedule type"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (Cron)</option>
              </select>
            </div>

            {scheduleType === 'daily' && (
              <div>
                <label
                  htmlFor="daily-time"
                  className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]"
                >
                  Time *
                </label>
                <input
                  id="daily-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  aria-label="Time for daily schedule"
                  title="Time for daily schedule"
                  placeholder="HH:MM"
                  required
                />
              </div>
            )}

            {scheduleType === 'weekly' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                    Day of Week *
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    aria-label="Select day of week"
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="weekly-time"
                    className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]"
                  >
                    Time *
                  </label>
                  <input
                    id="weekly-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    aria-label="Time for weekly schedule"
                    title="Time for weekly schedule"
                    placeholder="HH:MM"
                    required
                  />
                </div>
              </>
            )}

            {scheduleType === 'monthly' && (
              <>
                <div>
                  <label
                    htmlFor="monthly-day"
                    className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]"
                  >
                    Day of Month *
                  </label>
                  <input
                    id="monthly-day"
                    type="number"
                    min="1"
                    max="31"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    aria-label="Day of month"
                    title="Day of month (1-31)"
                    placeholder="1-31"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="monthly-time"
                    className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]"
                  >
                    Time *
                  </label>
                  <input
                    id="monthly-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                    aria-label="Time for monthly schedule"
                    title="Time for monthly schedule"
                    placeholder="HH:MM"
                    required
                  />
                </div>
              </>
            )}

            {scheduleType === 'custom' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                  Cron Expression *
                </label>
                <input
                  type="text"
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  placeholder="0 9 * * *"
                  required
                />
                <p className="mt-1 text-xs text-[var(--brand-text-secondary)]">
                  Format: minute hour day month dayOfWeek (e.g., &quot;0 9 * * *&quot; for daily at
                  9 AM)
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                Export Format *
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                aria-label="Select export format"
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                Recipients (comma-separated emails) *
              </label>
              <textarea
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                rows={3}
                placeholder="email1@example.com, email2@example.com"
                required
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[var(--brand-surface-tertiary)] text-[var(--brand-surface-contrast)] rounded hover:bg-[var(--brand-border-strong)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[var(--brand-success)] text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
