import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { BrandProvider } from '../BrandProvider';

describe('Button', () => {
  it('renders children and handles click', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <BrandProvider>
        <Button onClick={handleClick}>Save</Button>
      </BrandProvider>
    );

    const button = screen.getByRole('button', { name: 'Save' });
    await user.click(button);
    expect(handleClick).toHaveBeenCalled();
  });

  it('marks button as disabled during loading', () => {
    render(
      <BrandProvider>
        <Button loading>Processing</Button>
      </BrandProvider>
    );

    const button = screen.getByRole('button', { name: 'Processing' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});


