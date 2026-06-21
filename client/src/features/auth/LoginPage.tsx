import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { useTheme } from '../../app/ThemeContext';
import { useLogin, useSession } from './useSession';
import { ApiError } from '../../lib/apiClient';

/**
 * Real email/password auth only — the mockup's demo-account list
 * (.bb-login-accts) is dropped per frontend-final.md §3: "/login is the only
 * place a different account can be used... no in-app account list anywhere."
 */
export function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const { account } = useSession();
  const navigate = useNavigate();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (account) {
    return <Navigate to={account.role === 'owner' ? '/dashboard' : '/pos'} replace />;
  }

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.code === 'invalid_credentials'
        ? 'Incorrect email or password.'
        : login.error.message
      : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login.mutateAsync({ email, password }).catch(() => null);
    if (result) {
      navigate(result.account.role === 'owner' ? '/dashboard' : '/pos', { replace: true });
    }
  };

  return (
    <div className="bb-login">
      <button
        className="bb-iconbtn bb-login-mode"
        onClick={toggleTheme}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
      <div className="bb-login-card">
        <div className="bb-login-brand">
          <div className="bb-logo bb-logo-lg">
            <Icon name="store" size={22} />
          </div>
          <div>
            <div className="bb-brand-name" style={{ fontSize: '1.15rem' }}>
              Boothbooth
            </div>
            <div className="bb-brand-sub mono">EXPO STOCK + POS</div>
          </div>
        </div>

        <h1 className="bb-login-title">Sign in to your account</h1>
        <p className="bb-login-sub">Welcome back — pick up where the expo left off.</p>

        {errorMessage && (
          <div className="bb-login-error" role="alert">
            <Icon name="alert-circle" size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form className="bb-login-form" onSubmit={handleSubmit}>
          <label className="bb-field">
            <span>Email</span>
            <input
              className="bb-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="bb-field">
            <span>Password</span>
            <input
              className="bb-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button
            variant="solid"
            icon="log-in"
            type="submit"
            disabled={login.isPending}
            style={{ width: '100%', height: 46, justifyContent: 'center', fontSize: '0.92rem', marginTop: 4 }}
          >
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
      <div className="bb-login-foot mono">BOOTHBOOTH</div>
    </div>
  );
}
