// Leave approve / reject from an email link.
// Logic unchanged (single call guarded by hasCalled); UI uses EmailActionCard.
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaveApi } from '../services/api';
import { EmailActionCard } from '../components/EmailActionCard';

export const EmailAction = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');
  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;

    const token = searchParams.get('token');
    const status = searchParams.get('status');

    if (!token || !status) {
      setMessage('Invalid email link.');
      setState('error');
      return;
    }

    leaveApi.reviewFromEmail(token, status)
      .then(() => {
        setMessage(`Leave ${status} successfully.`);
        setState('success');
      })
      .catch((err) => {
        setMessage(
          err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : '') ||
          'Something went wrong'
        );
        setState('error');
      });
  }, [searchParams]);

  return <EmailActionCard kind="Leave" state={state} message={message} />;
};
