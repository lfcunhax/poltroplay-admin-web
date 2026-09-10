import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import axios from 'axios';
import { 
  LayoutDashboard, Film, Tv, Users, Bell, LogOut, Tag, Menu, 
  ChevronLeft, Megaphone, Settings, CloudDownload, Database, Server
} from 'lucide-react';

// Screens
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
import PrivacyPolicy from './screens/PrivacyPolicy';
import TermsOfService from './screens/TermsOfService';
import AboutPage from './screens/AboutPage';

function SystemStatusCards() {
  const [pgOnline, setPgOnline] = useState(true);
  const [firestoreOnline, setFirestoreOnline] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkConnections = async () => {
      // 1. Check PostgreSQL Series API
      try {
        const res = await axios.get('https://series.leflow.com.br/series?limit=1', { timeout: 6000 });
        if (isMounted) setPgOnline(res.status === 200);
      } catch (err) {
        if (isMounted) setPgOnline(false);
      }

      // 2. Check Firestore
      try {
        await getDocs(query(collection(db, 'movies'), limit(1)));
        if (isMounted) setFirestoreOnline(true);
      } catch (err) {
        if (isMounted) setFirestoreOnline(false);
      }
    };

    checkConnections();
    const interval = setInterval(checkConnections, 45000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* PostgreSQL Status Card */}
      <div 
        className={`db-status-card ${pgOnline ? 'online' : 'offline'}`}
        title={`PostgreSQL Séries: ${pgOnline ? 'Conexão ativa e operando normalmente' : 'Sem resposta no momento'}`}
      >
        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '9px',
          background: pgOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: pgOnline ? '#10B981' : '#EF4444',
          flexShrink: 0
        }}>
          <Server size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            PostgreSQL Séries
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={pgOnline ? 'status-dot-online' : 'status-dot-offline'}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: pgOnline ? '#10B981' : '#EF4444' }}>
              {pgOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Firestore Status Card */}
      <div 
        className={`db-status-card ${firestoreOnline ? 'online' : 'offline'}`}
        title={`Firestore Filmes: ${firestoreOnline ? 'Conexão ativa e operando normalmente' : 'Sem resposta no momento'}`}
      >
        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '9px',
          background: firestoreOnline ? 'rgba(0, 212, 255, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: firestoreOnline ? '#00D4FF' : '#EF4444',
          flexShrink: 0
        }}>
          <Database size={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Firestore Filmes
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={firestoreOnline ? 'status-dot-online' : 'status-dot-offline'}></span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: firestoreOnline ? '#00D4FF' : '#EF4444' }}>
              {firestoreOnline ? 'Conectado' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setUser(currentUser);
          } else {
            console.warn('Acesso negado: Usuário não é admin.');
            setUser(null);
          }
        } catch (error) {
          console.error('Erro ao verificar perfil admin:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
          <div className="status-dot-online"></div>
          <span>Carregando Acesso PoltroPlay...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function AdminLayout({ children }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    signOut(auth);
  };

  const menuItems = [
    { path: '/', name: 'Dashboard', icon: <LayoutDashboard size={19} /> },
    { path: '/baserow', name: 'Sincronizar Baserow', icon: <Database size={19} /> },
    { path: '/xtream', name: 'Sincronizar Xtream', icon: <CloudDownload size={19} /> },
    { path: '/movies', name: 'Filmes Manuais', icon: <Film size={19} /> },
    { path: '/series', name: 'Séries Manuais', icon: <Tv size={19} /> },
    { path: '/categories', name: 'Categorias', icon: <Tag size={19} /> },
    { path: '/users', name: 'Usuários', icon: <Users size={19} /> },
    { path: '/notifications', name: 'Notificações', icon: <Bell size={19} /> },
    { path: '/promotions', name: 'Promoções / Ads', icon: <Megaphone size={19} /> },
    { path: '/settings', name: 'Configurações', icon: <Settings size={19} /> },
  ];

  return (
    <div className="app-container">
      {/* Sidebar travada e fixa */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
          flexShrink: 0
        }}>
          {!isSidebarCollapsed && (
            <div>
              <h2 style={{ 
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
                fontSize: '1.4rem',
                letterSpacing: '-0.02em'
              }}>
                PoltroPlay
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Painel Administrativo
              </span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{ color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
            title={isSidebarCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        <nav style={{ flex: 1, padding: '16px 0', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none' }}>
            {menuItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path} style={{ margin: '3px 0' }}>
                  <Link 
                    to={item.path} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                      gap: '14px',
                      padding: '11px 24px',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
                      borderRight: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      fontWeight: isActive ? '600' : '400',
                      fontSize: '0.92rem',
                      textDecoration: 'none',
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

        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
              gap: '12px',
              width: '100%',
              padding: '10px 12px',
              color: 'var(--text-muted)',
              borderRadius: '10px',
              transition: 'all 0.2s',
            }}
            title={isSidebarCollapsed ? "Sair do Painel" : ""}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)'; e.currentTarget.style.color = '#F87171'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <LogOut size={18} />
            {!isSidebarCollapsed && "Sair do Painel"}
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal com scroll independente */}
      <div className="main-content">
        <header className="header">
          {/* Status Cards com bordas suaves e piscando */}
          <SystemStatusCards />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              color: 'white',
              fontSize: '1rem',
              boxShadow: '0 4px 12px var(--primary-glow)'
            }}>
              A
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>Admin PoltroPlay</div>
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
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/about" element={<AboutPage />} />
        
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
