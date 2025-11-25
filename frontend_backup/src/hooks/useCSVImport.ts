import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from './useQuery';
import { toast } from 'sonner';
import type { CSVImportResult } from '../components/admin/CSVImportModal';

export interface CSVImportOptions {
  entityType: 'teachers' | 'students' | 'hods';
  onSuccess?: (result: CSVImportResult) => void;
  onError?: (error: Error) => void;
  invalidateQueries?: readonly unknown[][];
}

/**
 * Hook for CSV import functionality
 * Handles file parsing and API calls
 */
export function useCSVImport(options: CSVImportOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<CSVImportResult> => {
      // Parse CSV file
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1);

      // Validate headers
      const requiredHeaders = ['email', 'fullname', 'password'];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      // Parse rows and validate
      const errors: Array<{ row: number; message: string }> = [];
      const validRows: Array<Record<string, string>> = [];

      rows.forEach((row, index) => {
        const values = row.split(',').map((v) => v.trim());
        const rowData: Record<string, string> = {};

        headers.forEach((header, idx) => {
          rowData[header] = values[idx] || '';
        });

        // Validate row
        if (!rowData.email || !rowData.fullname || !rowData.password) {
          errors.push({
            row: index + 2, // +2 because index is 0-based and we skip header
            message: 'Missing required fields (email, fullName, password)'
          });
          return;
        }

        if (rowData.password.length < 8) {
          errors.push({
            row: index + 2,
            message: 'Password must be at least 8 characters long'
          });
          return;
        }

        validRows.push(rowData);
      });

      if (validRows.length === 0) {
        return {
          success: 0,
          failed: rows.length,
          errors
        };
      }

      // Call appropriate API based on entity type
      let successCount = 0;
      let failedCount = 0;
      const importErrors: Array<{ row: number; message: string }> = [...errors];

      for (let i = 0; i < validRows.length; i++) {
        const rowData = validRows[i];
        const rowNumber = rows.findIndex((r) => {
          const values = r.split(',').map((v) => v.trim());
          return values[headers.indexOf('email')] === rowData.email;
        }) + 2;

        try {
          // Map row data to API payload
          const payload: Record<string, unknown> = {
            email: rowData.email.toLowerCase(),
            password: rowData.password,
            fullName: rowData.fullname,
            role: options.entityType === 'hods' ? 'teacher' : options.entityType
          };

          // Add optional fields based on entity type
          if (options.entityType === 'teachers' || options.entityType === 'hods') {
            if (rowData.phone) payload.phone = rowData.phone;
            if (rowData.qualifications) payload.qualifications = rowData.qualifications;
            if (rowData.yearsofexperience) payload.yearsOfExperience = parseInt(rowData.yearsofexperience, 10);
            if (rowData.subjects) payload.subjects = rowData.subjects.split(';').map((s) => s.trim());
          }

          if (options.entityType === 'students') {
            if (rowData.dateofbirth) payload.dateOfBirth = rowData.dateofbirth;
            if (rowData.classid) payload.classId = rowData.classid;
            if (rowData.studentid) payload.studentId = rowData.studentid;
            if (rowData.parentguardianname) payload.parentGuardianName = rowData.parentguardianname;
            if (rowData.parentguardiancontact) payload.parentGuardianContact = rowData.parentguardiancontact;
          }

          // Create user
          await api.registerUser(payload as Parameters<typeof api.registerUser>[0]);

          // For HODs, also assign HOD role and department
          if (options.entityType === 'hods') {
            // We need to get the created user ID first
            // For now, we'll handle this in a separate step after import
            // The admin can assign HOD role manually if needed
            if (rowData.department) {
              // TODO: Get user ID and assign department
              // This requires an additional API call
            }
          }

          successCount++;
        } catch (error) {
          failedCount++;
          importErrors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Import failed'
          });
        }
      }

      return {
        success: successCount,
        failed: failedCount,
        errors: importErrors
      };
    },
    onSuccess: (result) => {
      // Invalidate relevant queries
      const queriesToInvalidate = options.invalidateQueries || [];
      
      // Default queries based on entity type
      if (!queriesToInvalidate.length) {
        switch (options.entityType) {
          case 'teachers':
            queriesToInvalidate.push(queryKeys.admin.teachers());
            break;
          case 'students':
            queriesToInvalidate.push(queryKeys.admin.students());
            break;
          case 'hods':
            queriesToInvalidate.push(queryKeys.admin.hods());
            queriesToInvalidate.push(queryKeys.admin.teachers());
            break;
        }
      }

      queriesToInvalidate.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      if (result.success > 0) {
        toast.success(`Successfully imported ${result.success} ${options.entityType}`);
      }

      options.onSuccess?.(result);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'CSV import failed');
      options.onError?.(error);
    }
  });
}

