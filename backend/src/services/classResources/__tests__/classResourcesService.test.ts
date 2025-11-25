/**
 * Class Resources Service Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { PoolClient } from 'pg';
import {
  listClassResources,
  getClassResource,
  createClassResource,
  updateClassResource,
  deleteClassResource,
  type CreateClassResourceInput,
} from '../unifiedClassResourcesService';

// Mock PoolClient
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
} as unknown as PoolClient;

describe('ClassResourcesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listClassResources', () => {
    it('should list class resources with filters', async () => {
      const mockResources = [
        {
          id: '1',
          class_id: 'class-1',
          title: 'Test Resource',
          resource_type: 'document',
          resource_url: 'https://example.com/doc.pdf',
        },
      ];

      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: mockResources,
      });

      const result = await listClassResources(
        mockClient,
        'test_schema',
        { classId: 'class-1' },
        { limit: 10, offset: 0 }
      );

      expect(result).toEqual(mockResources);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM test_schema.class_resources'),
        expect.any(Array)
      );
    });
  });

  describe('getClassResource', () => {
    it('should get a class resource by ID', async () => {
      const mockResource = {
        id: '1',
        class_id: 'class-1',
        title: 'Test Resource',
        resource_type: 'document',
        resource_url: 'https://example.com/doc.pdf',
      };

      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockResource],
      });

      const result = await getClassResource(mockClient, 'test_schema', '1');

      expect(result).toEqual(mockResource);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM test_schema.class_resources WHERE id = $1'),
        ['1']
      );
    });

    it('should return null if resource not found', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await getClassResource(mockClient, 'test_schema', '1');

      expect(result).toBeNull();
    });
  });

  describe('createClassResource', () => {
    it('should create a new class resource', async () => {
      const input: CreateClassResourceInput = {
        class_id: 'class-1',
        title: 'New Resource',
        description: 'Test description',
        resource_type: 'document',
        resource_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
      };

      const mockCreated = {
        id: '1',
        ...input,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockCreated] })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await createClassResource(mockClient, 'test_schema', input, 'user-1');

      expect(result).toEqual(mockCreated);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO test_schema.class_resources'),
        expect.arrayContaining([input.class_id, input.title])
      );
    });
  });

  describe('updateClassResource', () => {
    it('should update an existing class resource', async () => {
      const updates = {
        title: 'Updated Title',
      };

      const mockUpdated = {
        id: '1',
        class_id: 'class-1',
        title: 'Updated Title',
        resource_type: 'document',
        resource_url: 'https://example.com/doc.pdf',
      };

      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockUpdated] })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await updateClassResource(mockClient, 'test_schema', '1', updates, 'user-1');

      expect(result).toEqual(mockUpdated);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_schema.class_resources'),
        expect.any(Array)
      );
    });

    it('should return null if resource not found', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const result = await updateClassResource(
        mockClient,
        'test_schema',
        '1',
        { title: 'Updated' },
        'user-1'
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteClassResource', () => {
    it('should delete a class resource', async () => {
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await deleteClassResource(mockClient, 'test_schema', '1', 'user-1');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM test_schema.class_resources'),
        ['1']
      );
    });

    it('should return false if resource not found', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 0,
      });

      const result = await deleteClassResource(mockClient, 'test_schema', '1', 'user-1');

      expect(result).toBe(false);
    });
  });
});
