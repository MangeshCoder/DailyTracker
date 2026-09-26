// WFH approve / reject from an email link.
// Logic unchanged (single call guarded by hasCalled); UI uses EmailActionCard.
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { wfhApi } from '../services/api';
import { EmailActionCard } from '../components/EmailActionCard';

export const WFHEmailActionPage = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Processing request...');
  const [error, setError] = useState(false);

  const hasCalled = useRef(false);

  useEffect(() => {
    if (hasCalled.current) return;
    hasCalled.current = true;

    const token = searchParams.get('token');
    const status = searchParams.get('status');

    if (!token || !status) {
      setMessage('Invalid email link.');
      setError(true);
      setLoading(false);
      return;
    }

    wfhApi.reviewFromEmail(token, status)
      .then(() => {
        setMessage(`WFH request successfully ${status}.`);
      })
      .catch((err) => {
        setMessage(
          err.response?.data?.message ||
          (typeof err.response?.data === 'string' ? err.response.data : '') ||
          'Failed to process request.'
        );
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  return (
    <EmailActionCard
      kind="WFH"
      state={loading ? 'loading' : error ? 'error' : 'success'}
      message={message}
    />
  );
};
