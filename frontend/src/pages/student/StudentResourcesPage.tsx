/**
 * Student Resources Page
 * Allows students to view and download class resources
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { useStudentResources } from '../../hooks/queries/useStudentPhase7';
import { api } from '../../lib/api';
import { FileText, Download } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';

export default function StudentResourcesPage() {
  // Get student profile to get classId
  const { data: profile } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => api.student.getProfile()
  });

  const classId = useMemo(() => {
    if (!profile) return undefined;
    // Profile has classId or className field
    return (profile as { classId?: string; className?: string }).classId || 
           (profile as { classId?: string; className?: string }).className;
  }, [profile]);
  
  const { data: resources, isLoading } = useStudentResources(classId);

  const handleDownload = (fileUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <RouteMeta title="Class Resources">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Class Resources</h1>

        {isLoading && <StatusBanner status="loading" message="Loading resources..." />}

        {resources && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-8">
                No resources available
              </div>
            ) : (
              resources.map((resource) => (
                <div
                  key={resource.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <FileText className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-1">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                  )}
                  <div className="text-xs text-gray-500 mb-3">
                    {formatDate(resource.created_at)} • {(resource.size / 1024).toFixed(1)} KB
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(resource.file_url, resource.title)}
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </RouteMeta>
  );
}

