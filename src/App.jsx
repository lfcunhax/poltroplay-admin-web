import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { LayoutDashboard, Film, Tv, Users, Bell, LogOut, Cloud, Tag, Menu, ChevronLeft, Megaphone, Settings, CloudDownload, Database } from 'lucide-react';

// Placeholders for screens
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import MoviesAdmin from './screens/MoviesAdmin';
import SeriesAdmin from './screens/SeriesAdmin';
import XtreamSync from './screens/XtreamSync';
import BaserowSync from './screens/BaserowSync';
import CategoriesAdmin from './screens/CategoriesAdmin';
import UsersAdmin from './screens/UsersAdmin';
import NotificationsAdmin from './screens/NotificationsAdmin';
import PromotionsAdmin from './screens/PromotionsAdmin';
import SettingsAdmin from './screens/SettingsAdmin';

function PrivateRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>Carregando...</div>;
  }

  // In a real app, also check if user has 'admin' role in Firestore
  if (!user) {
    return <Navigate to="/login" />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function AdminLayout({ children }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    auth.signOut();
  };

  const menuItems = [
    { path: '/', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/xtream', name: 'Sincronizar Xtream', icon: <CloudDownload size={20} /> },
    { path: '/baserow', name: 'Sincronizar Baserow', icon: <Database size={20} /> },
    { path: '/movies', name: 'Filmes Manuais', icon: <Film size={20} /> },
    { path: '/series', name: 'Séries Manuais', icon: <Tv size={20} /> },
    { path: '/categories', name: 'Categorias', icon: <Tag size={20} /> },
    { path: '/users', name: 'Usuários', icon: <Users size={20} /> },
    { path: '/notifications', name: 'Notificações', icon: <Bell size={20} /> },
    { path: '/promotions', name: 'Promoções / Ads', icon: <Megaphone size={20} /> },
    { path: '/settings', name: 'Configurações', icon: <Settings size={20} /> },
  ];

  return (
    <div className="app-container">
      <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between'
        }}>
          {!isSidebarCollapsed && (
            <div>
              <h2 style={{ 
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}>
                PoltroPlay
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Painel Administrativo</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ color: 'var(--text-secondary)', padding: '4px' }}
          >
            {isSidebarCollapsed ? <Menu size={24} /> : <ChevronLeft size={24} />}
          </button>
        </div>
        
        <nav style={{ flex: 1, padding: '16px 0' }}>
          <ul style={{ listStyle: 'none' }}>
            {menuItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link 
                    to={item.path} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                      gap: '12px',
                      padding: '12px 24px',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                      borderRight: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      fontWeight: isActive ? '600' : '400',
                      transition: 'all 0.2s',
                    }}
                    title={isSidebarCollapsed ? item.name : ''}
                  >
                    {item.icon}
                    {!isSidebarCollapsed && item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
              gap: '12px',
              width: '100%',
              padding: '12px',
              color: 'var(--text-muted)',
              borderRadius: '12px',
              transition: 'background 0.2s',
            }}
            title={isSidebarCollapsed ? "Sair do Painel" : ""}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'white'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <LogOut size={20} />
            {!isSidebarCollapsed && "Sair do Painel"}
          </button>
        </div>
      </div>

      <div className="main-content">
        <header className="header">
          <div style={{ flex: 1 }}>
            {/* Search bar could go here */}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: 'white'
            }}>
              A
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>Admin</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>admin@poltroplay.com</div>
            </div>
          </div>
        </header>

        <main className="content-body">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/xtream" element={<PrivateRoute><XtreamSync /></PrivateRoute>} />
        <Route path="/baserow" element={<PrivateRoute><BaserowSync /></PrivateRoute>} />
        <Route path="/movies" element={<PrivateRoute><MoviesAdmin /></PrivateRoute>} />
        <Route path="/series" element={<PrivateRoute><SeriesAdmin /></PrivateRoute>} />
        <Route path="/categories" element={<PrivateRoute><CategoriesAdmin /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><UsersAdmin /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><NotificationsAdmin /></PrivateRoute>} />
        <Route path="/promotions" element={<PrivateRoute><PromotionsAdmin /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><SettingsAdmin /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
