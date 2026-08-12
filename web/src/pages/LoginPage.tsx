import { FormEvent, useState } from 'react';
import { login } from '../lib/api';

export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form onSubmit={submit} className="card w-full space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to Plexa</h1>
          <p className="mt-1 text-sm text-muted">Manage Plex music, playlists, and your Alexa skill.</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Username</span>
          <input className="input" aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted">Password</span>
          <input className="input" aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button className="btn btn-primary w-full" type="submit">Sign in</button>
      </form>
    </div>
  );
}
