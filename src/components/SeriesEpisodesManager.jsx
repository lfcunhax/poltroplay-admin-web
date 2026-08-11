import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Video, Tv } from 'lucide-react';

function SeriesEpisodesManager({ series, onBack }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form
  const [season, setSeason] = useState(1);
  const [episodeNum, setEpisodeNum] = useState(1);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchEpisodes();
  }, [series.id]);

  const fetchEpisodes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'series', series.id, 'episodes'));
      let epList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort in JS to avoid requiring Firestore composite indexes
      epList.sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
        return a.episodeNumber - b.episodeNumber;
      });
      
      setEpisodes(epList);
    } catch (error) {
      console.error("Erro ao buscar episódios:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEpisode = async (e) => {
    e.preventDefault();
    if (!title || !videoUrl || !season || !episodeNum) {
      alert("Preencha todos os campos do episódio.");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'series', series.id, 'episodes'), {
        seasonNumber: Number(season),
        episodeNumber: Number(episodeNum),
        title: title,
        videoUrl: videoUrl,
        createdAt: serverTimestamp()
      });
      setTitle('');
      setVideoUrl('');
      setEpisodeNum(prev => Number(prev) + 1); // Auto-increment para o próximo
      fetchEpisodes();
    } catch (error) {
      console.error("Erro ao salvar episódio:", error);
      alert("Falha ao salvar episódio.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (epId) => {
    if (window.confirm("Excluir este episódio?")) {
      await deleteDoc(doc(db, 'series', series.id, 'episodes', epId));
      fetchEpisodes();
    }
  };

  return (
    <div>
      <button onClick={onBack} className="btn-secondary" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ArrowLeft size={18} /> Voltar para Séries
      </button>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
        <img 
          src={`https://image.tmdb.org/t/p/w185${series.posterPath}`} 
          alt={series.title}
          style={{ width: '120px', borderRadius: '8px', boxShadow: '0 8px 16px rgba(0,0,0,0.5)' }}
        />
        <div>
          <h1 style={{ marginBottom: '8px', fontSize: '28px' }}>{series.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '600px' }}>{series.overview}</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {series.tags?.map(tag => (
              <span key={tag} style={{ background: 'rgba(123, 47, 247, 0.2)', color: 'var(--primary-light)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Form Add Episode */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} color="var(--accent)" /> Adicionar Episódio
          </h3>
          <form onSubmit={handleSaveEpisode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Temporada</label>
                <input type="number" min="1" value={season} onChange={e => setSeason(e.target.value)} required style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Episódio</label>
                <input type="number" min="1" value={episodeNum} onChange={e => setEpisodeNum(e.target.value)} required style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Título do Episódio</label>
              <input type="text" placeholder="Ex: Piloto" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>URL do Vídeo (M3U8)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '0 16px' }}>
                <Video size={18} color="var(--text-muted)" />
                <input 
                  type="url" 
                  style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '12px 0', width: '100%' }}
                  placeholder="https://servidor.com/ep1.m3u8"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={isSaving} style={{ marginTop: '8px' }}>
              {isSaving ? 'Salvando...' : 'Adicionar Episódio'}
            </button>
          </form>
        </div>

        {/* Episodes List */}
        <div className="glass-card" style={{ padding: 0 }}>
          <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Tv size={20} color="var(--primary-light)" /> Lista de Episódios
            </h3>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando episódios...</div>
          ) : episodes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum episódio cadastrado.</div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>SxE</th>
                    <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>Título</th>
                    <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {episodes.map(ep => (
                    <tr key={ep.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 24px', fontWeight: 'bold', color: 'var(--primary-light)' }}>
                        S{ep.seasonNumber.toString().padStart(2, '0')}E{ep.episodeNumber.toString().padStart(2, '0')}
                      </td>
                      <td style={{ padding: '12px 24px' }}>{ep.title}</td>
                      <td style={{ padding: '12px 24px' }}>
                        <button onClick={() => handleDelete(ep.id)} style={{ color: 'var(--accent-alt)' }} title="Excluir Episódio">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeriesEpisodesManager;
