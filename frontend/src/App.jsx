import React, { useState, useEffect, useCallback } from 'react';
import {
  clearToken,
  createTransfer,
  fetchDashboard,
  fetchUserTransactions,
  getToken,
  isAdminToken,
  loginRequest,
  setToken,
} from './api/client.js';
import LoginPage from './components/LoginPage.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import AdminPage from './components/AdminPage.jsx';

const ADMIN_PATH = '/admin';

function currentPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [path, setPath] = useState(currentPath());

  useEffect(() => {
    const onPopState = () => setPath(currentPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath) => {
    if (currentPath() === nextPath) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }, []);

  const loadDashboard = useCallback(async () => {
    const data = await fetchDashboard();
    const transactions = await fetchUserTransactions(data.user.id);
    setDashboard({ ...data, transactions });
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }

    loadDashboard()
      .catch(() => {
        clearToken();
        setDashboard(null);
      })
      .finally(() => setBootstrapping(false));
  }, [loadDashboard]);

  const handleLogin = async (username, password) => {
    const res = await loginRequest(username, password);
    setToken(res.access_token);
    await loadDashboard();
  };

  const handleLogout = () => {
    clearToken();
    setDashboard(null);
    if (path !== '/') navigate('/');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  const handleTransfer = async (payload) => {
    await createTransfer(payload);
    await loadDashboard();
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060913] text-cyan-300 font-mono text-sm">
        Инициализация защищённой сессии...
      </div>
    );
  }

  if (!dashboard) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (path === ADMIN_PATH) {
    const admin = isAdminToken();
    return (
      <div className="relative">
        <AdminPage
          onBack={() => navigate('/')}
          onLogout={handleLogout}
          isAdmin={admin}
          notice={
            admin
              ? 'Служебный раздел оператора. Все действия протоколируются в audit-log.'
              : 'Уровень доступа недостаточен: раздел доступен только операторам с ролью admin.'
          }
        />
        {!admin && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#060913]/85 backdrop-blur-sm px-4">
            <div className="glass-card rounded-3xl p-8 max-w-md text-center border border-rose-500/30">
              <h2 className="text-lg font-semibold text-white">403 · Доступ ограничен</h2>
              <p className="text-xs text-slate-400 mt-2">
                Для входа в консоль администратора требуется JWT с ролью{' '}
                <span className="font-mono text-rose-300">admin</span>.
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-5 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:border-cyan-400/60 transition"
              >
                Вернуться в личный кабинет
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <DashboardPage
      dashboard={dashboard}
      onLogout={handleLogout}
      onRefresh={handleRefresh}
      onTransfer={handleTransfer}
      onOpenAdmin={() => navigate(ADMIN_PATH)}
      refreshing={refreshing}
    />
  );
}
