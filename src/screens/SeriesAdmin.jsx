import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Tv, Plus, Search, Trash2, Edit2, PlayCircle, Star, 
  ChevronLeft, ChevronRight, RefreshCw, X, Layers, ExternalLink 
} from 'lucide-react';

const SERIES_API_URL = 'https://series.leflow.com.br';
const ADMIN_SECRET = 'poltroplay_admin_2026';
const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';
const PAGE_SIZE = 20;

function SeriesAdmin() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSeries, setTotalSeries] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Episódios Modal
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Nova Série Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tmdbIdInput, setTmdbIdInput] = useState('');
  const [tmdbPreview, setTmdbPreview] = useState(null);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSeries(1, searchTerm);
  }, []);

  const fetchSeries = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const url = `${SERIES_API_URL}/series?page=${page}&limit=${PAGE_SIZE}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`;
      const res = await axios.get(url);
      const data = res.data || {};
      setSeries(data.series || []);
      setTotalSeries(data.total || 0);
      setCurrentPage(data.page || 1);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("Erro ao buscar séries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSeries(1, searchTerm);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente a série "${title}" do PostgreSQL?\nIsso também removerá todos os seus episódios.`)) {
      return;
    }

    try {
      await axios.delete(`${SERIES_API_URL}/series/${id}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      alert(`Série "${title}" removida com sucesso.`);
      fetchSeries(currentPage, searchTerm);
    } catch (err) {
      console.error("Erro ao deletar série:", err);
      alert("Erro ao excluir série: " + err.message);
    }
  };

  const handleViewEpisodes = async (s) => {
    setSelectedSeries(s);
    setLoadingEpisodes(true);
    setEpisodes([]);
    try {
      const res = await axios.get(`${SERIES_API_URL}/series/${s.id}/episodes`);
      setEpisodes(res.data || []);
    } catch (err) {
      console.error("Erro ao buscar episódios:", err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const searchTmdb = async () => {
    if (!tmdbIdInput.trim()) return;
    setIsSearchingTmdb(true);
    setTmdbPreview(null);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbIdInput.trim()}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setTmdbPreview(res.data);
    } catch (err) {
      alert("Série não encontrada no TMDB com este ID.");
    } finally {
      setIsSearchingTmdb(false);
    }
  };

  const handleSaveNewSeries = async () => {
    if (!tmdbPreview) return;
    setIsSaving(true);
    try {
      const genreNames = (tmdbPreview.genres || []).map(g => g.name);
      await axios.post(`${SERIES_API_URL}/series`, {
        tmdbId: tmdbPreview.id,
        title: tmdbPreview.name,
        overview: tmdbPreview.overview || '',
        posterPath: tmdbPreview.poster_path || null,
        backdropPath: tmdbPreview.backdrop_path || null,
        voteAverage: tmdbPreview.vote_average || 0,
        releaseDate: tmdbPreview.first_air_date || null,
        tags: genreNames,
        isHighlight: false
      }, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      alert(`Série "${tmdbPreview.name}" adicionada com sucesso!`);
      setIsAddModalOpen(false);
      setTmdbIdInput('');
      setTmdbPreview(null);
      fetchSeries(1, '');
    } catch (err) {
      alert("Erro ao salvar série: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Gerenciar Séries
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Séries e episódios hospedados no banco PostgreSQL de alta performance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            onClick={() => fetchSeries(currentPage, searchTerm)} 
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
            Nova Série
          </button>
        </div>
      </div>

      {/* Barra de Filtro e Estatística */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(123, 47, 247, 0.15)', color: 'var(--primary-light)' }}>
            <Tv size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{totalSeries}</div>
            <div className="stat-label">Total no PostgreSQL</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '100%', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar série por título..."
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

      {/* Tabela de Séries com Bordas Suaves */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div className="status-dot-online" style={{ margin: '0 auto 16px' }}></div>
          Carregando séries do PostgreSQL...
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Poster & Título</th>
                <th>Tags / Gêneros</th>
                <th>Nota TMDB</th>
                <th>Lançamento</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {series.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Nenhuma série encontrada.
                  </td>
                </tr>
              ) : (
                series.map(s => {
                  const posterUrl = s.poster_path 
                    ? (s.poster_path.startsWith('http') ? s.poster_path : `https://image.tmdb.org/t/p/w200${s.poster_path}`)
                    : null;

                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {posterUrl ? (
                            <img 
                              src={posterUrl} 
                              alt={s.title} 
                              style={{ width: '42px', height: '62px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--surface-border)' }}
                            />
                          ) : (
                            <div style={{ width: '42px', height: '62px', borderRadius: '8px', background: 'var(--surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                              <Tv size={20} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {s.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ID: {s.id} | TMDB: {s.tmdb_id || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                          {(s.tags || []).slice(0, 3).map((tag, tIdx) => (
                            <span key={tIdx} className="badge badge-muted" style={{ fontSize: '0.7rem' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontWeight: 600 }}>
                          <Star size={14} fill="#FBBF24" />
                          <span>{s.vote_average ? Number(s.vote_average).toFixed(1) : '0.0'}</span>
                        </div>
                      </td>

                      <td>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {s.release_date || 'N/A'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn-secondary"
                            onClick={() => handleViewEpisodes(s)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                            title="Ver Episódios Cadastrados"
                          >
                            <PlayCircle size={14} />
                            Episódios
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(s.id, s.title)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                            title="Excluir Série"
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
              Página <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({totalSeries} séries no total)
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => fetchSeries(currentPage - 1, searchTerm)}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="pagination-btn"
                onClick={() => fetchSeries(currentPage + 1, searchTerm)}
                disabled={currentPage >= totalPages || loading}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Episódios */}
      {selectedSeries && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '720px', width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{selectedSeries.title}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Episódios cadastrados no PostgreSQL</span>
              </div>
              <button onClick={() => setSelectedSeries(null)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {loadingEpisodes ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Carregando lista de episódios...
                </div>
              ) : episodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Nenhum episódio cadastrado para esta série ainda.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {episodes.map(ep => (
                    <div key={ep.id} style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '10px',
                      padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--accent)', fontSize: '0.88rem' }}>
                          Temporada {ep.season_number} - Episódio {ep.episode_number}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.title || 'Sem título'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                        {ep.video_url}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Total: <strong style={{ color: 'white' }}>{episodes.length}</strong> episódios
              </span>
              <button className="btn-secondary" onClick={() => setSelectedSeries(null)} style={{ padding: '8px 20px', borderRadius: '10px' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Série via TMDB */}
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Adicionar Série Manual</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ID da Série no TMDB (TheMovieDB):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Ex: 82951"
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
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>{tmdbPreview.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Estreia: {tmdbPreview.first_air_date} • Nota: {tmdbPreview.vote_average}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', maxHeight: '50px', overflow: 'hidden' }}>
                      {tmdbPreview.overview || 'Sem sinopse disponível.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn-secondary" onClick={() => setIsAddModalOpen(false)} style={{ borderRadius: '10px' }}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveNewSeries} 
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

export default SeriesAdmin;
