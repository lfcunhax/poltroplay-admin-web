import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import axios from 'axios';
import { 
  Plus, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Trash2, 
  Power, 
  Film, 
  Tv, 
  Search, 
  Sparkles, 
  ShoppingBag, 
  Layers, 
  Smartphone, 
  CheckCircle2, 
  ExternalLink, 
  Play, 
  AlertCircle,
  Eye,
  Info,
  SlidersHorizontal,
  X
} from 'lucide-react';

const SERIES_API_URL = 'https://series.leflow.com.br';

function PromotionsAdmin() {
  const [promotions, setPromotions] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' (Filme/Série) | 'product' (Produto/Link)
  const [filterType, setFilterType] = useState('all'); // 'all', 'catalog', 'product', 'active'
  
  // Campos do Formulário
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [contentId, setContentId] = useState('');
  const [contentType, setContentType] = useState(null); // 'movie' | 'tv' | null
  const [isAdding, setIsAdding] = useState(false);
  const [overview, setOverview] = useState("");
  const [rating, setRating] = useState(0);

  // Busca de Conteúdo do Catálogo
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modal de Exclusão
  const [promoToDelete, setPromoToDelete] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'promotions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromotions(promosData);
    });
    return () => unsubscribe();
  }, []);

  // Busca Inteligente no Catálogo (Postgres e Firestore)
  const handleSearchContent = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    const q = searchQuery.toLowerCase().trim();

    try {
      // 1. Busca Filmes no PostgreSQL API
      let matchedMovies = [];
      try {
        const mRes = await axios.get(`${SERIES_API_URL}/movies?search=${encodeURIComponent(q)}&limit=8`);
        const mList = mRes.data?.movies || [];
        matchedMovies = mList.map(m => ({
          id: m.id,
          title: m.title,
          overview: m.overview || '',
          voteAverage: m.vote_average || m.voteAverage || 0,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          type: 'movie',
          label: 'Filme'
        }));
      } catch (err) {
        console.warn('Erro na busca de filmes API:', err);
      }

      // Fallback Firestore Filmes caso a API não retorne resultados
      if (matchedMovies.length === 0) {
        try {
          const moviesSnap = await getDocs(collection(db, 'movies'));
          moviesSnap.forEach(docSnap => {
            const d = docSnap.data();
            if ((d.title || '').toLowerCase().includes(q)) {
              matchedMovies.push({
                id: docSnap.id,
                title: d.title,
                overview: d.overview || '',
                posterPath: d.posterPath,
                backdropPath: d.backdropPath,
                type: 'movie',
                label: 'Filme'
              });
            }
          });
        } catch (_) {}
      }

      // 2. Busca Séries no PostgreSQL API
      let matchedSeries = [];
      try {
        const sRes = await axios.get(`${SERIES_API_URL}/series?search=${encodeURIComponent(q)}&limit=8`);
        const sList = sRes.data?.series || [];
        matchedSeries = sList.map(s => ({
          id: s.id,
          title: s.title,
          overview: s.overview || '',
          voteAverage: s.vote_average || s.voteAverage || 0,
          posterPath: s.poster_path,
          backdropPath: s.backdrop_path,
          type: 'tv',
          label: 'Série'
        }));
      } catch (err) {
        console.warn('Erro na busca de séries API:', err);
      }

      setSearchResults([...matchedMovies.slice(0, 8), ...matchedSeries.slice(0, 8)]);
    } catch (error) {
      console.error('Erro geral na busca:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Seleciona item da busca e auto-preenche o formulário
  const handleSelectSearchResult = (item) => {
    setTitle(item.title);
    
    // Pega o backdrop horizontal em alta resolução (w1280) para proporção ideal 16:9
    let img = item.backdropPath || item.posterPath || '';
    if (img && !img.startsWith('http')) {
      img = `https://image.tmdb.org/t/p/w1280${img}`;
    }
    setImageUrl(img);
    setContentId(String(item.id));
    setContentType(item.type);
    setOverview(item.overview || "");
    setRating(item.voteAverage || 0);
    setTargetUrl('');
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleAddPromotion = async (e) => {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      alert("Por favor, preencha o título e a URL do banner!");
      return;
    }

    if (activeTab === 'product' && !targetUrl.trim()) {
      alert("Para divulgar um produto ou anúncio, informe o link de destino (URL)!");
      return;
    }

    setIsAdding(true);
    try {
      const isCatalog = activeTab === 'catalog';
      await addDoc(collection(db, 'promotions'), {
        title: title.trim(),
        imageUrl: imageUrl.trim(),
        targetUrl: targetUrl.trim() || '',
        contentId: isCatalog && contentId ? String(contentId) : null,
        contentType: isCatalog && contentType ? String(contentType) : null,
        type: isCatalog ? (contentType === 'tv' ? 'series' : 'movie') : 'product',
        overview: isCatalog ? (overview || '').trim() : '',
        rating: isCatalog ? (Number(rating) || 0) : 0,
        isActive: true,
        createdAt: serverTimestamp()
      });

      // Limpar formulário
      setTitle('');
      setImageUrl('');
      setTargetUrl('');
      setContentId('');
      setContentType(null);
      setOverview("");
      setRating(0);
      setSearchQuery('');
      setSearchResults([]);
      alert("Destaque adicionado ao carrossel com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar destaque:", error);
      alert("Erro ao adicionar ao carrossel: " + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'promotions', id), {
        isActive: !currentStatus
      });
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      alert("Erro ao atualizar status: " + error.message);
    }
  };

  const confirmDelete = async () => {
    if (!promoToDelete) return;
    try {
      await deleteDoc(doc(db, 'promotions', promoToDelete.id));
      setPromoToDelete(null);
    } catch (error) {
      console.error("Erro ao deletar:", error);
      alert("Erro ao remover: " + error.message);
    }
  };

  // Filtros da lista
  const filteredPromotions = useMemo(() => {
    return promotions.filter(p => {
      if (filterType === 'active') return p.isActive;
      if (filterType === 'catalog') return p.contentId || p.type === 'movie' || p.type === 'series';
      if (filterType === 'product') return !p.contentId && (p.type === 'product' || p.targetUrl);
      return true;
    });
  }, [promotions, filterType]);

  const activeCount = promotions.filter(p => p.isActive).length;
  const catalogCount = promotions.filter(p => p.contentId || p.type === 'movie' || p.type === 'series').length;
  const productCount = promotions.filter(p => !p.contentId && (p.type === 'product' || p.targetUrl)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Carrossel & Anúncios em Destaque
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Gerencie os banners exibidos no carrossel de topo do aplicativo (filmes, séries e anúncios patrocinados).
          </p>
        </div>

        {/* Indicador de Status Geral */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'var(--surface)',
          padding: '10px 18px',
          borderRadius: '14px',
          border: '1px solid var(--surface-border)'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Ativos no Carrossel</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>{activeCount} / {promotions.length}</div>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'var(--surface-border)' }} />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Catálogo / Produtos</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>{catalogCount} 🎬 • {productCount} 🛍️</div>
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulário de Adição + Simulador Real-Time */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        
        {/* Painel de Cadastro */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Seletor de Tipo de Destaque (Tabs) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              O que você deseja colocar no carrossel?
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              background: 'rgba(0,0,0,0.25)',
              padding: '6px',
              borderRadius: '14px',
              border: '1px solid var(--surface-border)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('catalog');
                  setTargetUrl('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: activeTab === 'catalog' ? 'linear-gradient(135deg, #7B2FF7 0%, #00D4FF 100%)' : 'transparent',
                  color: activeTab === 'catalog' ? 'white' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'catalog' ? '0 4px 14px rgba(123, 47, 247, 0.35)' : 'none'
                }}
              >
                <Film size={17} />
                <span>Filme ou Série</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('product');
                  setContentId('');
                  setContentType(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: activeTab === 'product' ? 'linear-gradient(135deg, #10B981 0%, #00D4FF 100%)' : 'transparent',
                  color: activeTab === 'product' ? 'white' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'product' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none'
                }}
              >
                <ShoppingBag size={17} />
                <span>Produto / Anúncio</span>
              </button>
            </div>
          </div>

          {/* Seletor de Busca para Filme ou Série */}
          {activeTab === 'catalog' && (
            <div style={{
              background: 'rgba(123, 47, 247, 0.08)',
              border: '1px solid rgba(123, 47, 247, 0.2)',
              padding: '16px',
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                <Sparkles size={16} />
                <span>Busca Inteligente no Catálogo (Auto-preenchimento)</span>
              </div>

              <form onSubmit={handleSearchContent} style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Digite o nome do filme ou série..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '38px', borderRadius: '10px', fontSize: '0.9rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={isSearching}
                  style={{ borderRadius: '10px', padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
              </form>

              {/* Resultados da Busca */}
              {searchResults.length > 0 && (
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  background: 'var(--surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--surface-border-bright)',
                  padding: '6px'
                }}>
                  {searchResults.map(item => (
                    <div
                      key={`${item.type}_${item.id}`}
                      onClick={() => handleSelectSearchResult(item)}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {item.posterPath ? (
                        <img 
                          src={item.posterPath.startsWith('http') ? item.posterPath : `https://image.tmdb.org/t/p/w92${item.posterPath}`} 
                          alt={item.title}
                          style={{ width: '34px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      ) : (
                        <div style={{ width: '34px', height: '50px', background: 'var(--surface-light)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Film size={16} />
                        </div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </div>
                        <span className="badge badge-muted" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                          {item.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleAddPromotion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                {activeTab === 'catalog' ? 'Título do Destaque:' : 'Título do Produto ou Anúncio:'}
              </label>
              <input
                type="text"
                placeholder={activeTab === 'catalog' ? 'Ex: Avatar: O Último Mestre do Ar' : 'Ex: Camiseta Exclusiva PoltroPlay - 20% OFF'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                URL da Imagem do Banner (Proporção Horizontal 16:9):
              </label>
              <input
                type="url"
                placeholder="https://exemplo.com/banner-1280x720.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                required
                style={{ borderRadius: '12px' }}
              />
            </div>

            {activeTab === 'product' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Link de Destino (Para onde o usuário vai ao clicar no banner?):
                </label>
                <div style={{ position: 'relative' }}>
                  <ExternalLink size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="url"
                    placeholder="https://sua-loja.com.br/produto"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    required
                    style={{ paddingLeft: '40px', borderRadius: '12px' }}
                  />
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Ao clicar no app, abrirá este link diretamente no navegador do usuário.
                </span>
              </div>
            ) : (
              contentId && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.82rem',
                  color: 'var(--accent)'
                }}>
                  <CheckCircle2 size={16} />
                  <span>Vinculado com sucesso: <strong>{contentType === 'tv' ? 'Série' : 'Filme'} (ID: {contentId})</strong>. O app abrirá os detalhes do conteúdo ao tocar.</span>
                </div>
              )
            )}

            {/* Caixa de Dica de Resolução */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: 'rgba(255, 215, 0, 0.08)',
              border: '1px solid rgba(255, 215, 0, 0.25)',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              color: '#FDE047'
            }}>
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Dica de Proporção:</strong> Para o visual perfeito sem cortes no app, use banners horizontais em <strong>16:9</strong> (ex: <strong>1280×720</strong> ou <strong>1920×1080</strong>).
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={isAdding}
              style={{
                borderRadius: '12px',
                padding: '14px',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} />
              <span>{isAdding ? 'Adicionando ao Carrossel...' : 'Adicionar ao Carrossel do App'}</span>
            </button>
          </form>

        </div>

        {/* Simulador Real-Time do Carrossel do App (Android) */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
              <Smartphone size={18} style={{ color: 'var(--accent)' }} />
              <span>Pré-visualização no Aplicativo (Carrossel)</span>
            </div>
            <span className="badge badge-muted" style={{ fontSize: '0.72rem' }}>16:9 Oficial</span>
          </div>

          {/* Card do Carrossel */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '240px',
            borderRadius: '18px',
            overflow: 'hidden',
            backgroundColor: '#161326',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
            border: '1px solid var(--surface-border-bright)'
          }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Banner Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: '10px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <ImageIcon size={40} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '0.85rem' }}>A imagem do banner aparecerá aqui em tempo real</span>
              </div>
            )}

            {/* Gradiente Escuro Cinematográfico */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)'
            }} />

            {/* Conteúdo Sobreposto */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {/* Badge da Categoria */}
              <span style={{
                alignSelf: 'flex-start',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: activeTab === 'catalog' ? (contentType === 'tv' ? '#FBBF24' : '#00D4FF') : '#34D399',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '3px 8px',
                borderRadius: '6px',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {activeTab === 'catalog' ? (contentType === 'tv' ? 'Série em Destaque' : 'Filme em Destaque') : 'Patrocinado • Anúncio'}
              </span>

              {/* Título */}
              <div style={{
                fontWeight: 800,
                fontSize: '1.25rem',
                color: 'white',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {title || 'Título do Destaque ou Produto'}
              </div>

              {/* Botão do Carrossel */}
              <div style={{ marginTop: '4px' }}>
                <div style={{
                  background: activeTab === 'catalog' ? 'linear-gradient(135deg, #7B2FF7 0%, #9B51E0 100%)' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '7px 15px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}>
                  {activeTab === 'catalog' ? (
                    <>
                      <Play size={13} fill="white" />
                      <span>Assistir Agora</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink size={13} />
                      <span>Acessar Produto</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bolinhas Indicadoras (Dots) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          </div>

          {/* Legenda Informativa */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--surface-border)', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            💡 Este simulador reflete exatamente como os usuários visualizarão o banner no smartphone Android dentro do app PoltroPlay.
          </div>
        </div>

      </div>

      {/* Lista de Promoções e Destaques Cadastrados */}
      <div className="glass-card" style={{ padding: '24px' }}>
        
        {/* Cabeçalho da Lista + Filtros */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              Destaques e Anúncios Cadastrados ({filteredPromotions.length})
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Destaques com status <strong>Ativo</strong> aparecem no topo da página inicial do aplicativo.
            </p>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'catalog', label: 'Filmes e Séries' },
              { id: 'product', label: 'Produtos e Links' },
              { id: 'active', label: 'Apenas Ativos' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  transition: 'all 0.15s',
                  background: filterType === f.id ? 'var(--accent)' : 'var(--surface-light)',
                  borderColor: filterType === f.id ? 'var(--accent)' : 'var(--surface-border)',
                  color: filterType === f.id ? '#0B0A10' : 'var(--text-secondary)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Itens */}
        {filteredPromotions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Layers size={40} style={{ opacity: 0.3 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>Nenhum destaque encontrado</p>
              <span style={{ fontSize: '0.82rem' }}>Adicione filmes, séries ou produtos no formulário acima para exibi-los no carrossel.</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredPromotions.map(promo => {
              const isCatalog = Boolean(promo.contentId || promo.type === 'movie' || promo.type === 'series');
              const isTv = promo.contentType === 'tv' || promo.type === 'series';

              return (
                <div
                  key={promo.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    background: 'var(--surface-light)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: `1px solid ${promo.isActive ? 'rgba(0, 212, 255, 0.3)' : 'var(--surface-border)'}`,
                    transition: 'all 0.2s',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Miniatura 16:9 */}
                  <div style={{ position: 'relative', width: '160px', height: '90px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#161326' }}>
                    <img
                      src={promo.imageUrl}
                      alt={promo.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: promo.isActive ? 1 : 0.4,
                        transition: 'opacity 0.2s'
                      }}
                      onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800'; }}
                    />
                    {!promo.isActive && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)'
                      }}>
                        Pausado
                      </div>
                    )}
                  </div>

                  {/* Detalhes */}
                  <div style={{ flex: 1, minWidth: '220px', opacity: promo.isActive ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {/* Badge de Tipo */}
                      {isCatalog ? (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: isTv ? 'rgba(251, 191, 36, 0.15)' : 'rgba(123, 47, 247, 0.15)',
                          color: isTv ? '#FBBF24' : '#A78BFA',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isTv ? <Tv size={12} /> : <Film size={12} />}
                          <span>{isTv ? 'Série' : 'Filme'}</span>
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34D399',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <ShoppingBag size={12} />
                          <span>Produto / Anúncio</span>
                        </span>
                      )}

                      {/* Badge de Status */}
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: promo.isActive ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                        color: promo.isActive ? 'var(--accent)' : 'var(--text-muted)'
                      }}>
                        {promo.isActive ? '● Ativo no App' : '○ Inativo'}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: 'white' }}>
                      {promo.title}
                    </h4>

                    {/* Destino */}
                    {isCatalog && promo.contentId ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Play size={13} style={{ color: 'var(--accent)' }} />
                        <span>Abre direto os detalhes de {isTv ? 'Série' : 'Filme'} (ID: {promo.contentId})</span>
                      </div>
                    ) : promo.targetUrl ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LinkIcon size={13} />
                        <a 
                          href={promo.targetUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ color: 'var(--accent)', textDecoration: 'none', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {promo.targetUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => toggleStatus(promo.id, promo.isActive)}
                      className="btn-secondary"
                      style={{
                        padding: '9px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        borderRadius: '10px',
                        borderColor: promo.isActive ? 'rgba(0, 212, 255, 0.4)' : 'var(--surface-border)',
                        color: promo.isActive ? 'var(--accent)' : 'var(--text-muted)'
                      }}
                      title={promo.isActive ? 'Pausar exibição deste destaque' : 'Ativar exibição deste destaque no app'}
                    >
                      <Power size={15} />
                      <span>{promo.isActive ? 'Pausar' : 'Ativar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPromoToDelete(promo)}
                      style={{
                        padding: '9px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#EF4444',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      title="Excluir destaque permanentemente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modal de Confirmação de Exclusão */}
      {promoToDelete && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', zIndex: 9999
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px',
            maxWidth: '420px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: '54px', height: '54px', borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Trash2 size={26} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>
                Remover Destaque?
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                Tem certeza que deseja remover o banner <strong>"{promoToDelete.title}"</strong>? Ele deixará de ser exibido imediatamente no aplicativo.
              </p>
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--surface-border)',
              display: 'flex',
              gap: '12px',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPromoToDelete(null)}
                style={{ flex: 1, padding: '10px', borderRadius: '10px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                style={{ flex: 1, padding: '10px', borderRadius: '10px' }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PromotionsAdmin;
