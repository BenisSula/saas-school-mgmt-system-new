import { render, cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  })
}));

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    value: () => null,
    configurable: true
  });
});

afterAll(() => {
  delete (window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext;
});

describe('Accessibility smoke suite', () => {
  it('Home page renders without axe-core violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    const results = await axe(container, {
      rules: {
        'definition-list': { enabled: false }
      }
    });
    expect(results.violations).toHaveLength(0);
  });
});
