import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { BrandProvider } from '../BrandProvider';

describe('Modal', () => {
  it('invokes onClose when escape is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <BrandProvider>
        <Modal title="Confirm" isOpen onClose={handleClose}>
          <p>Modal content</p>
        </Modal>
      </BrandProvider>
    );

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows keyboard navigation between focusable elements', async () => {
    const user = userEvent.setup();
    render(
      <BrandProvider>
        <Modal
          title="Actions"
          isOpen
          onClose={() => {}}
          footer={
            <>
              <Button variant="ghost">Cancel</Button>
              <Button>Save</Button>
            </>
          }
        >
          <Button>Primary action</Button>
        </Modal>
      </BrandProvider>
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.tab();
    expect(screen.getByRole('button', { name: 'Primary action' })).toHaveFocus();
    await user.tab();
    expect(cancelButton).toHaveFocus();
  });
});
