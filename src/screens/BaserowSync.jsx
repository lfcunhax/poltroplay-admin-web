import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Database, Search, CheckCircle, AlertTriangle, Zap, 
  Film, Tv, PlayCircle, ChevronDown, ChevronRight, Layers, Terminal,
  Sparkles, RefreshCw, ShieldCheck
} from 'lucide-react';

const DEFAULT_TMDB_KEY = '384caf4e90af984a7c5595ea5d9bb386';
const SERIES_API_URL = 'https://series.leflow.com.br';
const ADMIN_SECRET = 'poltroplay_admin_2026';

const GENRE_MAP = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
  99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
  36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
  10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
  53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste',
  10759: 'Ação e Aventura', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const TV_KEYWORDS = [
  'globo', 'sbt', 'record', 'band', 'premiere', 'sportv', 'espn', 'telecine',
  'hbo', 'combate', 'disney', 'cartoon', 'discovery', 'history', 'natgeo',
  'cnn', 'jovempan', 'redetv', 'tnt', 'paramount', 'warner', 'universal',
  'megapix', 'multishow', 'gnt', 'viva', 'animal planet', 'space', 'axn',
  'fx', 'fox', 'tlc', 'id', 'amc', 'sony', 'ae', 'lifetime', 'e!',
  'conmebol', 'copa', 'campeonato', 'brasileirao', 'ufc', 'ao vivo', '24h', 'fhd', '4k'
];

/**
 * Normaliza título preservando caracteres Unicode (letras de qualquer idioma, incluindo Coreano, Japonês, etc)
 */
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos latinos
    .replace(/\[.*?\]|\(.*?\)/g, '') // remove colchetes e parênteses
    .replace(/[^\p{L}\p{N}\s]/gu, '') // preserva letras e números de qualquer idioma
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai nome do arquivo de vídeo da URL
 */
function extractVideoFileName(url) {
  if (!url) return '';
  try {
    const cleanUrl = url.split('?')[0].split('#')[0].trim();
    const parts = cleanUrl.split('/');
    const last = parts[parts.length - 1];
    return (last || '').toLowerCase().trim();
  } catch (_) {
    return '';
  }
}

/**
 * Tenta extrair TMDB ID contido em diretórios da URL (ex: /SHD13/276470/1x1.mp4 -> 276470)
 */
function extractTmdbFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/(\d{4,8})\//);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 100) return parsed;
  }
  return null;
}

/**
 * Limpa o nome da série do Baserow removendo identificadores de episódios/temporadas
 */
function cleanSeriesTitle(name) {
  if (!name) return '';
  let cleaned = name.replace(/\[.*?\]|\(.*?\)/g, '').trim();

  // Remove hífen seguido de temporada/episódio ou números soltos
  cleaned = cleaned.replace(/\s*[-–—:]\s*(?:temporada|\d+ª\s+temporada|season|t\d+|s\d+|epis[oó]dio|ep\d*|\d+).*$/i, '');
  
  // Remove menções de temporada/episódio mesmo sem hífen
  cleaned = cleaned.replace(/\s+(?:temporada|\d+ª\s+temporada|season|t\d+|s\d+|epis[oó]dio|ep\d*)\s*.*$/i, '');
  cleaned = cleaned.replace(/\s+[sS]\d+[\.\s_-]*[eE]\d+.*$/i, '');
  cleaned = cleaned.replace(/\s+\d+x\d+.*$/i, '');
  
  // Remove números de episódio isolados no final (ex: "Série 05" -> "Série")
  cleaned = cleaned.replace(/\s+\d{1,3}$/, '');

  return cleaned.trim() || name.trim();
}

/**
 * Identifica temporada e episódio com suporte amplo a padrões
 */
function parseEpisodeDetails(row, url, name) {
  let seasonNumber = null;
  let episodeNumber = null;

  // 1. Colunas diretas do Baserow
  const colSeason = row.Temporada || row.temporada || row['# Temporada'] || row['Season'] || row['Temp'];
  const colEp = row['Episódio'] || row.episodio || row.Episodio || row['# Episódio'] || row['Episode'] || row['Ep'] || row['Capitulo'] || row['Capítulo'];

  if (colSeason !== undefined && colSeason !== null && String(colSeason).trim() !== '') {
    const sParsed = parseInt(String(colSeason).replace(/\D/g, ''), 10);
    if (!isNaN(sParsed) && sParsed > 0) seasonNumber = sParsed;
  }

  if (colEp !== undefined && colEp !== null && String(colEp).trim() !== '') {
    const eParsed = parseInt(String(colEp).replace(/\D/g, ''), 10);
    if (!isNaN(eParsed) && eParsed > 0) episodeNumber = eParsed;
  }

  if (seasonNumber !== null && episodeNumber !== null) {
    return {
      seasonNumber,
      episodeNumber,
      title: `Episódio ${episodeNumber}`,
      videoUrl: url,
      sourceRowId: row.id
    };
  }

  // 2. Procura em URL e Nome por expressões regulares comuns
  const searchTargets = [url || '', name || ''];
  const regexPatterns = [
    /(\d+)\s*x\s*(\d+)/i,                     // 1x05, 1x5LEG
    /[sS](\d+)[\.\s_-]*[eE](\d+)/i,           // S01E05, S1.E5
    /[tT](\d+)[\.\s_-]*[eE](\d+)/i,           // T01E05, T1.E5
    /temporada\s*(\d+).*?epis[oó]dio\s*(\d+)/i,
    /temp\s*(\d+).*?ep\s*(\d+)/i,
    /season\s*(\d+).*?episode\s*(\d+)/i,
    /(\d{1,2})(\d{2})\.mp4/i,                 // 105.mp4 -> S1 E05
  ];

  for (const target of searchTargets) {
    for (const pattern of regexPatterns) {
      const match = target.match(pattern);
      if (match) {
        const s = parseInt(match[1], 10);
        const e = parseInt(match[2], 10);
        if (!isNaN(s) && !isNaN(e) && s >= 0 && e >= 0) {
          const finalS = seasonNumber !== null ? seasonNumber : s;
          const finalE = episodeNumber !== null ? episodeNumber : e;
          return {
            seasonNumber: finalS,
            episodeNumber: finalE,
            title: `Episódio ${finalE}`,
            videoUrl: url,
            sourceRowId: row.id
          };
        }
      }
    }
  }

  // 3. Procura apenas número de episódio no nome ou URL
  for (const target of searchTargets) {
    const epOnlyMatch = target.match(/epis[oó]dio\s*(\d+)|ep\s*(\d+)|#\s*(\d+)|\bcap[ií]tulo\s*(\d+)|\bcap\s*(\d+)|[-–—]\s*(\d{1,3})\b|x(\d{1,3})\b|\/(\d{1,3})\.mp4/i);
    if (epOnlyMatch) {
      const numStr = epOnlyMatch.slice(1).find(val => val !== undefined);
      if (numStr) {
        const e = parseInt(numStr, 10);
        if (!isNaN(e) && e > 0) {
          const finalS = seasonNumber !== null ? seasonNumber : 1;
          return {
            seasonNumber: finalS,
            episodeNumber: e,
            title: `Episódio ${e}`,
            videoUrl: url,
            sourceRowId: row.id
          };
        }
      }
    }
  }

  // Fallback padrão seguro
  const finalS = seasonNumber !== null ? seasonNumber : 1;
  const finalE = episodeNumber !== null ? episodeNumber : 1;
  return {
    seasonNumber: finalS,
    episodeNumber: finalE,
    title: `Episódio ${finalE}`,
    videoUrl: url,
    sourceRowId: row.id
  };
}

function BaserowSync() {
  const [syncType, setSyncType] = useState('movie'); // 'movie' ou 'series'
  const [baserowConfig, setBaserowConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState('idle');

  const [stats, setStats] = useState({
    totalBaserow: 0,
    alreadySynced: 0,
    newItems: 0,
    newEpisodes: 0,
    incompleteSeries: 0
  });

  const [items, setItems] = useState([]);
  const [filterMode, setFilterMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSeries, setExpandedSeries] = useState({});
  const [liveLogs, setLiveLogs] = useState([]);
  const [autoScrollTerminal, setAutoScrollTerminal] = useState(true);

  // Paginação da lista de itens
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [syncModal, setSyncModal] = useState(null);
  const terminalBoxRef = useRef(null);

  useEffect(() => {
    const savedConfig = localStorage.getItem('poltroplay_baserow_config');
    if (savedConfig) {
      try {
        setBaserowConfig(JSON.parse(savedConfig));
      } catch (err) {
        console.error("Erro ao ler config", err);
      }
    }
  }, []);

  useEffect(() => {
    if (terminalBoxRef.current && autoScrollTerminal) {
      terminalBoxRef.current.scrollTop = terminalBoxRef.current.scrollHeight;
    }
  }, [liveLogs, autoScrollTerminal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchTerm, syncType]);

  const addLog = (message, type = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLiveLogs(prev => [...prev.slice(-300), { time: timeStr, text: message, type }]);
  };

  /**
   * Alterna de aba e limpa completamente os dados e contadores da aba anterior
   */
  const switchSyncType = (newType) => {
    if (newType === syncType) return;
    setSyncType(newType);
    setItems([]);
    setActiveStep('idle');
    setStats({
      totalBaserow: 0,
      alreadySynced: 0,
      newItems: 0,
      newEpisodes: 0,
      incompleteSeries: 0
    });
    setLiveLogs([]);
    setSearchTerm('');
    setFilterMode('all');
    setCurrentPage(1);
  };

  const fetchAllBaserowRows = async (tableId) => {
    const cleanToken = baserowConfig.token.replace(/^Token\s+/i, '').trim();
    let baseUrl = baserowConfig.baseUrl.replace(/(\/api\/?|\/)$/i, '');
    
    // Força HTTPS se o painel estiver rodando em HTTPS para evitar Mixed Content
    if (window.location.protocol === 'https:' && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace(/^http:\/\//i, 'https://');
    }

    const allRows = [];
    let nextPageUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
    let pageCount = 0;

    while (nextPageUrl) {
      pageCount++;
      addLog(`Buscando lote ${pageCount} do Baserow...`, 'info');

      // Sanitiza nextPageUrl para garantir HTTPS
      let targetUrl = nextPageUrl;
      if (window.location.protocol === 'https:' && targetUrl.startsWith('http://')) {
        targetUrl = targetUrl.replace(/^http:\/\//i, 'https://');
      }

      // Se o Baserow retornou um host interno/incompatível em next, redireciona para o baseUrl correto
      try {
        const parsedBase = new URL(baseUrl);
        const parsedNext = new URL(targetUrl);
        if (parsedNext.host !== parsedBase.host) {
          targetUrl = `${baseUrl}${parsedNext.pathname}${parsedNext.search}`;
        }
      } catch (_) {}

      let response = null;
      let lastErr = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await axios.get(targetUrl, {
            headers: { Authorization: `Token ${cleanToken}` },
            timeout: 20000
          });
          break;
        } catch (err) {
          lastErr = err;
          // Se falhou por Mixed Content ou Network Error direto, tenta via proxy backend
          if (attempt === 2 || err.message === 'Network Error') {
            try {
              const proxyUrl = `${SERIES_API_URL}/admin/baserow-proxy?url=${encodeURIComponent(targetUrl)}&token=${encodeURIComponent(cleanToken)}`;
              response = await axios.get(proxyUrl, { timeout: 25000 });
              break;
            } catch (_) {}
          }
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      if (!response || !response.data) {
        throw new Error(lastErr?.response?.data?.detail || lastErr?.message || `Falha de rede ao buscar lote ${pageCount} do Baserow`);
      }

      if (response.data.results) {
        allRows.push(...response.data.results);
        
        if (response.data.next) {
          let next = response.data.next;
          if (window.location.protocol === 'https:' && next.startsWith('http://')) {
            next = next.replace(/^http:\/\//i, 'https://');
          }
          try {
            const parsedBase = new URL(baseUrl);
            const parsedNext = new URL(next);
            if (parsedNext.host !== parsedBase.host) {
              next = `${baseUrl}${parsedNext.pathname}${parsedNext.search}`;
            }
          } catch (_) {}
          nextPageUrl = next;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return allRows;
  };

  /**
   * 1. Diagnóstico ao Vivo com suporte a PostgreSQL
   */
  const handleLiveCheck = async () => {
    if (!baserowConfig || !baserowConfig.token || !baserowConfig.baseUrl) {
      setSyncModal({ type: 'error', text: "Configure as credenciais do Baserow primeiro na aba Configurações." });
      return;
    }

    const tableId = syncType === 'movie' ? baserowConfig.moviesTableId : baserowConfig.seriesTableId;
    if (!tableId) {
      setSyncModal({ type: 'error', text: `Preencha o ID da Tabela de ${syncType === 'movie' ? 'Filmes' : 'Séries'} nas Configurações.` });
      return;
    }

    setIsLoading(true);
    setActiveStep('scanning');
    setLiveLogs([]);
    addLog(`Iniciando Verificação Inteligente para ${syncType === 'movie' ? 'FILMES (PostgreSQL)' : 'SÉRIES (PostgreSQL)'}...`, 'info');

    try {
      const rawRows = await fetchAllBaserowRows(tableId);
      addLog(`Download do Baserow concluído: ${rawRows.length} linhas brutas encontradas.`, 'success');

      addLog("Filtrando canais de TV ao vivo e links inválidos...", 'info');
      const validRows = rawRows.filter(row => {
        const link = (row.Link || row.link || row.Url || row.url || '').trim().toLowerCase();
        const nome = (row.Nome || row.nome || row.Name || row.name || '').trim().toLowerCase();

        if (!link.startsWith('http')) return false;
        if (link.includes('.m3u8') || link.includes('.ts')) return false;

        const isTv = TV_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nome));
        return !isTv;
      });

      addLog(`${validRows.length} itens válidos após filtragem.`, 'info');

      if (syncType === 'movie') {
        // --- DIAGNÓSTICO DE FILMES (PostgreSQL) ---
        addLog("Consultando banco PostgreSQL para mapear filmes já cadastrados...", 'info');
        let existingMoviesList = [];
        try {
          const res = await axios.get(`${SERIES_API_URL}/movies?limit=5000`);
          existingMoviesList = res.data?.movies || [];
          if (existingMoviesList.length > 0) {
            addLog(`PostgreSQL possui ${existingMoviesList.length} filmes cadastrados.`, 'success');
          }
        } catch (apiErr) {
          addLog(`Aviso da API PostgreSQL de filmes: ${apiErr.message}`, 'warn');
        }

        const existingByUrl = new Set();
        const existingByUrlFile = new Set();
        const existingByBaserowId = new Set();
        const existingByTmdb = new Map();
        const existingByExactTitle = new Map();
        const existingByNormTitle = new Map();

        existingMoviesList.forEach(d => {
          const rawUrl = (d.video_url || d.videoUrl || '').trim();
          const lowerUrl = rawUrl.toLowerCase();
          const fileName = extractVideoFileName(rawUrl);

          if (lowerUrl) existingByUrl.add(lowerUrl);
          if (fileName && fileName.length > 5) existingByUrlFile.add(fileName);
          if (d.baserow_row_id || d.baserowRowId) existingByBaserowId.add(String(d.baserow_row_id || d.baserowRowId));
          if (d.tmdb_id || d.tmdbId) existingByTmdb.set(String(d.tmdb_id || d.tmdbId), d);

          const title = (d.title || '').trim();
          if (title) {
            existingByExactTitle.set(title.toLowerCase(), d);
            const norm = normalizeTitle(title);
            if (norm && norm.length >= 3) {
              existingByNormTitle.set(norm, d);
            }
          }
        });

        let alreadySyncedCount = 0;
        let newItemsCount = 0;

        const analyzedMovies = validRows.map(row => {
          const nome = row.Nome || row.nome || row.Name || row.name || '';
          const link = (row.Link || row.link || row.Url || row.url || '').trim();
          const rowIdStr = String(row.id);
          const lowerLink = link.toLowerCase();
          const fileName = extractVideoFileName(link);
          const cleanName = cleanSeriesTitle(nome);
          const normName = normalizeTitle(cleanName);

          let isExisting = false;
          let matchedBy = '';
          let existingData = null;

          if (existingByUrl.has(lowerLink)) {
            isExisting = true;
            matchedBy = 'Link de Vídeo idêntico';
          } else if (fileName && fileName.length > 5 && existingByUrlFile.has(fileName)) {
            isExisting = true;
            matchedBy = `Nome do arquivo (${fileName})`;
          } else if (existingByBaserowId.has(rowIdStr)) {
            isExisting = true;
            matchedBy = `ID Baserow #${rowIdStr}`;
          } else if (existingByExactTitle.has(nome.toLowerCase())) {
            isExisting = true;
            matchedBy = 'Título Exato';
            existingData = existingByExactTitle.get(nome.toLowerCase());
          } else if (normName && normName.length >= 4 && existingByNormTitle.has(normName)) {
            isExisting = true;
            matchedBy = 'Título Normalizado';
            existingData = existingByNormTitle.get(normName);
          }

          if (isExisting) {
            alreadySyncedCount++;
            return {
              id: row.id,
              rawName: nome,
              cleanName,
              playbackUrl: link,
              status: 'synced',
              matchedBy,
              title: existingData?.title || cleanName
            };
          } else {
            newItemsCount++;
            return {
              id: row.id,
              rawName: nome,
              cleanName,
              playbackUrl: link,
              status: 'new',
              title: cleanName
            };
          }
        });

        setStats({
          totalBaserow: validRows.length,
          alreadySynced: alreadySyncedCount,
          newItems: newItemsCount,
          newEpisodes: 0,
          incompleteSeries: 0
        });

        setItems(analyzedMovies);
        addLog(`Diagnóstico concluído: ${newItemsCount} filmes novos detectados | ${alreadySyncedCount} já sincronizados no PostgreSQL.`, 'success');
        setActiveStep('ready');
      } else {
        // --- DIAGNÓSTICO DE SÉRIES (PostgreSQL) ---
        addLog(`Consultando API PostgreSQL (${SERIES_API_URL}/series) para mapear séries existentes...`, 'info');
        let existingSeriesList = [];
        try {
          const res = await axios.get(`${SERIES_API_URL}/series?limit=5000`);
          existingSeriesList = res.data?.series || [];
          addLog(`PostgreSQL possui ${existingSeriesList.length} séries cadastradas.`, 'success');
        } catch (apiErr) {
          addLog(`Aviso ao conectar à API de séries: ${apiErr.message}`, 'warn');
        }

        // Tabela de busca de séries existentes
        const existingSeriesLookup = {};
        for (const s of existingSeriesList) {
          if (!s || !s.title) continue;
          const sTitleLower = s.title.trim().toLowerCase();
          const normTitle = normalizeTitle(s.title);
          const cleanTitle = normalizeTitle(cleanSeriesTitle(s.title));

          existingSeriesLookup[String(s.id)] = s;
          if (s.tmdb_id) existingSeriesLookup[String(s.tmdb_id)] = s;
          if (sTitleLower) existingSeriesLookup[sTitleLower] = s;
          if (normTitle && normTitle.length >= 2) existingSeriesLookup[normTitle] = s;
          if (cleanTitle && cleanTitle.length >= 2) existingSeriesLookup[cleanTitle] = s;
        }

        // Agrupa as linhas do Baserow por Série
        const seriesMap = {};
        validRows.forEach(row => {
          const rawNome = row.Nome || row.nome || row.Name || row.name || '';
          const link = (row.Link || row.link || row.Url || row.url || '').trim();
          
          // Se tiver coluna específica de Série, dá prioridade
          const explicitSerieName = row.Serie || row.serie || row.Série || row.série || row.Show;
          const cleanName = explicitSerieName ? String(explicitSerieName).trim() : cleanSeriesTitle(rawNome);

          if (!cleanName) return;

          const tmdbFromUrl = extractTmdbFromUrl(link);
          const seriesKey = tmdbFromUrl ? `tmdb_${tmdbFromUrl}` : cleanName;

          if (!seriesMap[seriesKey]) {
            seriesMap[seriesKey] = {
              key: seriesKey,
              cleanName,
              tmdbFromUrl,
              rawRows: [],
              episodes: []
            };
          }
          seriesMap[seriesKey].rawRows.push(row);

          const epDetail = parseEpisodeDetails(row, link, rawNome);
          if (epDetail) {
            seriesMap[seriesKey].episodes.push(epDetail);
          }
        });

        const analyzedSeries = [];
        let newSeriesCount = 0;
        let seriesWithNewEpisodesCount = 0;
        let incompleteCount = 0;
        let syncedCount = 0;

        const seriesKeys = Object.keys(seriesMap);
        addLog(`Analisando ${seriesKeys.length} títulos de séries identificados no Baserow...`, 'info');

        for (let i = 0; i < seriesKeys.length; i++) {
          const sKey = seriesKeys[i];
          const sData = seriesMap[sKey];
          const sName = sData.cleanName;
          const normClean = normalizeTitle(sName);

          // 1. Tenta identificar se já existe no banco
          let existing = null;
          if (sData.tmdbFromUrl && existingSeriesLookup[String(sData.tmdbFromUrl)]) {
            existing = existingSeriesLookup[String(sData.tmdbFromUrl)];
          }

          if (!existing) {
            existing = existingSeriesLookup[sName.toLowerCase()] 
              || (normClean && normClean.length >= 2 ? existingSeriesLookup[normClean] : null);
          }

          // Busca aproximada segura (apenas se tiver pelo menos 4 caracteres reais)
          if (!existing && normClean && normClean.length >= 4) {
            for (const s of existingSeriesList) {
              const sNorm = normalizeTitle(s.title);
              if (sNorm && sNorm.length >= 4 && (sNorm === normClean || (sNorm.length >= 6 && normClean.includes(sNorm)) || (normClean.length >= 6 && sNorm.includes(normClean)))) {
                existing = s;
                break;
              }
            }
          }

          // Deduplica episódios do Baserow por season x episode
          const uniqueEpisodesMap = new Map();
          sData.episodes.forEach(ep => {
            const key = `${ep.seasonNumber}x${ep.episodeNumber}`;
            if (!uniqueEpisodesMap.has(key)) {
              uniqueEpisodesMap.set(key, ep);
            }
          });
          const baserowEpisodes = Array.from(uniqueEpisodesMap.values()).sort((a, b) => {
            if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
            return a.episodeNumber - b.episodeNumber;
          });

          if (!existing) {
            newSeriesCount++;
            analyzedSeries.push({
              id: sName,
              cleanName: sName,
              title: sName,
              status: 'new',
              baserowCount: baserowEpisodes.length,
              episodes: baserowEpisodes,
              newEpisodesList: baserowEpisodes,
              existingInfo: null
            });
          } else {
            // Busca episódios já gravados no banco para esta série específica
            let existingEpSet = new Set();
            let existingUrlSet = new Set();
            try {
              const epRes = await axios.get(`${SERIES_API_URL}/series/${existing.id}/episodes`);
              const eps = epRes.data || [];
              eps.forEach(e => {
                existingEpSet.add(`${e.season_number}x${e.episode_number}`);
                if (e.video_url) existingUrlSet.add(e.video_url.trim().toLowerCase());
              });
            } catch (_) {}

            if (existingEpSet.size === 0) {
              incompleteCount++;
              analyzedSeries.push({
                id: existing.id,
                cleanName: sName,
                title: existing.title || sName,
                status: 'incomplete',
                tmdbId: existing.tmdb_id,
                baserowCount: baserowEpisodes.length,
                dbEpisodeCount: 0,
                episodes: baserowEpisodes,
                newEpisodesList: baserowEpisodes,
                existingInfo: existing
              });
            } else {
              const newEpisodes = baserowEpisodes.filter(ep => {
                const epKey = `${ep.seasonNumber}x${ep.episodeNumber}`;
                const epUrl = (ep.videoUrl || '').trim().toLowerCase();
                return !existingEpSet.has(epKey) && (!epUrl || !existingUrlSet.has(epUrl));
              });

              if (newEpisodes.length > 0) {
                seriesWithNewEpisodesCount++;
                addLog(`Série "${existing.title}": ${newEpisodes.length} novo(s) episódio(s) detectado(s)! (Banco: ${existingEpSet.size}, Baserow: ${baserowEpisodes.length})`, 'warn');
                analyzedSeries.push({
                  id: existing.id,
                  cleanName: sName,
                  title: existing.title || sName,
                  status: 'new_episodes',
                  tmdbId: existing.tmdb_id,
                  baserowCount: baserowEpisodes.length,
                  dbEpisodeCount: existingEpSet.size,
                  episodes: baserowEpisodes,
                  newEpisodesList: newEpisodes,
                  existingInfo: existing
                });
              } else {
                syncedCount++;
                analyzedSeries.push({
                  id: existing.id,
                  cleanName: sName,
                  title: existing.title || sName,
                  status: 'synced',
                  tmdbId: existing.tmdb_id,
                  baserowCount: baserowEpisodes.length,
                  dbEpisodeCount: existingEpSet.size,
                  episodes: baserowEpisodes,
                  newEpisodesList: [],
                  existingInfo: existing
                });
              }
            }
          }
        }

        setStats({
          totalBaserow: seriesKeys.length,
          alreadySynced: syncedCount,
          newItems: newSeriesCount,
          newEpisodes: seriesWithNewEpisodesCount,
          incompleteSeries: incompleteCount
        });

        setItems(analyzedSeries);
        addLog(`Diagnóstico de Séries concluído: ${newSeriesCount} novas | ${seriesWithNewEpisodesCount} com novos eps | ${incompleteCount} incompletas | ${syncedCount} em dia.`, 'success');
        setActiveStep('ready');
      }
    } catch (err) {
      console.error(err);
      addLog(`Erro durante diagnóstico: ${err.message}`, 'error');
      setSyncModal({ type: 'error', text: `Erro durante a verificação: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 2. Sincronização Inteligente no PostgreSQL
   */
  const handleSmartSync = async (syncAll = false) => {
    if (items.length === 0) {
      alert("Execute primeiro a Verificação ao Vivo para diagnosticar o que há de novo.");
      return;
    }

    const itemsToProcess = syncAll 
      ? items 
      : items.filter(item => item.status === 'new' || item.status === 'new_episodes' || item.status === 'incomplete');

    if (itemsToProcess.length === 0) {
      alert("Tudo já está 100% atualizado no banco de dados! Nenhum item novo a sincronizar.");
      return;
    }

    if (!window.confirm(`Iniciar Sincronização no PostgreSQL para ${itemsToProcess.length} item(ns)?\nIsso gravará os itens de forma ultrarrápida no banco unificado.`)) {
      return;
    }

    setIsLoading(true);
    setActiveStep('syncing');
    addLog(`Iniciando Sincronização no PostgreSQL para ${itemsToProcess.length} item(ns)...`, 'info');

    try {
      if (syncType === 'movie') {
        // --- SYNC EM LOTE DE FILMES (POSTGRESQL TRANSACTIONAL) ---
        addLog(`Buscando dados no TMDB para ${itemsToProcess.length} filmes novos...`, 'info');
        const moviesPayload = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          addLog(`[${i + 1}/${itemsToProcess.length}] Consultando TMDB: "${item.cleanName}"...`, 'info');

          try {
            const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(item.cleanName)}`);
            
            if (response.data.results && response.data.results.length > 0) {
              const tmdbData = response.data.results[0];
              const genreNames = (tmdbData.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);

              moviesPayload.push({
                baserowRowId: item.id,
                tmdbId: tmdbData.id,
                title: tmdbData.title || item.cleanName,
                overview: tmdbData.overview || '',
                posterPath: tmdbData.poster_path || null,
                backdropPath: tmdbData.backdrop_path || null,
                voteAverage: tmdbData.vote_average || 0,
                releaseDate: tmdbData.release_date || null,
                videoUrl: item.playbackUrl,
                tags: genreNames,
                isHighlight: false,
                source: 'baserow'
              });
            } else {
              moviesPayload.push({
                baserowRowId: item.id,
                tmdbId: null,
                title: item.cleanName,
                overview: '',
                posterPath: null,
                backdropPath: null,
                voteAverage: 0,
                releaseDate: null,
                videoUrl: item.playbackUrl,
                tags: [],
                isHighlight: false,
                source: 'baserow'
              });
            }
          } catch (_) {
            moviesPayload.push({
              baserowRowId: item.id,
              tmdbId: null,
              title: item.cleanName,
              videoUrl: item.playbackUrl,
              tags: [],
              source: 'baserow'
            });
          }

          await new Promise(r => setTimeout(r, 60));
        }

        addLog(`Enviando lote de ${moviesPayload.length} filmes para o PostgreSQL (${SERIES_API_URL}/movies/sync)...`, 'info');
        const apiRes = await axios.post(
          `${SERIES_API_URL}/movies/sync`,
          { movies: moviesPayload },
          { headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' } }
        );

        const resData = apiRes.data;
        addLog(`Sucesso no PostgreSQL! Inseridos: ${resData.inserted} | Atualizados: ${resData.updated} | Ignorados: ${resData.skipped}`, 'success');
        
        // Atualiza estado local: zera contadores de novidades
        setStats(prev => ({
          ...prev,
          alreadySynced: prev.totalBaserow,
          newItems: 0,
          newEpisodes: 0,
          incompleteSeries: 0
        }));
        setItems(prev => prev.map(it => ({ ...it, status: 'synced' })));

        setSyncModal({
          type: 'success',
          text: `Sincronização PostgreSQL Concluída!\n\n🎬 Filmes novos inseridos: ${resData.inserted}\n🔄 Filmes atualizados: ${resData.updated}\n🛡️ Duplicatas evitadas: ${resData.skipped}`
        });
      } else {
        // --- SYNC EM LOTE DE SÉRIES (POSTGRESQL) ---
        addLog(`Preparando payload de séries para envio à API PostgreSQL...`, 'info');
        const seriesPayload = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];

          if (item.status === 'new') {
            addLog(`Buscando no TMDB para nova série: "${item.cleanName}"...`, 'info');
            let tmdbData = null;
            let genreNames = [];

            try {
              const tmdbResp = await axios.get(`https://api.themoviedb.org/3/search/tv?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(item.cleanName)}`);
              if (tmdbResp.data.results && tmdbResp.data.results.length > 0) {
                tmdbData = tmdbResp.data.results[0];
                genreNames = (tmdbData.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);
              }
            } catch (err) {
              addLog(`Aviso no TMDB para "${item.cleanName}": ${err.message}`, 'warn');
            }

            const formattedEpisodes = (item.episodes || []).map(ep => ({
              seasonNumber: parseInt(ep.seasonNumber, 10) || 1,
              episodeNumber: parseInt(ep.episodeNumber, 10) || 1,
              title: ep.title || `Episódio ${ep.episodeNumber || 1}`,
              videoUrl: ep.videoUrl
            }));

            seriesPayload.push({
              tmdbId: tmdbData?.id || null,
              title: tmdbData?.name || item.cleanName,
              overview: tmdbData?.overview || '',
              posterPath: tmdbData?.poster_path || null,
              backdropPath: tmdbData?.backdrop_path || null,
              voteAverage: tmdbData?.vote_average || 0,
              releaseDate: tmdbData?.first_air_date || null,
              tags: genreNames,
              isHighlight: false,
              episodes: formattedEpisodes
            });

            await new Promise(r => setTimeout(r, 60));
          } else {
            // Série existente (adiciona novos episódios)
            const targetEpisodes = item.newEpisodesList && item.newEpisodesList.length > 0 
              ? item.newEpisodesList 
              : item.episodes || [];

            const formattedEpisodes = targetEpisodes.map(ep => ({
              seasonNumber: parseInt(ep.seasonNumber, 10) || 1,
              episodeNumber: parseInt(ep.episodeNumber, 10) || 1,
              title: ep.title || `Episódio ${ep.episodeNumber || 1}`,
              videoUrl: ep.videoUrl
            }));

            seriesPayload.push({
              id: item.existingInfo?.id || item.id,
              tmdbId: item.tmdbId || item.existingInfo?.tmdb_id || null,
              title: item.title,
              overview: item.existingInfo?.overview || '',
              posterPath: item.existingInfo?.poster_path || null,
              backdropPath: item.existingInfo?.backdrop_path || null,
              voteAverage: item.existingInfo?.vote_average || 0,
              releaseDate: item.existingInfo?.release_date || null,
              tags: item.existingInfo?.tags || [],
              isHighlight: item.existingInfo?.is_highlight || false,
              episodes: formattedEpisodes
            });
          }
        }

        if (seriesPayload.length === 0) {
          addLog("Nenhuma série ou episódio válido para envio.", 'warn');
          setIsLoading(false);
          setActiveStep('ready');
          return;
        }

        addLog(`Enviando ${seriesPayload.length} série(s) com seus episódios para o PostgreSQL (${SERIES_API_URL}/series/sync)...`, 'info');
        const apiResponse = await axios.post(
          `${SERIES_API_URL}/series/sync`,
          { series: seriesPayload },
          { headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' } }
        );

        const result = apiResponse.data;
        addLog(`Sucesso no PostgreSQL! Séries: ${result.insertedSeries} | Novos episódios: ${result.insertedEpisodes} | Preservados: ${result.skippedEpisodes}`, 'success');

        // Atualiza estado local: zera contadores de novidades
        setStats(prev => ({
          ...prev,
          alreadySynced: prev.totalBaserow,
          newItems: 0,
          newEpisodes: 0,
          incompleteSeries: 0
        }));
        setItems(prev => prev.map(it => ({ ...it, status: 'synced', newEpisodesList: [] })));

        setSyncModal({
          type: 'success',
          text: `Sincronização de Séries Concluída!\n\n📺 Séries processadas: ${result.insertedSeries}\n🎬 Novos episódios inseridos: ${result.insertedEpisodes}\n🛡️ Episódios preservados: ${result.skippedEpisodes}`
        });
      }

      setActiveStep('done');
    } catch (err) {
      console.error(err);
      addLog(`Erro na sincronização: ${err.message}`, 'error');
      setSyncModal({ type: 'error', text: `Erro durante o Sync: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (filterMode === 'new') {
      if (syncType === 'movie') return item.status === 'new';
      return item.status === 'new' || item.status === 'new_episodes' || item.status === 'incomplete';
    }
    if (filterMode === 'synced') return item.status === 'synced';
    return true;
  }).filter(item => {
    if (!searchTerm) return true;
    const name = item.cleanName || item.rawName || item.title || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleExpand = (id) => {
    setExpandedSeries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalNovidades = syncType === 'movie' ? stats.newItems : (stats.newItems + stats.newEpisodes + stats.incompleteSeries);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Sincronização Inteligente Baserow
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Banco de Dados Unificado PostgreSQL: Sincronização atômica instantânea sem perdas.
          </p>
        </div>

        {/* Seletor de Tipo com Limpeza Completa */}
        <div style={{ 
          display: 'flex', 
          background: 'rgba(255, 255, 255, 0.05)', 
          padding: '4px', 
          borderRadius: '12px',
          border: '1px solid var(--surface-border)'
        }}>
          <button
            onClick={() => switchSyncType('movie')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              background: syncType === 'movie' ? 'var(--gradient-primary)' : 'transparent',
              color: syncType === 'movie' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Film size={16} />
            Filmes (PostgreSQL)
          </button>
          <button
            onClick={() => switchSyncType('series')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s',
              background: syncType === 'series' ? 'var(--gradient-primary)' : 'transparent',
              color: syncType === 'series' ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Tv size={16} />
            Séries & Episódios (PostgreSQL)
          </button>
        </div>
      </div>

      {/* Card de Configuração e Ação Principal */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'rgba(123, 47, 247, 0.15)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(123, 47, 247, 0.3)'
          }}>
            <Database size={24} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700 }}>
              Conexão: Baserow API ➔ Banco PostgreSQL
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>Destino: <code>{SERIES_API_URL}/{syncType === 'movie' ? 'movies' : 'series'}</code></span>
              <span>•</span>
              <span>Tabela {syncType === 'movie' ? 'Filmes' : 'Séries'}: <strong>{syncType === 'movie' ? baserowConfig?.moviesTableId : baserowConfig?.seriesTableId}</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleLiveCheck}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '10px' }}
          >
            <Search size={18} />
            Verificar Status ao Vivo
          </button>

          {totalNovidades > 0 && (
            <button
              onClick={() => handleSmartSync(false)}
              disabled={isLoading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 22px', borderRadius: '10px', fontWeight: 700 }}
            >
              <Zap size={18} />
              Sincronizar Novidades ({totalNovidades})
            </button>
          )}
        </div>
      </div>

      {/* Grid de Estatísticas em Tempo Real */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px' 
      }}>
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(123, 47, 247, 0.15)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{stats.totalBaserow}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Total no Baserow</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1, color: '#10B981' }}>{stats.alreadySynced}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Já Sincronizados</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1, color: stats.newItems > 0 ? '#00D4FF' : 'var(--text-primary)' }}>{stats.newItems}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>
              {syncType === 'movie' ? 'Filmes Novos' : 'Séries Novas'}
            </div>
          </div>
        </div>

        {syncType === 'series' && (
          <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlayCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1, color: stats.newEpisodes > 0 ? '#F59E0B' : 'var(--text-primary)' }}>{stats.newEpisodes}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>Novos Episódios</div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal ao Vivo Isolado */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            <Terminal size={16} style={{ color: 'var(--accent)' }} />
            <span>Processo ao Vivo (Live Terminal)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={autoScrollTerminal} 
                onChange={(e) => setAutoScrollTerminal(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Auto-scroll Ativo
            </label>
            <button
              onClick={() => setLiveLogs([])}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Limpar
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{liveLogs.length} eventos registrados</span>
          </div>
        </div>

        <div 
          ref={terminalBoxRef}
          style={{
            height: '220px',
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '14px',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          {liveLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>
              Terminal pronto. Clique em "Verificar Status ao Vivo" para iniciar a varredura atômica.
            </div>
          ) : (
            liveLogs.map((log, index) => {
              let color = '#94A3B8';
              let badge = '[INFO]';
              if (log.type === 'success') { color = '#10B981'; badge = '[SUCCESS]'; }
              if (log.type === 'warn') { color = '#F59E0B'; badge = '[WARN]'; }
              if (log.type === 'error') { color = '#EF4444'; badge = '[ERROR]'; }

              return (
                <div key={index} style={{ lineHeight: 1.4, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>[{log.time}]</span>
                  <span style={{ color, fontWeight: 700, marginRight: '8px' }}>{badge}</span>
                  <span>{log.text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lista de Itens Analisados */}
      {items.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', borderRadius: '8px' }}>
                <button
                  onClick={() => setFilterMode('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: filterMode === 'all' ? 'var(--accent)' : 'transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Todos ({items.length})
                </button>
                <button
                  onClick={() => setFilterMode('new')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: filterMode === 'new' ? 'var(--accent)' : 'transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Novidades ({totalNovidades})
                </button>
                <button
                  onClick={() => setFilterMode('synced')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: filterMode === 'synced' ? 'var(--accent)' : 'transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Sincronizados ({stats.alreadySynced})
                </button>
              </div>

              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Exibindo <strong>{filteredItems.length}</strong> de <strong>{items.length}</strong> itens
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Pesquisar por título..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--surface-border)',
                    color: 'white',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              {totalNovidades > 0 && (
                <button
                  onClick={() => handleSmartSync(false)}
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <Zap size={15} />
                  Sincronizar Novidades
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Resultados Paginada */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Título</th>
                  <th style={{ padding: '12px 16px' }}>Status no PostgreSQL</th>
                  <th style={{ padding: '12px 16px' }}>{syncType === 'movie' ? 'Origem / Verificação' : 'Episódios (Baserow vs Banco)'}</th>
                  {syncType === 'series' && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, idx) => {
                  const isNew = item.status === 'new';
                  const isNewEp = item.status === 'new_episodes';
                  const isIncomplete = item.status === 'incomplete';
                  const isSynced = item.status === 'synced';
                  const isExpanded = expandedSeries[item.id];

                  return (
                    <React.Fragment key={item.id || idx}>
                      <tr style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                      }}>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'white' }}>{item.title || item.cleanName}</div>
                          {item.rawName && item.rawName !== item.cleanName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Original: {item.rawName}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {isSynced && (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.15)', color: '#10B981',
                              fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <CheckCircle size={13} /> Sincronizado
                            </span>
                          )}
                          {isNew && (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF',
                              fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <Sparkles size={13} /> Novo {syncType === 'movie' ? 'Filme' : 'Título'}
                            </span>
                          )}
                          {isNewEp && (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B',
                              fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <PlayCircle size={13} /> {item.newEpisodesList?.length || 0} Novos Episódios
                            </span>
                          )}
                          {isIncomplete && (
                            <span style={{ 
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '4px 10px', borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444',
                              fontSize: '0.75rem', fontWeight: 600
                            }}>
                              <AlertTriangle size={13} /> Sem episódios no banco
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {syncType === 'movie' ? (
                            <span>{item.matchedBy || 'Pendente de envio ao PostgreSQL'}</span>
                          ) : (
                            <span>
                              {item.baserowCount} no Baserow
                              {item.dbEpisodeCount !== undefined && ` • ${item.dbEpisodeCount} no Banco`}
                            </span>
                          )}
                        </td>

                        {syncType === 'series' && (
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => toggleExpand(item.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.78rem'
                              }}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              {isExpanded ? 'Ocultar' : 'Ver'} Episódios ({item.episodes?.length || 0})
                            </button>
                          </td>
                        )}
                      </tr>

                      {/* Linha Expandida de Episódios */}
                      {syncType === 'series' && isExpanded && (
                        <tr style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                          <td colSpan={4} style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Lista de Episódios Mapeados ({item.episodes?.length || 0}):
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                                {(item.episodes || []).map((ep, eIdx) => {
                                  const isNewEpisode = item.newEpisodesList?.some(
                                    ne => ne.seasonNumber === ep.seasonNumber && ne.episodeNumber === ep.episodeNumber
                                  );

                                  return (
                                    <div 
                                      key={eIdx}
                                      style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        background: isNewEpisode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                        border: `1px solid ${isNewEpisode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.78rem'
                                      }}
                                    >
                                      <span style={{ fontWeight: 600, color: isNewEpisode ? '#F59E0B' : 'white' }}>
                                        T{ep.seasonNumber} : E{ep.episodeNumber}
                                      </span>
                                      <span style={{ 
                                        fontSize: '0.7rem', 
                                        color: isNewEpisode ? '#F59E0B' : 'var(--text-muted)' 
                                      }}>
                                        {isNewEpisode ? 'NOVO' : 'Gravado'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Página {currentPage} de {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px' }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '6px' }}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Status / Feedback */}
      {syncModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(6px)'
        }}>
          <div className="glass-card" style={{ width: '480px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: syncModal.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: syncModal.type === 'success' ? '#10B981' : '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {syncModal.type === 'success' ? <ShieldCheck size={24} /> : <AlertTriangle size={24} />}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                {syncModal.type === 'success' ? 'Operação Concluída com Sucesso' : 'Aviso do Sistema'}
              </h3>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {syncModal.text}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSyncModal(null)}
                className="btn btn-primary"
                style={{ padding: '10px 24px', borderRadius: '8px' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BaserowSync;
