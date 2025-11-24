import React from 'react';
import { Button } from '../ui/Button';
import {
  UserPlus,
  GraduationCap,
  BookOpen,
  Upload,
  FileText,
  Shield,
  Settings,
  LogIn,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
}

export interface QuickActionPanelProps {
  onRegisterTeacher?: () => void;
  onRegisterStudent?: () => void;
  onCreateClass?: () => void;
  onUploadCSV?: () => void;
  onGenerateReports?: () => void;
  onViewAuditLogs?: () => void;
  onManageRoles?: () => void;
  onSessionManager?: () => void;
  className?: string;
}

export function QuickActionPanel({
  onRegisterTeacher,
  onRegisterStudent,
  onCreateClass,
  onUploadCSV,
  onGenerateReports,
  onViewAuditLogs,
  onManageRoles,
  onSessionManager,
  className = '',
}: QuickActionPanelProps) {
  const navigate = useNavigate();

  const defaultActions: QuickAction[] = [
    {
      id: 'register-teacher',
      label: 'Register New Teacher',
      icon: <UserPlus className="h-4 w-4" />,
      onClick: () => onRegisterTeacher?.() || navigate('/dashboard/admin/users'),
      variant: 'solid',
    },
    {
      id: 'register-student',
      label: 'Register New Student',
      icon: <GraduationCap className="h-4 w-4" />,
      onClick: () => onRegisterStudent?.() || navigate('/dashboard/admin/users'),
      variant: 'solid',
    },
    {
      id: 'create-class',
      label: 'Create Class',
      icon: <BookOpen className="h-4 w-4" />,
      onClick: () => onCreateClass?.() || navigate('/dashboard/admin/classes-subjects'),
      variant: 'outline',
    },
    {
      id: 'upload-csv',
      label: 'Upload CSV',
      icon: <Upload className="h-4 w-4" />,
      onClick: () => onUploadCSV?.() || navigate('/dashboard/admin/teachers'),
      variant: 'outline',
    },
    {
      id: 'generate-reports',
      label: 'Generate Reports',
      icon: <FileText className="h-4 w-4" />,
      onClick: () => onGenerateReports?.() || navigate('/dashboard/admin/reports'),
      variant: 'outline',
    },
    {
      id: 'view-audit-logs',
      label: 'View Audit Logs',
      icon: <Shield className="h-4 w-4" />,
      onClick: () => onViewAuditLogs?.() || navigate('/dashboard/admin'),
      variant: 'outline',
    },
    {
      id: 'manage-roles',
      label: 'Manage Roles',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => onManageRoles?.() || navigate('/dashboard/admin/users'),
      variant: 'outline',
    },
    {
      id: 'session-manager',
      label: 'Session Manager',
      icon: <LogIn className="h-4 w-4" />,
      onClick: () => onSessionManager?.() || navigate('/dashboard/admin'),
      variant: 'outline',
    },
  ];

  return (
    <div
      className={`rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm ${className}`}
    >
      <h3 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
        Quick Actions
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {defaultActions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            className="flex items-center justify-center gap-2"
            size="sm"
          >
            {action.icon}
            <span className="hidden sm:inline">{action.label}</span>
            <span className="sm:hidden">{action.label.split(' ')[0]}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default QuickActionPanel;
