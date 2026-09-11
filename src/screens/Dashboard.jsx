import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, getCountFromServer } from 'firebase/firestore';
import axios from 'axios';
import { Film, Tv, Users, TrendingUp, Sparkles, Activity } from 'lucide-react';

const SERIES_API_URL = 'https://series.leflow.com.br';

function StatCard({ title, value, icon, color, gradient }) {
  return (
    <div className="glass-card" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '20px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100px',
        height: '100px',
        background: `${color}10`,
        borderRadius: '50%',
        filter: 'blur(30px)',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '58px',
        height: '58px',
        borderRadius: '16px',
        background: gradient || `${color}18`,
        color: color,
        border: `1px solid ${color}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: '4px' }}>
          {title}
        </h3>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'white', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    movies: 0,
    series: 0,
    users: 0,
    views: 0
  });
  const [topContent, setTopContent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // Usuários do Firebase Auth/Firestore
        const usersCountSnap = await getCountFromServer(collection(db, 'users')).catch(() => null);
        let usersCount = usersCountSnap?.data()?.count || 0;

        // Séries da API PostgreSQL
        let seriesCount = 0;
        try {
          const sRes = await axios.get(`${SERIES_API_URL}/series?limit=1`, { timeout: 6000 });
          seriesCount = sRes.data?.total || 0;
        } catch (_) {}

        // Filmes da API PostgreSQL (com fallback Firestore)
        let moviesCount = 0;
        try {
          const mRes = await axios.get(`${SERIES_API_URL}/movies?limit=1`, { timeout: 6000 });
          if (mRes.data && typeof mRes.data.total === 'number') {
            moviesCount = mRes.data.total;
          }
        } catch (_) {}

        if (moviesCount === 0) {
          const moviesCountSnap = await getCountFromServer(collection(db, 'movies')).catch(() => null);
          moviesCount = moviesCountSnap?.data()?.count || 0;
        }

        // Amostra de conteúdos para ranking
        let allContent = [];
        let totalViews = 0;
        try {
          const sampleMovies = await getDocs(collection(db, 'movies'));
          sampleMovies.forEach(doc => {
            const data = doc.data();
            const views = data.views || 0;
            totalViews += views;
            if (views > 0) {
              allContent.push({ 
                id: doc.id, 
                title: data.title, 
                views, 
                type: 'Filme', 
                posterPath: data.posterPath 
              });
            }
          });
        } catch (_) {}

        allContent.sort((a, b) => b.views - a.views);
        setTopContent(allContent.slice(0, 5));

        setStats({
          movies: moviesCount,
          series: seriesCount,
          users: usersCount,
          views: totalViews
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Visão Geral do Sistema
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Métricas em tempo real do catálogo unificado de filmes e séries no PostgreSQL.
          </p>
        </div>

        <div className="system-status-pill">
          <Activity size={14} style={{ color: 'var(--accent)' }} />
          <span>Status Geral: <strong style={{ color: '#10B981' }}>Operacional</strong></span>
        </div>
      </div>

      {/* Grid de Cards de Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '20px'
      }}>
        <StatCard 
          title="Filmes no Catálogo" 
          value={isLoading ? '...' : stats.movies} 
          icon={<Film size={28} />} 
          color="#7B2FF7" 
        />
        <StatCard 
          title="Séries no PostgreSQL" 
          value={isLoading ? '...' : stats.series} 
          icon={<Tv size={28} />} 
          color="#00D4FF" 
        />
        <StatCard 
          title="Usuários Ativos" 
          value={isLoading ? '...' : stats.users} 
          icon={<Users size={28} />} 
          color="#E94560" 
        />
        <StatCard 
          title="Visualizações Totais" 
          value={isLoading ? '...' : stats.views} 
          icon={<TrendingUp size={28} />} 
          color="#10B981" 
        />
      </div>

      {/* Tabela de Top Assistidos */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Top Mais Assistidos
          </h2>
        </div>

        {topContent.length === 0 ? (
          <div style={{ 
            color: 'var(--text-muted)', 
            textAlign: 'center', 
            padding: '48px 0',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px'
          }}>
            Ainda não há visualizações suficientes registradas no aplicativo.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 16px' }}>Título</th>
                  <th style={{ padding: '14px 16px' }}>Tipo</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Visualizações</th>
                </tr>
              </thead>
              <tbody>
                {topContent.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{item.title}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="badge badge-muted">{item.type}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                      {item.views}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
