/**
 * Student Resource Card Component
 * Displays a class resource with download option
 */

import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { FileText, Download } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';

interface StudentResourceCardProps {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileType: string;
  size: number;
  createdAt: string;
  onDownload?: (fileUrl: string, filename: string) => void;
}

export function StudentResourceCard({
  title,
  description,
  fileUrl,
  size,
  createdAt,
  onDownload,
}: StudentResourceCardProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload(fileUrl, title);
    } else {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FileText className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1 truncate">{title}</h3>
          {description && <p className="text-sm text-gray-600 mb-2 line-clamp-2">{description}</p>}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDate(createdAt)}</span>
            <span>{(size / 1024).toFixed(1)} KB</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} className="w-full mt-3">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </Card>
  );
}
