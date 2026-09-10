import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import axios from 'axios';
import { Bell, Search, Send, Film, Tv, CheckCircle, Image, Sparkles, Smartphone } from 'lucide-react';

const SERIES_API_URL = 'https://series.leflow.com.br';

function NotificationsAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      const q = searchQuery.toLowerCase().trim();
      
      // 1. Busca em Filmes (Firestore)
      const moviesSnap = await getDocs(collection(db, 'movies'));
      const matchedMovies = [];
      moviesSnap.forEach(docSnap => {
        const d = docSnap.data();
        if ((d.title || '').toLowerCase().includes(q)) {
          matchedMovies.push({
            id: docSnap.id,
            title: d.title,
            overview: d.overview || '',
            posterPath: d.posterPath,
            backdropPath: d.backdropPath,
            type: 'Filme'
          });
        }
      });

      // 2. Busca em Séries (PostgreSQL API)
      let matchedSeries = [];
      try {
        const sRes = await axios.get(`${SERIES_API_URL}/series?search=${encodeURIComponent(q)}&limit=10`);
        const sList = sRes.data?.series || [];
        matchedSeries = sList.map(s => ({
          id: s.id,
          title: s.title,
          overview: s.overview || '',
          posterPath: s.poster_path,
          backdropPath: s.backdrop_path,
          type: 'Série'
        }));
      } catch (sErr) {
        console.warn("Erro ao buscar séries na API:", sErr.message);
      }

      const combined = [...matchedMovies.slice(0, 8), ...matchedSeries.slice(0, 8)];
      setSearchResults(combined);
    } catch (err) {
      console.error("Erro na busca de conteúdo:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectContent = (item) => {
    setTitle(`Novo Lançamento: ${item.title}`);
    setBody(item.overview ? (item.overview.substring(0, 140) + '...') : `Assista agora a ${item.title} no PoltroPlay!`);
    
    let img = item.backdropPath || item.posterPath;
    if (img) {
      if (!img.startsWith('http')) {
        img = `https://image.tmdb.org/t/p/w780${img}`;
      }
      setImageUrl(img);
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert("Preencha o título e a mensagem da notificação.");
      return;
    }

    setSending(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setSuccessModal(true);
      setTitle('');
      setBody('');
      setImageUrl('');
    } catch (err) {
      console.error("Erro ao enviar notificação:", err);
      alert("Erro ao disparar notificação: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cabeçalho */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
          Enviar Notificação Push
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
          Envie alertas diretamente para o celular de todos os usuários do app PoltroPlay.
        </p>
      </div>

      {/* Busca Rápida com Auto-preenchimento */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>
          <Sparkles size={18} />
          <span>Busca Inteligente (Auto-preenchimento com Capa)</span>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Pesquise por filme ou série para preencher capa e título automaticamente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '44px', borderRadius: '12px' }}
            />
          </div>
          <button 
            type="submit" 
            className="btn-secondary" 
            disabled={isSearching}
            style={{ borderRadius: '12px', padding: '10px 20px' }}
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div style={{
            marginTop: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '10px',
            maxHeight: '260px',
            overflowY: 'auto',
            padding: '4px'
          }}>
            {searchResults.map(item => (
              <div 
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectContent(item)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.backgroundColor = 'rgba(0, 212, 255, 0.08)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--surface-border)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'; }}
              >
                {item.type === 'Filme' ? <Film size={18} style={{ color: 'var(--accent)' }} /> : <Tv size={18} style={{ color: '#FBBF24' }} />}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <span className="badge badge-muted" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Formulário + Pré-visualização em Tempo Real */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Formulário de Envio */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Título da Notificação:
              </label>
              <input
                type="text"
                placeholder="Ex: Novo Lançamento: Vingadores!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Mensagem:
              </label>
              <textarea
                placeholder="Descreva a novidade para seus usuários..."
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                style={{ borderRadius: '12px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                URL da Imagem / Banner (Opcional):
              </label>
              <input
                type="url"
                placeholder="https://exemplo.com/imagem.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ borderRadius: '12px' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={sending}
              style={{ borderRadius: '12px', padding: '14px', marginTop: '6px' }}
            >
              <Send size={18} />
              {sending ? 'Disparando Notificação...' : 'Disparar Notificação'}
            </button>
          </form>
        </div>

        {/* Pré-visualização com Bordas Suaves (Estilo Smartphone Android) */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', width: '100%' }}>
            <Smartphone size={18} style={{ color: 'var(--accent)' }} />
            <span>Pré-visualização no Smartphone (Android)</span>
          </div>

          <div className="push-preview-card" style={{ width: '100%' }}>
            {/* Header da Notificação */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '0.75rem'
                }}>
                  P
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>PoltroPlay</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• agora</span>
              </div>
              <Bell size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Conteúdo */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white', marginBottom: '4px' }}>
                  {title || 'Título da Notificação'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {body || 'Mensagem da notificação aparecerá aqui...'}
                </div>
              </div>

              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Prévia" 
                  style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--surface-border)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modal de Sucesso */}
      {successModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '440px', width: '100%',
            overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)', color: '#34D399',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <CheckCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>
                Notificação Agendada!
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                A notificação foi salva com sucesso e será disparada para todos os usuários cadastrados.
              </p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <button 
                className="btn-primary" 
                onClick={() => setSuccessModal(false)}
                style={{ padding: '8px 28px', borderRadius: '10px' }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default NotificationsAdmin;
