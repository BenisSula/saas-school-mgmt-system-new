import { useState } from 'react';
import { X, Copy, Download, Mail, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { toast } from 'sonner';

export interface CredentialDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    userId?: string;
  };
  onEmailSent?: () => void;
}

export function CredentialDisplayModal({
  isOpen,
  onClose,
  credentials,
  onEmailSent
}: CredentialDisplayModalProps) {
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  if (!isOpen) return null;

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy password');
    }
  };

  const handleCopyAll = async () => {
    const text = `Email: ${credentials.email}\nPassword: ${credentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Credentials copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy credentials');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloadingPDF(true);
      const response = await api.downloadCredentialPDF({
        email: credentials.email,
        password: credentials.password,
        fullName: credentials.fullName,
        role: credentials.role
      });

      // Create blob from base64
      const binaryString = atob(response.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `credentials-${credentials.email}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Failed to download PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleEmailCredentials = async () => {
    try {
      setSendingEmail(true);
      await api.sendCredentialEmail({
        email: credentials.email,
        password: credentials.password,
        fullName: credentials.fullName,
        role: credentials.role
      });
      toast.success('Credentials email sent successfully');
      onEmailSent?.();
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-[var(--brand-muted)] transition-colors hover:bg-[var(--brand-surface)]/50 hover:text-[var(--brand-surface-contrast)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="mb-6">
          <h2 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Account Credentials
          </h2>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            User account has been created successfully. Please securely share these credentials with
            the user.
          </p>
        </header>

        <div className="space-y-4">
          {/* User Information */}
          <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--brand-surface-contrast)]">
              User Information
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-[var(--brand-muted)]">Name:</span>{' '}
                <span className="text-[var(--brand-surface-contrast)]">{credentials.fullName}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--brand-muted)]">Email:</span>{' '}
                <span className="text-[var(--brand-surface-contrast)]">{credentials.email}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--brand-muted)]">Role:</span>{' '}
                <span className="text-[var(--brand-surface-contrast)] capitalize">
                  {credentials.role}
                </span>
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div className="rounded-lg border-2 border-[var(--brand-secondary)] bg-[var(--brand-surface)]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--brand-surface-contrast)]">
              Login Credentials
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--brand-muted)]">
                  Email
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-[var(--brand-surface)] px-3 py-2 text-sm font-mono text-[var(--brand-surface-contrast)]">
                    {credentials.email}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(credentials.email);
                      toast.success('Email copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--brand-muted)]">
                  Temporary Password
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded bg-[var(--brand-surface)] px-3 py-2 text-sm font-mono text-[var(--brand-surface-contrast)]">
                    {credentials.password}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                    disabled={copied}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Security Warning */}
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>⚠️ Important:</strong> Please change the password after the first login for
              security purposes. Keep these credentials secure and do not share them publicly.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button variant="outline" onClick={handleCopyAll} className="flex-1">
              <Copy className="mr-2 h-4 w-4" />
              Copy All
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              {downloadingPDF ? 'Downloading...' : 'Download PDF'}
            </Button>
            <Button
              onClick={handleEmailCredentials}
              disabled={sendingEmail}
              className="flex-1"
            >
              <Mail className="mr-2 h-4 w-4" />
              {sendingEmail ? 'Sending...' : 'Email to User'}
            </Button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

