import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Film, Tv, Users, TrendingUp } from 'lucide-react';

function StatCard({ title, value, icon, color }) {
  return (
    <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: `${color}20`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{title}</h3>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'white' }}>{value}</div>
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

  useEffect(() => {
    // In a real scenario, this might be a Cloud Function aggregation to avoid reading all docs
    const fetchStats = async () => {
      try {
        const moviesSnap = await getDocs(collection(db, 'movies'));
        const seriesSnap = await getDocs(collection(db, 'series'));
        const usersSnap = await getDocs(collection(db, 'users'));
        
        let totalViews = 0;
        let allContent = [];

        moviesSnap.forEach(doc => {
          const data = doc.data();
          const views = data.views || 0;
          totalViews += views;
          if (views > 0) allContent.push({ id: doc.id, title: data.title, views, type: 'Filme', posterPath: data.posterPath });
        });

        seriesSnap.forEach(doc => {
          const data = doc.data();
          const views = data.views || 0;
          totalViews += views;
          if (views > 0) allContent.push({ id: doc.id, title: data.title, views, type: 'Série', posterPath: data.posterPath });
        });

        allContent.sort((a, b) => b.views - a.views);
        setTopContent(allContent.slice(0, 5));

        setStats({
          movies: moviesSnap.size,
          series: seriesSnap.size,
          users: usersSnap.size,
          views: totalViews
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Bem-vindo ao Painel de Controle do PoltroPlay.</p>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '24px',
        marginBottom: '40px'
      }}>
        <StatCard 
          title="Filmes Cadastrados" 
          value={stats.movies} 
          icon={<Film size={32} />} 
          color="#7B2FF7" 
        />
        <StatCard 
          title="Séries Cadastradas" 
          value={stats.series} 
          icon={<Tv size={32} />} 
          color="#00D4FF" 
        />
        <StatCard 
          title="Usuários Ativos" 
          value={stats.users} 
          icon={<Users size={32} />} 
          color="#E94560" 
        />
        <StatCard 
          title="Total de Visualizações" 
          value={stats.views} 
          icon={<TrendingUp size={32} />} 
          color="#4CAF50" 
        />
      </div>

      <div className="glass-card">
        <h2 style={{ marginBottom: '24px', fontSize: '20px' }}>Top 5 Mais Assistidos</h2>
        {topContent.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            Ainda não há visualizações registradas.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Tipo</th>
                <th>Views</th>
              </tr>
            </thead>
            <tbody>
              {topContent.map((item, idx) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold', minWidth: '30px' }}>#{idx + 1}</span>
                      {item.posterPath ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${item.posterPath}`} 
                          alt={item.title}
                          style={{ width: '40px', height: '60px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '40px', height: '60px', borderRadius: '8px', backgroundColor: 'var(--surface-light)' }} />
                      )}
                      <span style={{ fontWeight: '600' }}>{item.title}</span>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>{item.type}</td>
                  <td style={{ verticalAlign: 'middle' }}><span className="status-badge success">{item.views} views</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
