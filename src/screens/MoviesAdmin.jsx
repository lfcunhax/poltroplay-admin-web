import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Film, Plus, Search, Trash2, Edit2, Star, 
  ChevronLeft, ChevronRight, RefreshCw, X, Play, ExternalLink,
  Image as ImageIcon, AlertTriangle, CheckCircle2
} from 'lucide-react';

const SERIES_API_URL = 'https://series.leflow.com.br';
const ADMIN_SECRET = 'poltroplay_admin_2026';
const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';
const PAGE_SIZE = 20;

function MoviesAdmin() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalMovies, setTotalMovies] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro de capa: 'all' | 'withoutCover'
  const [filterCover, setFilterCover] = useState('all');

  // Modal Novo Filme
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tmdbIdInput, setTmdbIdInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [tmdbPreview, setTmdbPreview] = useState(null);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Alterar / Vincular Capa via TMDB
  const [coverModalMovie, setCoverModalMovie] = useState(null);
  const [coverTmdbIdInput, setCoverTmdbIdInput] = useState('');
  const [coverSearchTitle, setCoverSearchTitle] = useState('');
  const [coverSearchResults, setCoverSearchResults] = useState([]);
  const [coverPreview, setCoverPreview] = useState(null);
  const [customPosterUrl, setCustomPosterUrl] = useState('');
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);

  useEffect(() => {
    fetchMovies(1, searchTerm, filterCover);
  }, [filterCover]);

  const fetchMovies = async (page = 1, search = '', coverMode = filterCover) => {
    setLoading(true);
    try {
      let url = `${SERIES_API_URL}/movies?page=${page}&limit=${PAGE_SIZE}`;
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      if (coverMode === 'withoutCover') {
        url += '&withoutCover=true';
      }
      const res = await axios.get(url);
      const data = res.data || {};
      setMovies(data.movies || []);
      setTotalMovies(data.total || 0);
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Erro ao buscar filmes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMovies(1, searchTerm, filterCover);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o filme "${title}" do PostgreSQL?`)) {
      return;
    }

    try {
      await axios.delete(`${SERIES_API_URL}/movies/${id}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      alert(`Filme "${title}" removido com sucesso.`);
      fetchMovies(currentPage, searchTerm, filterCover);
    } catch (err) {
      console.error("Erro ao deletar filme:", err);
      alert("Erro ao excluir filme: " + err.message);
    }
  };

  // --- BUSCA TMDB PARA NOVO FILME ---
  const searchTmdb = async () => {
    if (!tmdbIdInput.trim()) return;
    setIsSearchingTmdb(true);
    setTmdbPreview(null);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbIdInput.trim()}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setTmdbPreview(res.data);
    } catch (err) {
      alert("Filme não encontrado no TMDB com este ID.");
    } finally {
      setIsSearchingTmdb(false);
    }
  };

  const handleSaveNewMovie = async () => {
    if (!tmdbPreview) return;
    if (!videoUrlInput.trim()) {
      alert("Informe o link de reprodução (URL do vídeo)!");
      return;
    }

    setIsSaving(true);
    try {
      const genreNames = (tmdbPreview.genres || []).map(g => g.name);
      await axios.post(`${SERIES_API_URL}/movies`, {
        tmdbId: tmdbPreview.id,
        title: tmdbPreview.title,
        overview: tmdbPreview.overview || '',
        posterPath: tmdbPreview.poster_path || null,
        backdropPath: tmdbPreview.backdrop_path || null,
        voteAverage: tmdbPreview.vote_average || 0,
        releaseDate: tmdbPreview.release_date || null,
        videoUrl: videoUrlInput.trim(),
        tags: genreNames,
        isHighlight: false
      }, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      alert(`Filme "${tmdbPreview.title}" adicionado com sucesso ao PostgreSQL!`);
      setIsAddModalOpen(false);
      setTmdbIdInput('');
      setVideoUrlInput('');
      setTmdbPreview(null);
      fetchMovies(1, '', filterCover);
    } catch (err) {
      alert("Erro ao salvar filme: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // --- MODAL DE ALTERAR / VINCULAR CAPA DO FILME ---
  const handleOpenCoverModal = (m) => {
    setCoverModalMovie(m);
    setCoverTmdbIdInput(m.tmdb_id ? String(m.tmdb_id) : '');
    setCoverSearchTitle(m.title || '');
    setCoverSearchResults([]);
    setCustomPosterUrl(m.poster_path && m.poster_path.startsWith('http') ? m.poster_path : '');
    setCoverPreview(m.poster_path ? {
      title: m.title,
      id: m.tmdb_id,
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path,
      overview: m.overview,
      vote_average: m.vote_average,
      release_date: m.release_date
    } : null);
  };

  const handleSearchCoverById = async () => {
    if (!coverTmdbIdInput.trim()) return;
    setIsSearchingCover(true);
    setCoverSearchResults([]);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/movie/${coverTmdbIdInput.trim()}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setCoverPreview(res.data);
    } catch (err) {
      alert("Filme não encontrado no TMDB com o ID informado.");
    } finally {
      setIsSearchingCover(false);
    }
  };

  const handleSearchCoverByTitle = async () => {
    if (!coverSearchTitle.trim()) return;
    setIsSearchingCover(true);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(coverSearchTitle.trim())}`);
      const results = res.data?.results || [];
      if (results.length === 0) {
        alert("Nenhum resultado encontrado no TMDB para esse título.");
      }
      setCoverSearchResults(results.slice(0, 6));
    } catch (err) {
      alert("Erro ao buscar no TMDB: " + err.message);
    } finally {
      setIsSearchingCover(false);
    }
  };

  const handleSelectCoverResult = (item) => {
    setCoverPreview(item);
    setCoverTmdbIdInput(String(item.id));
    setCoverSearchResults([]);
  };

  const handleSaveCover = async () => {
    if (!coverModalMovie) return;
    setIsSavingCover(true);

    try {
      let payload = {};

      if (coverPreview) {
        payload = {
          tmdbId: coverPreview.id || null,
          posterPath: coverPreview.poster_path || null,
          backdropPath: coverPreview.backdrop_path || null,
          overview: coverPreview.overview || coverModalMovie.overview || '',
          voteAverage: coverPreview.vote_average || coverModalMovie.vote_average || 0,
          releaseDate: coverPreview.release_date || coverModalMovie.release_date || null
        };
      } else if (customPosterUrl.trim()) {
        payload = {
          posterPath: customPosterUrl.trim()
        };
      } else {
        alert("Selecione uma capa do TMDB ou insira uma URL de imagem!");
        setIsSavingCover(false);
        return;
      }

      await axios.patch(`${SERIES_API_URL}/movies/${coverModalMovie.id}`, payload, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      alert(`Capa do filme "${coverModalMovie.title}" atualizada com sucesso!`);
      setCoverModalMovie(null);
      setCoverPreview(null);
      fetchMovies(currentPage, searchTerm, filterCover);
    } catch (err) {
      console.error("Erro ao salvar capa:", err);
      alert("Erro ao atualizar capa: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingCover(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Filmes Manuais
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Gerencie o catálogo de filmes hospedado no banco PostgreSQL de alta performance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={() => fetchMovies(currentPage, searchTerm, filterCover)} 
            disabled={loading}
            style={{ borderRadius: '12px' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setIsAddModalOpen(true)}
            style={{ borderRadius: '12px' }}
          >
            <Plus size={18} />
            Novo Filme
          </button>
        </div>
      </div>

      {/* Barra de Filtros, Seletor "Sem Capa" e Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(0, 212, 255, 0.15)', color: 'var(--accent)' }}>
            <Film size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalMovies}</div>
            <div className="stat-label">
              {filterCover === 'withoutCover' ? 'Filmes Sem Capa' : 'Total de Filmes no PostgreSQL'}
            </div>
          </div>
        </div>

        {/* Seletor Rápido de Filtros: Todos vs Sem Capa */}
        <div className="glass-card" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterCover('all')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: filterCover === 'all' ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
              color: filterCover === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
              border: filterCover === 'all' ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Film size={16} />
            Todos os Filmes
          </button>

          <button
            type="button"
            onClick={() => setFilterCover('withoutCover')}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: filterCover === 'withoutCover' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
              color: filterCover === 'withoutCover' ? '#F87171' : 'var(--text-secondary)',
              border: filterCover === 'withoutCover' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <AlertTriangle size={16} />
            Sem Capa ⚠️
          </button>
        </div>

        {/* Busca por Título */}
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar filme por título..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '44px', borderRadius: '10px' }}
              />
            </div>
            <button type="submit" className="btn-secondary" style={{ padding: '10px 18px', borderRadius: '10px' }}>
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* Tabela de Filmes com Bordas Suaves */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div className="status-dot-online" style={{ margin: '0 auto 16px' }}></div>
          Carregando filmes do PostgreSQL...
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Poster & Título</th>
                <th>Tags / Gêneros</th>
                <th>Nota</th>
                <th>Link de Reprodução</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {movies.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {filterCover === 'withoutCover' 
                      ? 'Nenhum filme sem capa encontrado! Todos possuem pôster configurado.' 
                      : 'Nenhum filme encontrado.'}
                  </td>
                </tr>
              ) : (
                movies.map(m => {
                  const hasPoster = Boolean(m.poster_path && m.poster_path.trim());
                  const posterUrl = hasPoster 
                    ? (m.poster_path.startsWith('http') ? m.poster_path : `https://image.tmdb.org/t/p/w200${m.poster_path}`)
                    : null;

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {posterUrl ? (
                            <img 
                              src={posterUrl} 
                              alt={m.title} 
                              style={{ width: '44px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                            />
                          ) : (
                            <div style={{ 
                              width: '44px', 
                              height: '64px', 
                              borderRadius: '8px', 
                              background: 'rgba(239, 68, 68, 0.1)', 
                              border: '1px dashed rgba(239, 68, 68, 0.4)',
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: '#F87171' 
                            }}>
                              <AlertTriangle size={18} />
                              <span style={{ fontSize: '9px', fontWeight: 700, marginTop: '2px' }}>SEM CAPA</span>
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                {m.title}
                              </span>
                              {!hasPoster && (
                                <span style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: 700
                                }}>
                                  SEM CAPA
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              ID: {m.id} | TMDB: {m.tmdb_id || 'Não vinculado'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '220px' }}>
                          {(m.tags || []).slice(0, 3).map((tag, tIdx) => (
                            <span key={tIdx} className="badge badge-muted" style={{ fontSize: '0.7rem' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontWeight: 600 }}>
                          <Star size={14} fill="#FBBF24" />
                          <span>{m.vote_average ? Number(m.vote_average).toFixed(1) : '0.0'}</span>
                        </div>
                      </td>

                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {m.video_url}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenCoverModal(m)}
                            style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.8rem', 
                              borderRadius: '8px',
                              background: !hasPoster ? 'rgba(239, 68, 68, 0.12)' : undefined,
                              borderColor: !hasPoster ? 'rgba(239, 68, 68, 0.4)' : undefined,
                              color: !hasPoster ? '#F87171' : undefined
                            }}
                            title="Vincular TMDb ou Colocar Capa"
                          >
                            <ImageIcon size={14} />
                            {!hasPoster ? 'Adicionar Capa' : 'Capa / TMDb'}
                          </button>

                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(m.id, m.title)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                            title="Excluir Filme"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Paginação */}
          <div className="pagination-container" style={{ borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
            <div className="pagination-info">
              Página <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({totalMovies} filmes {filterCover === 'withoutCover' ? 'sem capa' : 'no total'})
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => fetchMovies(currentPage - 1, searchTerm, filterCover)}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="pagination-btn"
                onClick={() => fetchMovies(currentPage + 1, searchTerm, filterCover)}
                disabled={currentPage >= totalPages || loading}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VINCULAR TMDB / ALTERAR CAPA DO FILME                              */}
      {/* ========================================================================= */}
      {coverModalMovie && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '580px', width: '100%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>
                  Vincular TMDB / Alterar Capa
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Filme: <strong>{coverModalMovie.title}</strong> (ID #{coverModalMovie.id})
                </span>
              </div>
              <button onClick={() => setCoverModalMovie(null)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Opção 1: Digitar ID direto do TMDB */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Buscar por ID do TMDB (TheMovieDB):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Ex: 550 (Clube da Luta)"
                    value={coverTmdbIdInput}
                    onChange={(e) => setCoverTmdbIdInput(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={handleSearchCoverById}
                    disabled={isSearchingCover}
                    style={{ borderRadius: '10px', whiteSpace: 'nowrap' }}
                  >
                    {isSearchingCover ? 'Buscando...' : 'Buscar ID'}
                  </button>
                </div>
              </div>

              {/* Opção 2: Buscar pelo Nome do Filme no TMDB */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Ou buscar por Nome no TMDB:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Ex: Nome do filme"
                    value={coverSearchTitle}
                    onChange={(e) => setCoverSearchTitle(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={handleSearchCoverByTitle}
                    disabled={isSearchingCover}
                    style={{ borderRadius: '10px', whiteSpace: 'nowrap' }}
                  >
                    Buscar Título
                  </button>
                </div>
              </div>

              {/* Resultados da busca por nome */}
              {coverSearchResults.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Selecione o filme correspondente:
                  </div>
                  {coverSearchResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCoverResult(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px',
                        borderRadius: '8px',
                        background: coverPreview?.id === item.id ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: coverPreview?.id === item.id ? '1px solid var(--accent)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      {item.poster_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} 
                          alt={item.title} 
                          style={{ width: '32px', height: '46px', borderRadius: '4px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '32px', height: '46px', borderRadius: '4px', background: 'var(--surface-light)' }} />
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white' }}>{item.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {item.id} | Lançamento: {item.release_date || 'N/A'} | Nota: {item.vote_average}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview da Capa Selecionada */}
              {coverPreview && (
                <div style={{
                  background: 'rgba(0, 212, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  gap: '16px'
                }}>
                  {coverPreview.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w200${coverPreview.poster_path}`} 
                      alt="Capa Selecionada" 
                      style={{ width: '80px', height: '120px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                    />
                  ) : (
                    <div style={{ width: '80px', height: '120px', borderRadius: '8px', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Film size={24} color="var(--text-muted)" />
                    </div>
                  )}

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="var(--accent)" />
                      <strong style={{ fontSize: '0.95rem', color: 'white' }}>{coverPreview.title || coverPreview.name}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ID TMDB: <strong>{coverPreview.id}</strong> | Nota: {coverPreview.vote_average || 'N/A'}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {coverPreview.overview || 'Sem sinopse.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Opção 3: Inserir URL Direta de Imagem Customizada */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Ou colar URL direta da imagem da capa:
                </label>
                <input
                  type="url"
                  placeholder="https://exemplo.com/poster.jpg"
                  value={customPosterUrl}
                  onChange={(e) => setCustomPosterUrl(e.target.value)}
                  style={{ borderRadius: '10px' }}
                />
              </div>

            </div>

            {/* Rodapé */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn-secondary" onClick={() => setCoverModalMovie(null)} style={{ borderRadius: '10px' }}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveCover} 
                disabled={(!coverPreview && !customPosterUrl.trim()) || isSavingCover}
                style={{ borderRadius: '10px' }}
              >
                {isSavingCover ? 'Salvando Capa...' : 'Salvar Capa no PostgreSQL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Filme via TMDB */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '520px', width: '100%',
            overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Adicionar Filme Manual</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ID do Filme no TMDB (TheMovieDB):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Ex: 550"
                    value={tmdbIdInput}
                    onChange={(e) => setTmdbIdInput(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={searchTmdb}
                    disabled={isSearchingTmdb}
                    style={{ borderRadius: '10px' }}
                  >
                    {isSearchingTmdb ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              {tmdbPreview && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  gap: '14px'
                }}>
                  {tmdbPreview.poster_path && (
                    <img 
                      src={`https://image.tmdb.org/t/p/w200${tmdbPreview.poster_path}`} 
                      alt="Capa" 
                      style={{ width: '60px', height: '90px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>{tmdbPreview.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Lançamento: {tmdbPreview.release_date} • Nota: {tmdbPreview.vote_average}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', maxHeight: '50px', overflow: 'hidden' }}>
                      {tmdbPreview.overview || 'Sem sinopse disponível.'}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Link de Reprodução (URL do Vídeo MP4/HLS):
                </label>
                <input
                  type="url"
                  placeholder="https://servidor.com/video.mp4"
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  style={{ borderRadius: '10px' }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)} style={{ borderRadius: '10px' }}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveNewMovie} 
                disabled={!tmdbPreview || isSaving}
                style={{ borderRadius: '10px' }}
              >
                {isSaving ? 'Salvando...' : 'Salvar no PostgreSQL'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default MoviesAdmin;
