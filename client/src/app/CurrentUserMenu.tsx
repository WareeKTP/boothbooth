import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useLogout } from '../features/auth/useSession';
import type { AccountDTO } from '../lib/types';

interface CurrentUserMenuUser {
  fullName: string;
  role: AccountDTO['role'];
  boothLabel?: string;
}

interface CurrentUserMenuProps {
  user: CurrentUserMenuUser;
}

function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Replaces the mockup's AccountSwitcher. One human = one account = one role,
 * no in-product role switching (frontend-final.md §3) — this renders a
 * static identity header, not a list of accounts to pick into.
 */
export function CurrentUserMenu({ user }: CurrentUserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const logout = useLogout();

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const avatarStyle = {
    background: user.role === 'owner' ? 'color-mix(in oklch, var(--accent) 22%, transparent)' : 'var(--surface-2)',
    color: user.role === 'owner' ? 'var(--accent)' : 'var(--text-2)',
  };

  const roleLabel = user.role === 'owner' ? 'OWNER' : user.boothLabel ? `STAFF · ${user.boothLabel}` : 'STAFF';

  const handleLogout = async () => {
    setOpen(false);
    await logout.mutateAsync();
    navigate('/login', { replace: true });
  };

  return (
    <div className="bb-acct" ref={ref}>
      {open && (
        <div className="bb-acct-menu">
          <div className="bb-acct-header">
            <div className="bb-avatar mono" style={avatarStyle}>
              {initialsOf(user.fullName)}
            </div>
            <div className="bb-acct-cur">
              <div className="bb-user-name">{user.fullName}</div>
              <div className="bb-user-role mono">{roleLabel}</div>
            </div>
          </div>
          <div className="bb-acct-sep" />
          <Link to="/settings" className="bb-acct-action" onClick={() => setOpen(false)}>
            <Icon name="settings" size={16} />
            <span>Account settings</span>
          </Link>
          <button className="bb-acct-action bb-acct-logout" onClick={handleLogout}>
            <Icon name="log-out" size={16} />
            <span>Log out</span>
          </button>
        </div>
      )}
      <button className="bb-acct-btn" onClick={() => setOpen((o) => !o)}>
        <div className="bb-avatar mono" style={avatarStyle}>
          {initialsOf(user.fullName)}
        </div>
        <div className="bb-acct-cur">
          <div className="bb-user-name">{user.fullName}</div>
          <div className="bb-user-role mono">{roleLabel}</div>
        </div>
        <Icon name="chevrons-up-down" size={15} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
      </button>
    </div>
  );
}
