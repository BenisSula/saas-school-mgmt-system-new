import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from '../pages';

describe('HomePage', () => {
  it('renders key marketing copy', () => {
    render(<HomePage />);

    expect(
      screen.getByText(/Multi-tenant SaaS School Management Portal/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Get Started/i })).toBeInTheDocument();
  });
});

