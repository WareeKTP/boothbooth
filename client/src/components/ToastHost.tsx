import { Dot, type DotStatus } from './Dot';

export interface ToastItem {
  id: number;
  text: string;
  status?: DotStatus;
}

interface ToastHostProps {
  toasts: ToastItem[];
}

export function ToastHost({ toasts }: ToastHostProps) {
  return (
    <div className="bb-toasts">
      {toasts.map((t) => (
        <div key={t.id} className="bb-toast">
          <Dot status={t.status ?? 'ok'} size={8} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
