import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { Dot } from '../components/Dot';
import { Button } from '../components/Button';
import { CurrentUserMenu } from './CurrentUserMenu';
import { useTheme } from './ThemeContext';
import { useSession } from '../features/auth/useSession';
import { useWarehouse } from '../lib/queries/useWarehouse';
import { useRestockRequests } from '../lib/queries/useRestockRequests';
import { useCart } from '../features/pos/useCart';
import type { AccountDTO } from '../lib/types';

interface NavItem {
  to: string;
  icon: IconName;
  label: string;
  badge?: number;
  badgeColor?: string;
}

function buildNav(account: AccountDTO, lowWarehouseCount: number, pendingRestockCount: number, cartUnits: number): NavItem[] {
  if (account.role === 'owner') {
    return [
      { to: '/dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
      { to: '/booths', icon: 'store', label: 'Booths' },
      { to: '/warehouse', icon: 'warehouse', label: 'Warehouse', badge: lowWarehouseCount, badgeColor: 'var(--warn)' },
      { to: '/restock', icon: 'package-plus', label: 'Restock', badge: pendingRestockCount, badgeColor: 'var(--accent)' },
    ];
  }
  return [
    { to: '/pos', icon: 'scan-line', label: 'Sell', badge: cartUnits, badgeColor: 'var(--accent)' },
    { to: '/my-booth', icon: 'boxes', label: 'My Booth' },
    { to: '/warehouse', icon: 'warehouse', label: 'Warehouse' },
    { to: '/daily-log', icon: 'scroll-text', label: 'Daily Log' },
  ];
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { theme, toggleTheme } = useTheme();
  const { account } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const { unitCount: cartUnits } = useCart();

  const isOwner = account?.role === 'owner';
  const warehouseQuery = useWarehouse();
  const restockQuery = useRestockRequests();

  const lowWarehouseCount = warehouseQuery.data?.filter((p) => p.status === 'out' || p.status === 'low').length ?? 0;
  const pendingRestockCount = isOwner ? (restockQuery.data?.filter((r) => r.status === 'pending').length ?? 0) : 0;

  if (!account) return null;

  const nav = buildNav(account, lowWarehouseCount, pendingRestockCount, cartUnits);
  const searchHomeRoute = account.role === 'owner' ? '/warehouse' : '/pos';
  const searchablePaths = ['/pos', '/warehouse'];

  return (
    <div className="bb-app">
      <aside className="bb-side">
        <div className="bb-brand">
          <div className="bb-logo">
            <Icon name="store" size={18} />
          </div>
          <div>
            <div className="bb-brand-name">Boothbooth</div>
            <div className="bb-brand-sub mono">EXPO STOCK + POS</div>
          </div>
        </div>
        <nav className="bb-nav">
          {nav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to} className={'bb-navitem' + (active ? ' on' : '')}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {!!item.badge && (
                  <span className="bb-navbadge" style={{ background: item.badgeColor }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="bb-side-foot">
          <div className="bb-side-card">
            <div className="bb-side-card-row">
              <Dot status="ok" size={7} pulse />
              <span className="mono">{account.role === 'owner' ? 'ALL BOOTHS' : account.booth?.code}</span>
            </div>
            <div className="bb-side-card-sub mono">{account.expo.name}</div>
          </div>
          <CurrentUserMenu
            user={{ fullName: account.fullName, role: account.role, boothLabel: account.booth?.code }}
          />
        </div>
      </aside>

      <div className="bb-body">
        <header className="bb-topbar">
          <div className="bb-searchbox">
            <Icon name="search" size={16} />
            <input
              placeholder={account.role === 'owner' ? 'Search products…' : 'Search products to sell…'}
              value={search}
              onFocus={() => {
                if (!searchablePaths.includes(location.pathname)) navigate(searchHomeRoute);
              }}
              onChange={(e) => {
                const next = e.target.value;
                setSearchParams(next ? { q: next } : {}, { replace: true });
              }}
            />
            {search && (
              <button
                className="bb-iconbtn"
                onClick={() => setSearchParams({}, { replace: true })}
                aria-label="Clear search"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <div className="bb-top-right">
            <button
              className="bb-iconbtn bb-mode-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
            <span className="bb-rolepill mono">
              {account.role === 'owner' ? 'OWNER VIEW' : `STAFF · ${account.booth?.code}`}
            </span>
            {account.role === 'staff' && (
              <Button variant="solid" icon="scan-line" onClick={() => navigate('/pos')}>
                New sale
              </Button>
            )}
          </div>
        </header>

        <main className="bb-main">{children}</main>
      </div>
    </div>
  );
}
