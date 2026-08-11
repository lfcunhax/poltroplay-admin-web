import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Search } from 'lucide-react';

function NotificationsAdmin() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsSearching(true);
    setSearchResults([]);
    try {
      // Basic text search simulation in Firestore (Firestore doesn't support full-text natively without extensions)
      // So we will just fetch recent items and filter locally for simplicity in this admin panel
      
      const moviesSnap = await getDocs(collection(db, 'movies'));
      const seriesSnap = await getDocs(collection(db, 'series'));
      
      const allContent = [];
      moviesSnap.forEach(doc => allContent.push({ id: doc.id, ...doc.data(), type: 'Filme' }));
      seriesSnap.forEach(doc => allContent.push({ id: doc.id, ...doc.data(), type: 'Série' }));
      
      const q = searchQuery.toLowerCase();
      const results = allContent.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) || 
        (item.name && item.name.toLowerCase().includes(q))
      ).slice(0, 5); // top 5 results

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectContent = (item) => {
    const itemTitle = item.title || item.name;
    setTitle(`Novo Lançamento: ${itemTitle}`);
    setBody(`${itemTitle} já está disponível no PoltroPlay. Venha assistir agora mesmo!`);
    if (item.backdropPath) {
      setImageUrl(`https://image.tmdb.org/t/p/w780${item.backdropPath}`);
    } else if (item.posterPath) {
      setImageUrl(`https://image.tmdb.org/t/p/w500${item.posterPath}`);
    }
    setSelectedContent({
      id: item.id,
      type: item.type === 'Filme' ? 'movie' : 'tv'
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!title || !body) {
      alert('Título e Mensagem são obrigatórios!');
      return;
    }

    setSending(true);
    try {
      // Em uma aplicação real de produção, isso acionaria uma Cloud Function
      // que envia a notificação via Firebase Cloud Messaging (FCM).
      // Aqui vamos salvar em uma coleção 'notifications' que pode ser
      // monitorada pela Cloud Function, ou lida diretamente pelo app para um "in-app inbox".
      // Salva no banco de dados para histórico
      await addDoc(collection(db, 'notifications'), {
        title,
        body,
        imageUrl,
        contentId: selectedContent?.id || null,
        contentType: selectedContent?.type || null,
        createdAt: serverTimestamp(),
        status: 'sent' 
      });

      // Dispara a notificação real usando o nosso backend local
      const backendUrl = import.meta.env.VITE_API_URL || 'https://api.leflow.com.br';
      const backendResponse = await fetch(`${backendUrl}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          body, 
          imageUrl,
          contentId: selectedContent?.id,
          contentType: selectedContent?.type
        })
      });

      const result = await backendResponse.json();

      if (result.success) {
        alert('Notificação Push disparada com sucesso!');
        setTitle('');
        setBody('');
        setImageUrl('');
        setSelectedContent(null);
      } else {
        alert('Erro do Backend: ' + (result.error || 'Falha ao enviar'));
      }
      setSending(false);

    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      alert('Erro ao enviar notificação.');
      setSending(false);
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h1>Enviar Notificação Push</h1>
        <p>Envie alertas diretamente para o celular de todos os usuários do app.</p>
      </div>

      <div className="form-card">
        {/* Smart Search Box */}
        <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Busca Inteligente (Auto-preenchimento)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            Pesquise por um filme ou série salvo para preencher a notificação automaticamente com a capa.
          </p>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Ex: Homem-Aranha" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-secondary" disabled={isSearching}>
              {isSearching ? 'Buscando...' : <Search size={20} />}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div style={{ marginTop: '16px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              {searchResults.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => handleSelectContent(item)}
                  style={{ 
                    padding: '12px 16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {item.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w92${item.posterPath}`} style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} alt="poster" />
                  ) : (
                    <div style={{ width: '40px', height: '60px', background: 'var(--surface-light)', borderRadius: '4px' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{item.title || item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSendNotification} className="notification-form">
          
          <div className="form-group">
            <label>Título da Notificação</label>
            <input 
              type="text" 
              placeholder="Ex: Novo Lançamento: Vingadores!" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Mensagem</label>
            <textarea 
              placeholder="Descreva a novidade para seus usuários..." 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows="4"
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label>URL da Imagem (Opcional)</label>
            <input 
              type="text" 
              placeholder="https://exemplo.com/imagem.jpg" 
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary btn-large" disabled={sending}>
            {sending ? (
              <><i className="fas fa-spinner fa-spin"></i> Enviando...</>
            ) : (
              <><i className="fas fa-paper-plane"></i> Disparar Notificação</>
            )}
          </button>
        </form>
      </div>
      
      <div className="notification-preview">
        <h3>Pré-visualização (Android)</h3>
        <div className="mock-phone">
          <div className="mock-notification">
            <div className="mock-notif-header">
              <i className="fas fa-play-circle" style={{color: '#7B2FF7'}}></i>
              <span>PoltroPlay • Agora</span>
            </div>
            <div className="mock-notif-content">
              <h4>{title || 'Título da Notificação'}</h4>
              <p>{body || 'Mensagem da notificação aparecerá aqui...'}</p>
              {imageUrl && <img src={imageUrl} alt="preview" className="mock-notif-image" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationsAdmin;
