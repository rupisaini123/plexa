import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../pages/LoginPage';

vi.mock('../lib/api', () => ({
  login: vi.fn(),
}));

import { login } from '../lib/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(login).mockReset();
  });

  it('signs in successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    vi.mocked(login).mockResolvedValue(undefined);

    render(<LoginPage onSuccess={onSuccess} />);
    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('admin', 'secret');
  });

  it('shows error on failed login', async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage onSuccess={vi.fn()} />);
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  });
});
