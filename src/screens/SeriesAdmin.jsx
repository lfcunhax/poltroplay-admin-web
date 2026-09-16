import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Tv, Plus, Search, Trash2, Edit2, PlayCircle, Star, 
  ChevronLeft, ChevronRight, RefreshCw, X, Layers, ExternalLink,
  Image as ImageIcon, AlertTriangle, CheckCircle2, Link as LinkIcon,
  Sparkles, ShieldAlert, Film
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

  // Filtro de capa: 'all' | 'withoutCover'
  const [filterCover, setFilterCover] = useState('all');
  const [missingCoverCount, setMissingCoverCount] = useState(null);

  // Episódios Modal
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [tmdbSeasonCounts, setTmdbSeasonCounts] = useState({});
  const [newEpSeason, setNewEpSeason] = useState(1);
  const [newEpNum, setNewEpNum] = useState('');
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpUrl, setNewEpUrl] = useState('');
  const [isAddingEp, setIsAddingEp] = useState(false);
  const [showAddEpForm, setShowAddEpForm] = useState(false);

  // Nova Série Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tmdbIdInput, setTmdbIdInput] = useState('');
  const [tmdbPreview, setTmdbPreview] = useState(null);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Alterar / Vincular Capa via TMDB
  const [coverModalSeries, setCoverModalSeries] = useState(null);
  const [coverTmdbIdInput, setCoverTmdbIdInput] = useState('');
  const [coverSearchTitle, setCoverSearchTitle] = useState('');
  const [coverSearchResults, setCoverSearchResults] = useState([]);
  const [coverPreview, setCoverPreview] = useState(null);
  const [customPosterUrl, setCustomPosterUrl] = useState('');
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);

  // Modal de Auditoria de Episódios em Falta
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResults, setAuditResults] = useState([]);

  useEffect(() => {
    fetchMissingCount();
    fetchSeries(1, searchTerm, filterCover);
  }, []);

  const fetchMissingCount = async () => {
    try {
      const res = await axios.get(`${SERIES_API_URL}/series?limit=1000`);
      const all = res.data?.series || [];
      const count = all.filter(s => !s.poster_path || !s.poster_path.trim()).length;
      setMissingCoverCount(count);
    } catch (_) {}
  };

  const fetchSeries = async (page = 1, search = '', coverMode = filterCover) => {
    setLoading(true);
    try {
      if (coverMode === 'withoutCover') {
        // Busca lote completo para garantir filtragem precisa no cliente mesmo antes do redeploy do backend
        let url = `${SERIES_API_URL}/series?limit=1000&withoutCover=true`;
        if (search.trim()) {
          url += `&search=${encodeURIComponent(search.trim())}`;
        }
        const res = await axios.get(url);
        const allFetched = res.data?.series || [];
        // FILTRAGEM ESTRITA: Apenas séries que realmente NÃO têm poster
        const withoutCoverList = allFetched.filter(s => !s.poster_path || !s.poster_path.trim());
        
        setSeries(withoutCoverList);
        setTotalSeries(withoutCoverList.length);
        setMissingCoverCount(withoutCoverList.length);
        setCurrentPage(page);
        setTotalPages(Math.max(1, Math.ceil(withoutCoverList.length / PAGE_SIZE)));
      } else {
        let url = `${SERIES_API_URL}/series?page=${page}&limit=${PAGE_SIZE}`;
        if (search.trim()) {
          url += `&search=${encodeURIComponent(search.trim())}`;
        }
        const res = await axios.get(url);
        const data = res.data || {};
        setSeries(data.series || []);
        setTotalSeries(data.total || 0);
        setCurrentPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Erro ao buscar séries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchFilterCover = (mode) => {
    setFilterCover(mode);
    setCurrentPage(1);
    fetchSeries(1, searchTerm, mode);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (filterCover === 'withoutCover') {
      setCurrentPage(newPage);
    } else {
      fetchSeries(newPage, searchTerm, 'all');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSeries(1, searchTerm, filterCover);
  };

  // Garante que a lista renderizada seja rigorosamente filtrada
  const displayedSeries = useMemo(() => {
    if (filterCover === 'withoutCover') {
      const strictlyWithout = series.filter(s => !s.poster_path || !s.poster_path.trim());
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      return strictlyWithout.slice(startIndex, startIndex + PAGE_SIZE);
    }
    return series;
  }, [series, filterCover, currentPage]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente a série "${title}" do PostgreSQL?\nIsso também removerá todos os seus episódios.`)) {
      return;
    }

    try {
      await axios.delete(`${SERIES_API_URL}/series/${id}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      alert(`Série "${title}" removida com sucesso.`);
      fetchSeries(currentPage, searchTerm, filterCover);
    } catch (err) {
      console.error("Erro ao deletar série:", err);
      alert("Erro ao excluir série: " + err.message);
    }
  };

  // --- GERENCIAMENTO DE EPISÓDIOS ---
  const handleViewEpisodes = async (s) => {
    setSelectedSeries(s);
    setLoadingEpisodes(true);
    setEpisodes([]);
    setTmdbSeasonCounts({});
    setShowAddEpForm(false);
    setNewEpUrl('');
    setNewEpNum('');
    setNewEpTitle('');
    try {
      const res = await axios.get(`${SERIES_API_URL}/series/${s.id}/episodes`);
      const fetchedEps = res.data || [];
      setEpisodes(fetchedEps);

      // Se a série tem TMDB ID, busca quantidade de episódios por temporada no TMDB
      if (s.tmdb_id) {
        try {
          const tmdbRes = await axios.get(`https://api.themoviedb.org/3/tv/${s.tmdb_id}?api_key=${TMDB_API_KEY}&language=pt-BR`);
          const seasons = tmdbRes.data?.seasons || [];
          const counts = {};
          seasons.forEach(sn => {
            if (sn.season_number > 0) {
              counts[sn.season_number] = sn.episode_count || 0;
            }
          });
          setTmdbSeasonCounts(counts);
        } catch (_) {}
      }
    } catch (err) {
      console.error("Erro ao buscar episódios:", err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  // Salvar novo episódio avulso
  const handleSaveSingleEpisode = async (e) => {
    e?.preventDefault();
    if (!selectedSeries || !newEpUrl.trim() || !newEpNum) {
      alert("Informe o número do episódio e o link do vídeo!");
      return;
    }

    setIsAddingEp(true);
    try {
      await axios.post(`${SERIES_API_URL}/series/${selectedSeries.id}/episodes`, {
        seasonNumber: Number(newEpSeason),
        episodeNumber: Number(newEpNum),
        title: newEpTitle.trim() || `Episódio ${newEpNum}`,
        videoUrl: newEpUrl.trim()
      }, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });

      alert(`Episódio ${newEpNum} da Temporada ${newEpSeason} salvo com sucesso!`);
      setNewEpUrl('');
      setNewEpTitle('');
      setNewEpNum('');
      setShowAddEpForm(false);
      
      // Recarrega episódios
      const res = await axios.get(`${SERIES_API_URL}/series/${selectedSeries.id}/episodes`);
      setEpisodes(res.data || []);
    } catch (err) {
      alert("Erro ao salvar episódio: " + (err.response?.data?.error || err.message));
    } finally {
      setIsAddingEp(false);
    }
  };

  // Deletar episódio individual
  const handleDeleteEpisode = async (epId, sNum, eNum) => {
    if (!window.confirm(`Excluir o Episódio ${eNum} da Temporada ${sNum}?`)) return;
    try {
      await axios.delete(`${SERIES_API_URL}/series/${selectedSeries.id}/episodes/${epId}`, {
        headers: { 'x-admin-secret': ADMIN_SECRET }
      });
      setEpisodes(prev => prev.filter(ep => ep.id !== epId));
    } catch (err) {
      alert("Erro ao excluir episódio: " + err.message);
    }
  };

  // Análise de temporadas e detecção de lacunas/episódios em falta
  const seasonAnalysis = useMemo(() => {
    if (!episodes || episodes.length === 0) return [];

    const seasonsMap = {};
    episodes.forEach(ep => {
      const sNum = ep.season_number || 1;
      if (!seasonsMap[sNum]) {
        seasonsMap[sNum] = [];
      }
      seasonsMap[sNum].push(ep);
    });

    const results = [];
    Object.keys(seasonsMap).sort((a, b) => Number(a) - Number(b)).forEach(sStr => {
      const sNum = Number(sStr);
      const sEps = seasonsMap[sNum].sort((a, b) => a.episode_number - b.episode_number);
      const existingEpNums = new Set(sEps.map(e => e.episode_number));

      // Determina o teto de episódios (máximo existente ou número informado pelo TMDB)
      const maxExisting = Math.max(...sEps.map(e => e.episode_number), 1);
      const tmdbTotal = tmdbSeasonCounts[sNum] || maxExisting;
      const expectedLimit = Math.max(maxExisting, tmdbTotal);

      // Descobre quais números de 1 até expectedLimit estão ausentes
      const missingEpNums = [];
      for (let i = 1; i <= expectedLimit; i++) {
        if (!existingEpNums.has(i)) {
          missingEpNums.push(i);
        }
      }

      results.push({
        seasonNumber: sNum,
        episodes: sEps,
        tmdbTotal: tmdbSeasonCounts[sNum] || null,
        missingEpNums
      });
    });

    return results;
  }, [episodes, tmdbSeasonCounts]);

  // --- MODAL DE ALTERAR / VINCULAR CAPA TMDB ---
  const handleOpenCoverModal = (s) => {
    setCoverModalSeries(s);
    setCoverTmdbIdInput(s.tmdb_id ? String(s.tmdb_id) : '');
    setCoverSearchTitle(s.title || '');
    setCoverSearchResults([]);
    setCustomPosterUrl(s.poster_path && s.poster_path.startsWith('http') ? s.poster_path : '');
    setCoverPreview(s.poster_path ? {
      name: s.title,
      id: s.tmdb_id,
      poster_path: s.poster_path,
      backdrop_path: s.backdrop_path,
      overview: s.overview,
      vote_average: s.vote_average,
      first_air_date: s.release_date
    } : null);
  };

  // Busca série por ID no TMDB
  const handleSearchCoverById = async () => {
    if (!coverTmdbIdInput.trim()) return;
    setIsSearchingCover(true);
    setCoverSearchResults([]);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/tv/${coverTmdbIdInput.trim()}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setCoverPreview(res.data);
    } catch (err) {
      alert("Série não encontrada no TMDB com o ID informado.");
    } finally {
      setIsSearchingCover(false);
    }
  };

  // Busca série por Nome/Título no TMDB
  const handleSearchCoverByTitle = async () => {
    if (!coverSearchTitle.trim()) return;
    setIsSearchingCover(true);
    try {
      const res = await axios.get(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(coverSearchTitle.trim())}`);
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

  // Seleciona um item da busca do TMDB
  const handleSelectCoverResult = (item) => {
    setCoverPreview(item);
    setCoverTmdbIdInput(String(item.id));
    setCoverSearchResults([]);
  };

  // Salvar a capa atualizada no PostgreSQL
  const handleSaveCover = async () => {
    if (!coverModalSeries) return;
    setIsSavingCover(true);

    try {
      let payload = {};

      if (coverPreview) {
        payload = {
          tmdbId: coverPreview.id || null,
          posterPath: coverPreview.poster_path || null,
          backdropPath: coverPreview.backdrop_path || null,
          overview: coverPreview.overview || coverModalSeries.overview || '',
          voteAverage: coverPreview.vote_average || coverModalSeries.vote_average || 0,
          releaseDate: coverPreview.first_air_date || coverModalSeries.release_date || null
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

      let updated = false;
      try {
        const patchRes = await axios.patch(`${SERIES_API_URL}/series/${coverModalSeries.id}`, payload, {
          headers: { 'x-admin-secret': ADMIN_SECRET }
        });
        if (patchRes.data?.poster_path) {
          updated = true;
        }
      } catch (patchErr) {
        console.warn("PATCH direto falhou, tentando sincronização:", patchErr.message);
      }

      // Se o backend remoto ainda não tiver reiniciado com o PATCH expandido, utiliza o /series/sync que já atualiza por ID
      if (!updated) {
        await axios.post(`${SERIES_API_URL}/series/sync`, {
          series: [{
            id: coverModalSeries.id,
            tmdbId: payload.tmdbId,
            title: coverModalSeries.title,
            overview: payload.overview,
            posterPath: payload.posterPath,
            backdropPath: payload.backdropPath,
            voteAverage: payload.voteAverage,
            releaseDate: payload.releaseDate
          }]
        }, {
          headers: { 'x-admin-secret': ADMIN_SECRET }
        });
      }

      alert(`Capa da série "${coverModalSeries.title}" atualizada com sucesso!`);
      setCoverModalSeries(null);
      setCoverPreview(null);
      setCoverSearchResults([]);
      fetchMissingCount();
      fetchSeries(currentPage, searchTerm, filterCover);
    } catch (err) {
      console.error("Erro ao salvar capa:", err);
      alert("Erro ao atualizar capa: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingCover(false);
    }
  };

  // --- AUDITORIA GERAL DE EPISÓDIOS EM FALTA ---
  const handleRunAudit = async () => {
    setIsAuditing(true);
    setAuditResults([]);
    try {
      // Busca séries da página atual ou lote de 50
      const res = await axios.get(`${SERIES_API_URL}/series?limit=60`);
      const allSeriesList = res.data?.series || [];

      const seriesWithGaps = [];
      for (const s of allSeriesList) {
        try {
          const epRes = await axios.get(`${SERIES_API_URL}/series/${s.id}/episodes`);
          const eps = epRes.data || [];
          if (eps.length === 0) continue;

          // Agrupa por temporada
          const seasons = {};
          eps.forEach(e => {
            const sn = e.season_number || 1;
            if (!seasons[sn]) seasons[sn] = new Set();
            seasons[sn].add(e.episode_number);
          });

          const gaps = [];
          Object.keys(seasons).forEach(sn => {
            const epNums = seasons[sn];
            const maxEp = Math.max(...Array.from(epNums));
            const missing = [];
            for (let i = 1; i <= maxEp; i++) {
              if (!epNums.has(i)) missing.push(i);
            }
            if (missing.length > 0) {
              gaps.push({ seasonNumber: sn, missing, totalRegistered: epNums.size, maxEp });
            }
          });

          if (gaps.length > 0) {
            seriesWithGaps.push({ series: s, gaps });
          }
        } catch (_) {}
      }

      setAuditResults(seriesWithGaps);
    } catch (err) {
      alert("Erro ao auditar episódios: " + err.message);
    } finally {
      setIsAuditing(false);
    }
  };

  // --- NOVA SÉRIE TMDB ---
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
      fetchSeries(1, '', filterCover);
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
            Séries & Episódios
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Gerencie o catálogo de séries, capas no TMDB e integridade dos episódios no PostgreSQL.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            className="btn-secondary" 
            onClick={() => { setIsAuditModalOpen(true); handleRunAudit(); }}
            style={{ borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.4)', color: '#FBBF24' }}
          >
            <AlertTriangle size={16} />
            Auditar Episódios em Falta
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => fetchSeries(currentPage, searchTerm, filterCover)} 
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

      {/* Barra de Filtros, Seletor "Sem Capa" e Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ 
            background: filterCover === 'withoutCover' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(123, 47, 247, 0.15)', 
            color: filterCover === 'withoutCover' ? '#F87171' : 'var(--primary-light)' 
          }}>
            {filterCover === 'withoutCover' ? <AlertTriangle size={24} /> : <Tv size={24} />}
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: filterCover === 'withoutCover' ? '#F87171' : undefined }}>
              {totalSeries}
            </div>
            <div className="stat-label">
              {filterCover === 'withoutCover' ? 'Séries Sem Capa (Aguardando Pôster)' : 'Total no PostgreSQL'}
            </div>
          </div>
        </div>

        {/* Seletor Rápido de Filtros: Todas vs Sem Capa */}
        <div className="glass-card" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => handleSwitchFilterCover('all')}
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
            <Tv size={16} />
            Todas as Séries
          </button>

          <button
            type="button"
            onClick={() => handleSwitchFilterCover('withoutCover')}
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
            Sem Capa ⚠️ {missingCoverCount !== null ? `(${missingCoverCount})` : ''}
          </button>
        </div>

        {/* Busca por Título */}
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
              {displayedSeries.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {filterCover === 'withoutCover' 
                      ? 'Nenhuma série sem capa encontrada! Todas possuem pôster configurado.' 
                      : 'Nenhuma série encontrada.'}
                  </td>
                </tr>
              ) : (
                displayedSeries.map(s => {
                  const hasPoster = Boolean(s.poster_path && s.poster_path.trim());
                  const posterUrl = hasPoster 
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
                                {s.title}
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
                              ID: {s.id} | TMDB: {s.tmdb_id || 'Não vinculado'}
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
                          {/* Botão para vincular / alterar capa via TMDB */}
                          <button
                            className="btn-secondary"
                            onClick={() => handleOpenCoverModal(s)}
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
                            className="btn-secondary"
                            onClick={() => handleViewEpisodes(s)}
                            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                            title="Ver Episódios Cadastrados e Lacunas"
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
              Página <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong> ({totalSeries} séries {filterCover === 'withoutCover' ? 'sem capa' : 'no total'})
            </div>

            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GERENCIADOR E DETECTOR DE EPISÓDIOS EM FALTA                      */}
      {/* ========================================================================= */}
      {selectedSeries && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '820px', width: '100%', maxHeight: '88vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Header do Modal */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
                  {selectedSeries.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ID: {selectedSeries.id} | TMDB: {selectedSeries.tmdb_id || 'Não vinculado'} | Total: {episodes.length} episódios
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  className="btn-primary"
                  onClick={() => setShowAddEpForm(!showAddEpForm)}
                  style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '8px' }}
                >
                  <Plus size={15} />
                  {showAddEpForm ? 'Ocultar Formulário' : '+ Adicionar Episódio'}
                </button>

                <button onClick={() => setSelectedSeries(null)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Formulário Retrátil para Adicionar Episódio Avulso */}
            {showAddEpForm && (
              <form onSubmit={handleSaveSingleEpisode} style={{
                background: 'rgba(0, 212, 255, 0.04)',
                borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
                padding: '16px 24px',
                display: 'grid',
                gridTemplateColumns: '100px 100px 1fr 1fr auto',
                gap: '10px',
                alignItems: 'flex-end'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Temp.</label>
                  <input
                    type="number"
                    min="1"
                    value={newEpSeason}
                    onChange={(e) => setNewEpSeason(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Episódio #</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={newEpNum}
                    onChange={(e) => setNewEpNum(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Título (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Nome do Episódio"
                    value={newEpTitle}
                    onChange={(e) => setNewEpTitle(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>URL do Vídeo (MP4/HLS)</label>
                  <input
                    type="url"
                    placeholder="https://.../video.mp4"
                    value={newEpUrl}
                    onChange={(e) => setNewEpUrl(e.target.value)}
                    style={{ padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isAddingEp}
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  {isAddingEp ? 'Salvando...' : 'Salvar Episódio'}
                </button>
              </form>
            )}

            {/* Conteúdo Principal com Detecção de Lacunas por Temporada */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {loadingEpisodes ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Carregando lista de episódios...
                </div>
              ) : episodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Tv size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Nenhum episódio cadastrado para esta série ainda.</p>
                  <button 
                    className="btn-primary" 
                    onClick={() => setShowAddEpForm(true)}
                    style={{ marginTop: '16px', borderRadius: '10px' }}
                  >
                    + Adicionar Primeiro Episódio
                  </button>
                </div>
              ) : (
                seasonAnalysis.map(sn => {
                  const hasMissing = sn.missingEpNums.length > 0;

                  return (
                    <div 
                      key={sn.seasonNumber} 
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: hasMissing ? '1px solid rgba(234, 179, 8, 0.35)' : '1px solid var(--surface-border)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Cabeçalho da Temporada */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--accent)' }}>
                            Temporada {sn.seasonNumber}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                            {sn.episodes.length} episódios presentes
                          </span>
                          {sn.tmdbTotal && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              (TMDB informa {sn.tmdbTotal} episódios no total)
                            </span>
                          )}
                        </div>

                        {/* Banner de alerta caso haja episódios faltando */}
                        {hasMissing && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(234, 179, 8, 0.12)',
                            color: '#FBBF24',
                            padding: '4px 12px',
                            borderRadius: '10px',
                            fontSize: '0.82rem',
                            fontWeight: 600
                          }}>
                            <AlertTriangle size={15} />
                            Faltam os episódios: {sn.missingEpNums.join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Lista de botões rápidos para adicionar episódios faltantes */}
                      {hasMissing && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.06)',
                          border: '1px dashed rgba(239, 68, 68, 0.25)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <span style={{ fontSize: '0.78rem', color: '#F87171', fontWeight: 600 }}>
                            Adicionar Episódio Faltante:
                          </span>
                          {sn.missingEpNums.map(epNum => (
                            <button
                              key={epNum}
                              type="button"
                              onClick={() => {
                                setNewEpSeason(sn.seasonNumber);
                                setNewEpNum(epNum);
                                setNewEpTitle(`Episódio ${epNum}`);
                                setShowAddEpForm(true);
                              }}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#FCA5A5',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                padding: '3px 10px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                              title={`Clique para preencher o link do Episódio ${epNum}`}
                            >
                              + Ep {epNum}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Grade de Episódios Presentes */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px' }}>
                        {sn.episodes.map(ep => (
                          <div 
                            key={ep.id} 
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid var(--surface-border)',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                              <div style={{ fontWeight: 700, color: 'white', fontSize: '0.85rem' }}>
                                Ep. {ep.episode_number}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ep.title || `Episódio ${ep.episode_number}`}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteEpisode(ep.id, ep.season_number, ep.episode_number)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '6px'
                              }}
                              title="Remover episódio"
                              onMouseOver={(e) => e.currentTarget.style.color = '#F87171'}
                              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé do Modal de Episódios */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Temporadas analisadas: <strong>{seasonAnalysis.length}</strong>
              </span>
              <button className="btn-secondary" onClick={() => setSelectedSeries(null)} style={{ padding: '8px 20px', borderRadius: '10px' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VINCULAR TMDB / ALTERAR CAPA DA SÉRIE                              */}
      {/* ========================================================================= */}
      {coverModalSeries && (
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
                  Série: <strong>{coverModalSeries.title}</strong> (ID #{coverModalSeries.id})
                </span>
              </div>
              <button onClick={() => setCoverModalSeries(null)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
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
                    placeholder="Ex: 2734 (Lei e Ordem: SVU)"
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

              {/* Opção 2: Buscar pelo Nome da Série no TMDB */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Ou buscar por Nome no TMDB:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Ex: Law & Order ou Lei e Ordem"
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
                    Selecione a série correspondente:
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
                          alt={item.name} 
                          style={{ width: '32px', height: '46px', borderRadius: '4px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '32px', height: '46px', borderRadius: '4px', background: 'var(--surface-light)' }} />
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white' }}>{item.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          ID: {item.id} | Estreia: {item.first_air_date || 'N/A'} | Nota: {item.vote_average}
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
                      <Tv size={24} color="var(--text-muted)" />
                    </div>
                  )}

                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={16} color="var(--accent)" />
                      <strong style={{ fontSize: '0.95rem', color: 'white' }}>{coverPreview.name || coverPreview.title}</strong>
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
              <button className="btn-secondary" onClick={() => setCoverModalSeries(null)} style={{ borderRadius: '10px' }}>
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

      {/* ========================================================================= */}
      {/* MODAL: AUDITORIA GLOBAL DE EPISÓDIOS EM FALTA                            */}
      {/* ========================================================================= */}
      {isAuditModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px', maxWidth: '780px', width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={20} color="#FBBF24" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'white' }}>
                    Auditoria de Episódios em Falta
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Diagnóstico de lacunas de episódios no catálogo PostgreSQL
                  </span>
                </div>
              </div>
              <button onClick={() => setIsAuditModalOpen(false)} style={{ color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {isAuditing ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent)' }} />
                  Auditando séries e temporadas no banco...
                </div>
              ) : auditResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontWeight: 600, color: 'white' }}>Nenhuma lacuna de episódios encontrada!</p>
                  <span style={{ fontSize: '0.82rem' }}>Todas as séries analisadas possuem seus episódios em ordem sequencial completa.</span>
                </div>
              ) : (
                auditResults.map(({ series: s, gaps }) => (
                  <div 
                    key={s.id} 
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.95rem', color: 'white' }}>{s.title}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {gaps.map(g => (
                          <span 
                            key={g.seasonNumber}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '3px 8px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            Temp. {g.seasonNumber}: Faltam Ep. {g.missing.join(', ')}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      className="btn-primary"
                      onClick={() => {
                        setIsAuditModalOpen(false);
                        handleViewEpisodes(s);
                      }}
                      style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                      Gerenciar Episódios
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
              <button className="btn-secondary" onClick={() => setIsAuditModalOpen(false)} style={{ borderRadius: '10px' }}>
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
