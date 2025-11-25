import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages';
import * as AuthContextModule from '../context/AuthContext';

type MockAuthState = {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    isVerified: boolean;
    status?: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const mockAuthState = (AuthContextModule as unknown as { __mockAuthState: MockAuthState })
  .__mockAuthState;

describe('HomePage', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isAuthenticated = false;
  });

  it('renders key marketing copy', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', {
        name: /Powering modern school operations across every tenant/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start onboarding/i })).toBeInTheDocument();
  });
});
