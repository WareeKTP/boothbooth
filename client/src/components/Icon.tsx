import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  Check,
  CheckCircle,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Download,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Lock,
  LogIn,
  LogOut,
  Minus,
  Moon,
  Package,
  PackageCheck,
  PackagePlus,
  Palette,
  Pencil,
  Plus,
  Receipt,
  ScanLine,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  TrendingUp,
  Trophy,
  User,
  Warehouse,
  X,
  type LucideProps,
} from 'lucide-react';

/**
 * Static map of every icon name actually used in the app (kebab-case, matching
 * the mockup's convention) to its real lucide-react component. Replaces a
 * dynamic `icons[pascalCase(name)]` lookup that pulled in the entire
 * lucide-react barrel (~900KB unshaken) for the few dozen icons we use.
 *
 * Add new icons here (and import them above) as new `name="..."` usages are
 * added — `name` is typed against this map's keys, so a missing entry is a
 * compile error, not a silent `Circle` fallback at runtime.
 */
const ICONS = {
  'activity': Activity,
  'alert-circle': AlertCircle,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'banknote': Banknote,
  'bar-chart-3': BarChart3,
  'bell': Bell,
  'boxes': Boxes,
  'check': Check,
  'check-circle': CheckCircle,
  'chevron-right': ChevronRight,
  'chevrons-up-down': ChevronsUpDown,
  'download': Download,
  'key-round': KeyRound,
  'layout-dashboard': LayoutDashboard,
  'line-chart': LineChart,
  'lock': Lock,
  'log-in': LogIn,
  'log-out': LogOut,
  'minus': Minus,
  'moon': Moon,
  'package': Package,
  'package-check': PackageCheck,
  'package-plus': PackagePlus,
  'palette': Palette,
  'pencil': Pencil,
  'plus': Plus,
  'receipt': Receipt,
  'scan-line': ScanLine,
  'scroll-text': ScrollText,
  'search': Search,
  'settings': Settings,
  'shopping-cart': ShoppingCart,
  'store': Store,
  'sun': Sun,
  'trending-up': TrendingUp,
  'trophy': Trophy,
  'user': User,
  'warehouse': Warehouse,
  'x': X,
} as const satisfies Record<string, typeof Circle>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<LucideProps, 'ref'> {
  name: IconName;
}

export function Icon({ name, size = 18, strokeWidth = 1.85, className = '', ...rest }: IconProps) {
  const Component = ICONS[name] ?? Circle;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={`bb-ic ${className}`.trim()}
      aria-hidden="true"
      {...rest}
    />
  );
}
