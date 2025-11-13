import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  return (
    <LandingPage
      onShowAuth={(nextMode: 'login' | 'register') =>
        navigate(nextMode === 'register' ? '/auth/register' : '/auth/login')
      }
    />
  );
}

export default HomePage;
