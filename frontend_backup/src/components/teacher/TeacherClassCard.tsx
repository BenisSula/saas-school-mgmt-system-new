/**
 * Teacher Class Card Component
 * Displays class information with quick actions
 */

import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Users, BookOpen, ClipboardList } from 'lucide-react';
import type { TeacherClassInfo } from '../../lib/api';

interface TeacherClassCardProps {
  classInfo: TeacherClassInfo;
  onViewStudents?: () => void;
  onMarkAttendance?: () => void;
}

export function TeacherClassCard({ classInfo, onViewStudents, onMarkAttendance }: TeacherClassCardProps) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-lg">{classInfo.name}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {classInfo.studentCount || 0} {classInfo.studentCount === 1 ? 'student' : 'students'}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        {onViewStudents && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewStudents}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1" />
            Students
          </Button>
        )}
        {onMarkAttendance && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarkAttendance}
            className="flex-1"
          >
            <ClipboardList className="h-4 w-4 mr-1" />
            Attendance
          </Button>
        )}
        <Link to={`/dashboard/teacher/grades?classId=${classInfo.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <BookOpen className="h-4 w-4 mr-1" />
            Grades
          </Button>
        </Link>
      </div>
    </Card>
  );
}

