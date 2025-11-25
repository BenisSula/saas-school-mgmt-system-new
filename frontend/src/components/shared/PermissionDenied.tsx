import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export interface PermissionDeniedProps {
  permission?: string;
  message?: string;
}

export function PermissionDenied({ permission, message }: PermissionDeniedProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          {message ? (
            <p className="text-muted-foreground">{message}</p>
          ) : permission ? (
            <p className="text-muted-foreground">
              You do not have the required permission: <strong>{permission}</strong>
            </p>
          ) : (
            <p className="text-muted-foreground">You do not have permission to access this page.</p>
          )}
        </div>
        <Link to="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    </Card>
  );
}
