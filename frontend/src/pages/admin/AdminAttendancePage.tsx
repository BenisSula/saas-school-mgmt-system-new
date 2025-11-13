import RouteMeta from '../../components/layout/RouteMeta';
import TeacherAttendancePage from '../TeacherAttendancePage';

export default function AdminAttendancePage() {
  return (
    <RouteMeta title="Attendance tracking">
      <TeacherAttendancePage />
    </RouteMeta>
  );
}
