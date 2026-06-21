import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { useSession, useLogout } from '../auth/useSession';
import { useTheme } from '../../app/ThemeContext';
import { useDensity, type Density } from '../../app/DensityContext';
import { useToast } from '../../app/ToastContext';
import { apiClient, ApiError } from '../../lib/apiClient';
import { queryKeys } from '../../lib/queries/keys';
import type { AccountDTO, UpdatePasswordReq, UpdatePrefsReq, UpdatePrefsResponse, UpdateProfileReq } from '../../lib/types';

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={'bb-switch' + (on ? ' on' : '')}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
    >
      <span className="bb-switch-knob" />
    </button>
  );
}

/**
 * Three distinct interaction models on one page, intentionally not unified
 * behind one "Save" button — see frontend-final.md §8 for why:
 *  1. Appearance: client-only Context state, instant, no save/spinner.
 *  2. Notifications: server prefs, each toggle is its own optimistic mutation.
 *  3. Account: PATCH /api/me/profile and /api/me/password, separate forms
 *     with their own submit buttons (deliberate user-initiated saves).
 */
export function SettingsPage() {
  const { account } = useSession();
  const navigate = useNavigate();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();

  if (!account) return null;

  const booth = account.booth;
  const avatarStyle = {
    background: account.role === 'owner' ? 'color-mix(in oklch, var(--accent) 22%, transparent)' : 'var(--surface-2)',
    color: account.role === 'owner' ? 'var(--accent)' : 'var(--text-2)',
  };

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  return (
    <div className="bb-screen">
      <button className="bb-back" onClick={() => navigate(account.role === 'owner' ? '/dashboard' : '/pos')}>
        <Icon name="arrow-left" size={14} /> Back
      </button>
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Account Settings</h1>
          <p className="bb-sub">Manage your profile, security, and preferences</p>
        </div>
      </div>

      <div className="bb-set-id">
        <div className="bb-avatar bb-avatar-xl mono" style={avatarStyle}>
          {initialsOf(account.fullName)}
        </div>
        <div>
          <div className="bb-set-name">{account.fullName}</div>
          <div className="bb-set-tags">
            <span className="bb-rolepill mono">{account.role === 'owner' ? 'OWNER' : 'STAFF'}</span>
            {booth && (
              <span className="bb-rolepill mono">
                {booth.name} · {booth.location}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bb-grid-2">
        <div className="bb-col">
          <ProfileCard account={account} />
          <PasswordCard />
        </div>

        <div className="bb-col">
          <Card pad={false} className="bb-panel">
            <div className="bb-panel-head">
              <h2 className="bb-h2">
                <Icon name="palette" size={15} /> Appearance
              </h2>
            </div>
            <div className="bb-set-body">
              <div className="bb-set-row">
                <div>
                  <div className="bb-set-row-t">Theme</div>
                  <div className="bb-set-row-s">Light or dark interface</div>
                </div>
                <div className="bb-segment">
                  <button className={'bb-seg' + (theme === 'light' ? ' on' : '')} onClick={() => setTheme('light')}>
                    Light
                  </button>
                  <button className={'bb-seg' + (theme === 'dark' ? ' on' : '')} onClick={() => setTheme('dark')}>
                    Dark
                  </button>
                </div>
              </div>
              <div className="bb-set-row">
                <div>
                  <div className="bb-set-row-t">Density</div>
                  <div className="bb-set-row-s">Spacing of tables and cards</div>
                </div>
                <div className="bb-segment">
                  {(['compact', 'regular', 'comfy'] as Density[]).map((d) => (
                    <button key={d} className={'bb-seg' + (density === d ? ' on' : '')} onClick={() => setDensity(d)}>
                      {d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <NotificationsCard account={account} />

          <Card pad={false} className="bb-panel">
            <div className="bb-panel-head">
              <h2 className="bb-h2">
                <Icon name="log-out" size={15} /> Session
              </h2>
            </div>
            <div className="bb-set-body">
              <div className="bb-set-row">
                <div>
                  <div className="bb-set-row-t">Sign out</div>
                  <div className="bb-set-row-s">End this session and return to login</div>
                </div>
                <Button variant="danger" icon="log-out" onClick={handleLogout} disabled={logout.isPending}>
                  Log out
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ account }: { account: AccountDTO }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(account.fullName);
  const [email, setEmail] = useState(account.email);
  const [phone, setPhone] = useState(account.phone ?? '');

  const updateProfile = useMutation({
    mutationFn: (input: UpdateProfileReq) => apiClient.patch<AccountDTO>('/me/profile', input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.session, data);
      toast('Profile saved', 'ok');
    },
    onError: (err) => {
      toast(err instanceof ApiError && err.code === 'email_taken' ? 'That email is already in use.' : 'Couldn\'t save profile.', 'out');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ fullName, email, phone: phone || undefined });
  };

  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="user" size={15} /> Profile
        </h2>
      </div>
      <form className="bb-set-body" onSubmit={handleSubmit}>
        <label className="bb-field">
          <span>Full name</span>
          <input className="bb-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="bb-field">
          <span>Email</span>
          <input className="bb-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="bb-field">
          <span>Phone</span>
          <input className="bb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className="bb-set-actions">
          <Button variant="solid" icon="check" type="submit" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePassword = useMutation({
    mutationFn: (input: UpdatePasswordReq) => apiClient.patch<void>('/me/password', input),
    onSuccess: () => {
      toast('Password updated', 'ok');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast(
        err instanceof ApiError && err.code === 'wrong_current_password'
          ? 'Current password is incorrect.'
          : err instanceof ApiError && err.code === 'weak_password'
            ? 'New password is too weak.'
            : "Couldn't update password.",
        'out',
      );
    },
  });

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mismatch || !currentPassword || !newPassword) return;
    updatePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="lock" size={15} /> Security
        </h2>
      </div>
      <form className="bb-set-body" onSubmit={handleSubmit}>
        <label className="bb-field">
          <span>Current password</span>
          <input
            className="bb-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="bb-field">
          <span>New password</span>
          <input
            className="bb-input"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="bb-field">
          <span>Confirm new password</span>
          <input
            className="bb-input"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {mismatch && <div className="bb-set-row-error">Passwords don't match.</div>}
        <div className="bb-set-actions">
          <Button variant="ghost" icon="key-round" type="submit" disabled={updatePassword.isPending}>
            {updatePassword.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Server-persisted prefs — each toggle is its own optimistic PATCH /api/me/prefs
 * mutation (rollback + inline error on failure), per frontend-final.md §8 Group 2.
 * Not Context state, no localStorage mirror.
 */
function NotificationsCard({ account }: { account: AccountDTO }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const updatePrefs = useMutation({
    mutationFn: (input: UpdatePrefsReq) => apiClient.patch<UpdatePrefsResponse>('/me/prefs', input),
    onMutate: async (input) => {
      setError(null);
      const previous = queryClient.getQueryData<AccountDTO>(queryKeys.session);
      if (previous) {
        queryClient.setQueryData<AccountDTO>(queryKeys.session, {
          ...previous,
          prefs: { ...previous.prefs, ...input },
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.session, context.previous);
      setError("Couldn't save — try again.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AccountDTO>(queryKeys.session, (prev) => (prev ? { ...prev, prefs: data.prefs } : prev));
    },
  });

  return (
    <Card pad={false} className="bb-panel">
      <div className="bb-panel-head">
        <h2 className="bb-h2">
          <Icon name="bell" size={15} /> Notifications
        </h2>
      </div>
      <div className="bb-set-body">
        <div className="bb-set-row">
          <div>
            <div className="bb-set-row-t">Low-stock alerts</div>
            <div className="bb-set-row-s">When a product drops below reorder</div>
          </div>
          <Switch
            on={account.prefs.notifyLowStock}
            disabled={updatePrefs.isPending}
            onChange={(v) => updatePrefs.mutate({ notifyLowStock: v })}
          />
        </div>
        <div className="bb-set-row">
          <div>
            <div className="bb-set-row-t">Daily summary</div>
            <div className="bb-set-row-s">End-of-day sales report by email</div>
          </div>
          <Switch
            on={account.prefs.notifyDailySummary}
            disabled={updatePrefs.isPending}
            onChange={(v) => updatePrefs.mutate({ notifyDailySummary: v })}
          />
        </div>
        {error && <div className="bb-set-row-error">{error}</div>}
      </div>
    </Card>
  );
}
