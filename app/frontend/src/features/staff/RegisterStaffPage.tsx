import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { useToast } from '../../app/ToastContext';
import { apiClient, ApiError } from '../../lib/apiClient';
import { useBooths } from '../../lib/queries/useBooths';
import type { AccountDTO } from '../../lib/types';

export function RegisterStaffPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const boothsQuery = useBooths();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [boothId, setBoothId] = useState('');

  const register = useMutation({
    mutationFn: (body: { fullName: string; email: string; password: string; boothId: string }) =>
      apiClient.post<{ account: AccountDTO }>('/accounts', body),
    onSuccess: () => {
      toast('Staff account created', 'ok');
      navigate('/booths');
    },
  });

  const errorMessage =
    register.error instanceof ApiError
      ? register.error.code === 'email_taken'
        ? 'That email is already in use.'
        : register.error.message
      : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate({ fullName, email, password, boothId });
  };

  return (
    <div className="bb-screen">
      <button className="bb-back" onClick={() => navigate('/booths')}>
        <Icon name="arrow-left" size={14} /> Back
      </button>
      <div className="bb-page-head">
        <div>
          <h1 className="bb-h1">Register Staff</h1>
          <p className="bb-sub">Create a new staff account</p>
        </div>
      </div>

      <Card pad={false} className="bb-panel">
        <div className="bb-panel-head">
          <h2 className="bb-h2">
            <Icon name="user-plus" size={15} /> Account details
          </h2>
        </div>
        <form className="bb-set-body" onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="bb-set-row-error" role="alert">
              {errorMessage}
            </div>
          )}
          <label className="bb-field">
            <span>Full name</span>
            <input
              className="bb-input"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="bb-field">
            <span>Email</span>
            <input
              className="bb-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="new-password"
              required
            />
            <span className="bb-set-row-s">Minimum 8 characters</span>
          </label>
          <label className="bb-field">
            <span>Booth</span>
            <select
              className="bb-input"
              value={boothId}
              onChange={(e) => setBoothId(e.target.value)}
              required
            >
              <option value="" disabled>Select a booth…</option>
              {boothsQuery.data?.map((booth) => (
                <option key={booth.id} value={booth.id}>
                  {booth.name} · {booth.location}
                </option>
              ))}
            </select>
          </label>
          <div className="bb-set-actions">
            <Button variant="solid" icon="user-plus" type="submit" disabled={register.isPending}>
              {register.isPending ? 'Registering…' : 'Register'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
