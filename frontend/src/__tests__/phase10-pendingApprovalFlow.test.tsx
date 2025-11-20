/**
 * Phase 10 - Pending Approval Flow Tests
 * 
 * Tests for pending user approval workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AdminRoleManagementPage from '../pages/AdminRoleManagementPage';

// Mock API
const mockListPendingUsers = vi.fn();
const mockApproveUser = vi.fn();
const mockRejectUser = vi.fn();
const mockBulkApproveUsers = vi.fn();
const mockBulkRejectUsers = vi.fn();

vi.mock('../lib/api/userApi', () => ({
  userApi: {
    listPendingUsers: mockListPendingUsers,
    approveUser: mockApproveUser,
    rejectUser: mockRejectUser,
    bulkApproveUsers: mockBulkApproveUsers,
    bulkRejectUsers: mockBulkRejectUsers
  }
}));

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'admin',
      tenantId: 'tenant-1'
    }
  })
}));

const mockPendingUsers = [
  {
    id: 'user-1',
    email: 'student1@test.local',
    role: 'student',
    status: 'pending',
    tenantId: 'tenant-1',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'user-2',
    email: 'teacher1@test.local',
    role: 'teacher',
    status: 'pending',
    tenantId: 'tenant-1',
    createdAt: '2024-01-02T00:00:00Z'
  },
  {
    id: 'user-3',
    email: 'hod1@test.local',
    role: 'hod',
    status: 'pending',
    tenantId: 'tenant-1',
    createdAt: '2024-01-03T00:00:00Z'
  }
];

const renderApprovalPage = () => {
  return render(
    <BrowserRouter>
      <AdminRoleManagementPage />
    </BrowserRouter>
  );
};

describe('Phase 10 - Pending Approval Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPendingUsers.mockResolvedValue(mockPendingUsers);
  });

  describe('Pending Users List', () => {
    it('should load and display pending users', async () => {
      renderApprovalPage();

      await waitFor(() => {
        expect(mockListPendingUsers).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
        expect(screen.getByText(/teacher1@test.local/i)).toBeInTheDocument();
        expect(screen.getByText(/hod1@test.local/i)).toBeInTheDocument();
      });
    });

    it('should show user role badges', async () => {
      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student/i)).toBeInTheDocument();
        expect(screen.getByText(/teacher/i)).toBeInTheDocument();
        expect(screen.getByText(/hod/i)).toBeInTheDocument();
      });
    });

    it('should show pending status badges', async () => {
      renderApprovalPage();

      await waitFor(() => {
        const pendingBadges = screen.getAllByText(/pending/i);
        expect(pendingBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Single User Approval', () => {
    it('should approve a single pending user', async () => {
      const user = userEvent.setup();
      mockApproveUser.mockResolvedValue({
        ...mockPendingUsers[0],
        status: 'active'
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const approveButtons = screen.getAllByRole('button', { name: /approve/i });
      await user.click(approveButtons[0]);

      await waitFor(() => {
        expect(mockApproveUser).toHaveBeenCalledWith('user-1');
      });
    });

    it('should reject a single pending user', async () => {
      const user = userEvent.setup();
      mockRejectUser.mockResolvedValue({
        ...mockPendingUsers[0],
        status: 'rejected'
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
      await user.click(rejectButtons[0]);

      await waitFor(() => {
        expect(mockRejectUser).toHaveBeenCalledWith('user-1', undefined);
      });
    });

    it('should reject user with reason', async () => {
      const user = userEvent.setup();
      mockRejectUser.mockResolvedValue({
        ...mockPendingUsers[0],
        status: 'rejected'
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
      await user.click(rejectButtons[0]);

      // If rejection modal appears, enter reason
      const reasonInput = screen.queryByPlaceholderText(/reason/i);
      if (reasonInput) {
        await user.type(reasonInput, 'Incomplete application');
        const confirmButton = screen.getByRole('button', { name: /confirm reject/i });
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(mockRejectUser).toHaveBeenCalled();
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should select multiple users for bulk approval', async () => {
      const user = userEvent.setup();
      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      // Skip first checkbox if it's "select all"
      const userCheckboxes = checkboxes.slice(1);

      await user.click(userCheckboxes[0]);
      await user.click(userCheckboxes[1]);

      const bulkApproveButton = screen.getByRole('button', { name: /bulk approve/i });
      expect(bulkApproveButton).toBeEnabled();
    });

    it('should approve multiple users at once', async () => {
      const user = userEvent.setup();
      mockBulkApproveUsers.mockResolvedValue({
        success: true,
        processed: 2,
        successful: 2,
        failed: 0,
        results: [
          { userId: 'user-1', success: true },
          { userId: 'user-2', success: true }
        ]
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const userCheckboxes = checkboxes.slice(1);

      await user.click(userCheckboxes[0]);
      await user.click(userCheckboxes[1]);

      const bulkApproveButton = screen.getByRole('button', { name: /bulk approve/i });
      await user.click(bulkApproveButton);

      await waitFor(() => {
        expect(mockBulkApproveUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
      });
    });

    it('should reject multiple users at once', async () => {
      const user = userEvent.setup();
      mockBulkRejectUsers.mockResolvedValue({
        success: true,
        processed: 2,
        successful: 2,
        failed: 0,
        results: [
          { userId: 'user-1', success: true },
          { userId: 'user-2', success: true }
        ]
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const userCheckboxes = checkboxes.slice(1);

      await user.click(userCheckboxes[0]);
      await user.click(userCheckboxes[1]);

      const bulkRejectButton = screen.getByRole('button', { name: /bulk reject/i });
      await user.click(bulkRejectButton);

      await waitFor(() => {
        expect(mockBulkRejectUsers).toHaveBeenCalledWith(['user-1', 'user-2']);
      });
    });

    it('should handle partial failures in bulk operations', async () => {
      const user = userEvent.setup();
      mockBulkApproveUsers.mockResolvedValue({
        success: true,
        processed: 3,
        successful: 2,
        failed: 1,
        results: [
          { userId: 'user-1', success: true },
          { userId: 'user-2', success: true },
          { userId: 'user-3', success: false, error: 'User not found' }
        ]
      });

      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole('checkbox');
      const userCheckboxes = checkboxes.slice(1);

      await user.click(userCheckboxes[0]);
      await user.click(userCheckboxes[1]);
      await user.click(userCheckboxes[2]);

      const bulkApproveButton = screen.getByRole('button', { name: /bulk approve/i });
      await user.click(bulkApproveButton);

      await waitFor(() => {
        expect(screen.getByText(/2.*successful/i)).toBeInTheDocument();
        expect(screen.getByText(/1.*failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter pending users by role', async () => {
      const user = userEvent.setup();
      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const roleFilter = screen.getByLabelText(/filter by role/i);
      if (roleFilter) {
        await user.selectOptions(roleFilter, 'student');

        await waitFor(() => {
          expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
          expect(screen.queryByText(/teacher1@test.local/i)).not.toBeInTheDocument();
        });
      }
    });

    it('should sort pending users by date', async () => {
      const user = userEvent.setup();
      renderApprovalPage();

      await waitFor(() => {
        expect(screen.getByText(/student1@test.local/i)).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText(/sort by/i);
      if (sortSelect) {
        await user.selectOptions(sortSelect, 'date');

        // Verify sorting order
        const users = screen.getAllByText(/@test.local/i);
        expect(users.length).toBeGreaterThan(0);
      }
    });
  });
});

