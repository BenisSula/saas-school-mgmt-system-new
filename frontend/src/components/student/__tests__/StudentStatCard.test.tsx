/**
 * Tests for StudentStatCard component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import { StudentStatCard } from '../StudentStatCard';

describe('StudentStatCard', () => {
  it('renders title and value', () => {
    render(<StudentStatCard title="Total Classes" value={5} icon={TrendingUp} />);

    expect(screen.getByText('Total Classes')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <StudentStatCard title="Attendance" value="85%" description="This term" icon={TrendingUp} />
    );

    expect(screen.getByText('This term')).toBeInTheDocument();
  });

  it('renders trend indicator when provided', () => {
    render(
      <StudentStatCard
        title="Grades"
        value="A"
        icon={TrendingUp}
        trend={{ value: 10, isPositive: true }}
      />
    );

    const trendText = screen.getByText(/↑ 10%/);
    expect(trendText).toBeInTheDocument();
  });
});
