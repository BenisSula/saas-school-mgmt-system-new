/**
 * Teacher Quick Actions Component
 * Provides quick action buttons for teacher dashboard
 */

import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { BookOpen, Users, ClipboardList, FileText, MessageSquare, Download } from 'lucide-react';

interface QuickAction {
  label: string;
  path: string;
  icon: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
}

const quickActions: QuickAction[] = [
  {
    label: 'Mark Attendance',
    path: '/dashboard/teacher/attendance',
    icon: <ClipboardList className="h-4 w-4" />,
    variant: 'default'
  },
  {
    label: 'Enter Grades',
    path: '/dashboard/teacher/grades',
    icon: <BookOpen className="h-4 w-4" />,
    variant: 'default'
  },
  {
    label: 'View Students',
    path: '/dashboard/teacher/students',
    icon: <Users className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    label: 'Class Resources',
    path: '/dashboard/teacher/resources',
    icon: <FileText className="h-4 w-4" />,
    variant: 'outline'
  },
  {
    label: 'Announcements',
    path: '/dashboard/teacher/announcements',
    icon: <MessageSquare className="h-4 w-4" />,
    variant: 'outline'
  }
];

export function TeacherQuickActions() {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {quickActions.map((action) => (
        <Link key={action.path} to={action.path}>
          <Button variant={action.variant} className="w-full justify-start">
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </Button>
        </Link>
      ))}
    </div>
  );
}

