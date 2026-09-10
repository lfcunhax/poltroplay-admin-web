import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import axios from 'axios';
import { 
  Database, Search, CheckCircle, AlertTriangle, Zap, 
  Film, Tv, PlayCircle, ChevronDown, ChevronRight, Layers, Terminal,
  Sparkles, Trash2, RefreshCw, ShieldCheck
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
  10765: 'Sci-Fi e Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
};

const TV_KEYWORDS = [
  'espn', 'premiere', 'telecine', 'hbo', 'sportv', 'globo', 'sbt', 'record', 
  'band', 'cnn', 'fox sports', 'discovery', 'history', 'tnt', 'space', 'megapix', 
  'cinemax', 'paramount', 'a&e', 'axn', 'warner', 'sony', 'universal', 'syfy', 
  'amc', 'fox', 'fx', 'multishow', 'viva', 'gnt', 'bis', 'off', 'combate', 
  'conmebol', 'dazn', 'ufc', 'bbb', 'fazenda', 'playboy', 'sexy hot', 'venus', 
  'sex prive', 'band news', 'record news', 'tv', 'ao vivo', '24h', 'futebol', 
  'campeonato', 'novela'
];

/**
 * Normaliza strings para comparação robusta (sem acentos, pontuações, caracteres especiais)
 */
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extrai o nome de arquivo final de um link de streaming (ex: tt26469192.mp4)
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
 * Limpa o nome da série removendo menções de temporadas e episódios
 */
function cleanSeriesTitle(name) {
  if (!name) return '';
  return name
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .split(' - ')[0]
    .split(' — ')[0]
    .replace(/\s+(temporada|\d+ª\s+temporada|season|t\d+|s\d+).*$/i, '')
    .trim();
}

/**
 * Parser Inteligente de Episódios Multi-Padrão
 */
function parseEpisodeDetails(row, url, name) {
  let seasonNumber = null;
  let episodeNumber = null;

  // 1. Tenta colunas explícitas no Baserow
  const colSeason = row.Temporada || row.temporada || row['# Temporada'] || row['Season'];
  const colEp = row['Episódio'] || row.episodio || row.Episodio || row['# Episódio'] || row['Episode'];

  if (colSeason !== undefined && colSeason !== null && String(colSeason).trim() !== '') {
    const sParsed = parseInt(String(colSeason).replace(/\D/g, ''), 10);
    if (!isNaN(sParsed) && sParsed > 0) seasonNumber = sParsed;
  }

  if (colEp !== undefined && colEp !== null && String(colEp).trim() !== '') {
    const eParsed = parseInt(String(colEp).replace(/\D/g, ''), 10);
    if (!isNaN(eParsed) && eParsed > 0) episodeNumber = eParsed;
  }

  // 2. Se já achou ambos pelas colunas, retorna com sucesso
  if (seasonNumber !== null && episodeNumber !== null) {
    return { seasonNumber, episodeNumber, videoUrl: url, sourceRowId: row.id };
  }

  // 3. Fallback: Expressões Regulares no Nome e na URL
  const searchTargets = [name || '', url || ''];

  const regexPatterns = [
    /(\d+)\s*x\s*(\d+)/i,                     // Ex: 1x4, 01x04, 1X04
    /[sS](\d+)[\.\s_-]*[eE](\d+)/i,          // Ex: S01E04, S1E4, S01.E04
    /[tT](\d+)[\.\s_-]*[eE](\d+)/i,          // Ex: T01E04, T1E4 (padrão Brasil)
    /temporada\s*(\d+).*?epis[oó]dio\s*(\d+)/i, // Ex: Temporada 1 Episódio 4
    /temp\s*(\d+).*?ep\s*(\d+)/i,             // Ex: Temp 1 Ep 4
    /season\s*(\d+).*?episode\s*(\d+)/i,      // Ex: Season 1 Episode 4
    /(\d{1,2})(\d{2})\.mp4/i,                 // Ex: 104.mp4 (Temp 1 Ep 04)
  ];

  for (const target of searchTargets) {
    for (const pattern of regexPatterns) {
      const match = target.match(pattern);
      if (match) {
        const s = parseInt(match[1], 10);
        const e = parseInt(match[2], 10);
        if (!isNaN(s) && !isNaN(e) && s >= 0 && e >= 0) {
          return {
            seasonNumber: seasonNumber !== null ? seasonNumber : s,
            episodeNumber: episodeNumber !== null ? episodeNumber : e,
            videoUrl: url,
            sourceRowId: row.id
          };
        }
      }
    }
  }

  // 4. Se encontrou apenas o episódio isolado
  const epOnlyMatch = (name || '').match(/epis[oó]dio\s*(\d+)|ep\s*(\d+)|#\s*(\d+)/i);
  if (epOnlyMatch) {
    const e = parseInt(epOnlyMatch[1] || epOnlyMatch[2] || epOnlyMatch[3], 10);
    if (!isNaN(e)) {
      return {
        seasonNumber: seasonNumber !== null ? seasonNumber : 1,
        episodeNumber: e,
        videoUrl: url,
        sourceRowId: row.id
      };
    }
  }

  // Fallback padrão se não conseguir detectar números: Temporada 1 Episódio 1
  return {
    seasonNumber: seasonNumber !== null ? seasonNumber : 1,
    episodeNumber: episodeNumber !== null ? episodeNumber : 1,
    videoUrl: url,
    sourceRowId: row.id
  };
}

function BaserowSync() {
  const [syncType, setSyncType] = useState('movie'); // 'movie' ou 'series'
  const [baserowConfig, setBaserowConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState('idle'); // 'idle', 'scanning', 'ready', 'syncing', 'done'

  // Estatísticas do Diagnóstico
  const [stats, setStats] = useState({
    totalBaserow: 0,
    alreadySynced: 0,
    newItems: 0,
    newEpisodes: 0,
    incompleteSeries: 0
  });

  // Lista de Itens Inspecionados
  const [items, setItems] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'new', 'new_episodes', 'incomplete', 'synced'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSeries, setExpandedSeries] = useState({});

  // Terminal de Logs ao Vivo (com scroll interno isolado)
  const [liveLogs, setLiveLogs] = useState([]);
  const terminalBoxRef = useRef(null);
  const [autoScrollTerminal, setAutoScrollTerminal] = useState(true);

  // Paginação Inteligente para Grandes Listas
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal de resultado
  const [syncModal, setSyncModal] = useState(null);

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

  // Reseta paginação ao alterar filtros ou busca
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchTerm, syncType, items]);

  const addLog = (message, type = 'info') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLiveLogs(prev => [...prev.slice(-300), { time: timeStr, text: message, type }]);
  };

  /**
   * Baixa todas as linhas da tabela alvo no Baserow
   */
  const fetchAllBaserowRows = async (tableId) => {
    const cleanToken = baserowConfig.token.replace(/^Token\s+/i, '').trim();
    const baseUrl = baserowConfig.baseUrl.replace(/(\/api\/?|\/)$/i, '');
    let nextPageUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;

    let allRows = [];
    let page = 1;

    while (nextPageUrl) {
      addLog(`Lendo página ${page} do Baserow... (${allRows.length} linhas obtidas)`, 'info');
      const response = await axios.get(nextPageUrl, {
        headers: { Authorization: `Token ${cleanToken}` }
      });

      if (response.data && response.data.results) {
        allRows = [...allRows, ...response.data.results];
        let nextUrl = response.data.next;
        if (nextUrl && baseUrl.startsWith('https://') && nextUrl.startsWith('http://')) {
          nextUrl = nextUrl.replace(/^http:\/\//i, 'https://');
        }
        nextPageUrl = nextUrl;
        page++;
      } else {
        break;
      }
    }

    return allRows;
  };

  /**
   * 1. Diagnóstico e Verificação ao Vivo (Live Check) com Deduplicação Multi-Camadas
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
    addLog(`Iniciando Verificação Inteligente ao Vivo para ${syncType === 'movie' ? 'FILMES' : 'SÉRIES'}...`, 'info');

    try {
      // 1. Baixar Baserow
      const rawRows = await fetchAllBaserowRows(tableId);
      addLog(`Download do Baserow concluído com sucesso: ${rawRows.length} linhas brutas encontradas.`, 'success');

      // 2. Filtrar Canais de TV e Links Inválidos
      addLog("Filtrando canais de TV ao vivo e streams inválidos...", 'info');
      const validRows = rawRows.filter(row => {
        const link = (row.Link || row.link || row.Url || row.url || '').trim().toLowerCase();
        const nome = (row.Nome || row.nome || row.Name || row.name || '').trim().toLowerCase();

        if (!link.startsWith('http')) return false;
        if (link.includes('.m3u8') || link.includes('.ts')) return false;

        const isTv = TV_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(nome));
        return !isTv;
      });

      addLog(`${validRows.length} itens válidos após filtragem de canais ao vivo.`, 'info');

      if (syncType === 'movie') {
        // --- DIAGNÓSTICO DE FILMES (Firestore com Deduplicação Rigorosa) ---
        addLog("Consultando banco Firestore para mapear filmes já cadastrados...", 'info');
        const moviesSnap = await getDocs(collection(db, 'movies'));
        
        // Multi-camadas de indexação
        const existingByUrl = new Set();
        const existingByUrlFile = new Set();
        const existingByBaserowId = new Set();
        const existingByTmdb = new Map();
        const existingByExactTitle = new Map();
        const existingByNormTitle = new Map();

        moviesSnap.forEach(docSnap => {
          const d = docSnap.data();
          const rawUrl = (d.videoUrl || '').trim();
          const lowerUrl = rawUrl.toLowerCase();
          const fileName = extractVideoFileName(rawUrl);
          const tmdb = d.tmdbId ? String(d.tmdbId) : null;
          const title = (d.title || '').trim();
          const normTitle = normalizeTitle(title);

          if (lowerUrl) existingByUrl.add(lowerUrl);
          if (fileName) existingByUrlFile.add(fileName);
          if (d.baserowRowId) existingByBaserowId.add(String(d.baserowRowId));
          if (tmdb) existingByTmdb.set(tmdb, d);
          if (title) existingByExactTitle.set(title.toLowerCase(), d);
          if (normTitle) existingByNormTitle.set(normTitle, d);
        });

        addLog(`Firestore possui ${moviesSnap.size} registros de filmes carregados.`, 'success');
        addLog("Classificando novidades do Baserow com detecção anti-duplicação...", 'info');

        let alreadySyncedCount = 0;
        let newItemsCount = 0;

        const analyzedMovies = validRows.map(row => {
          const nome = (row.Nome || row.nome || row.Name || row.name || '').trim();
          const link = (row.Link || row.link || row.Url || row.url || '').trim();
          const lowerLink = link.toLowerCase();
          const fileName = extractVideoFileName(link);
          const cleanName = nome.split(' - ')[0].split(' — ')[0].replace(/\[.*?\]|\(.*?\)/g, '').trim();
          const normNome = normalizeTitle(nome);
          const normClean = normalizeTitle(cleanName);

          let exists = null;

          // 1. Checa por URL exata de vídeo
          if (lowerLink && existingByUrl.has(lowerLink)) {
            exists = true;
          }
          // 2. Checa por nome do arquivo de vídeo (ex: tt26469192.mp4)
          else if (fileName && existingByUrlFile.has(fileName)) {
            exists = true;
          }
          // 3. Checa por Baserow Row ID
          else if (existingByBaserowId.has(String(row.id))) {
            exists = true;
          }
          // 4. Checa por título exato
          else if (existingByExactTitle.has(nome.toLowerCase())) {
            exists = existingByExactTitle.get(nome.toLowerCase());
          }
          else if (existingByExactTitle.has(cleanName.toLowerCase())) {
            exists = existingByExactTitle.get(cleanName.toLowerCase());
          }
          // 5. Checa por título normalizado (sem acentos e caracteres especiais)
          else if (normNome && existingByNormTitle.has(normNome)) {
            exists = existingByNormTitle.get(normNome);
          }
          else if (normClean && existingByNormTitle.has(normClean)) {
            exists = existingByNormTitle.get(normClean);
          }
          // 6. Checa correspondência de prefixo no título
          else if (normClean.length >= 6) {
            for (const [existingNorm, movieDoc] of existingByNormTitle.entries()) {
              if (existingNorm.startsWith(normClean) || normClean.startsWith(existingNorm)) {
                exists = movieDoc;
                break;
              }
            }
          }

          if (exists) {
            alreadySyncedCount++;
            return {
              id: row.id,
              rawName: nome,
              cleanName,
              playbackUrl: link,
              status: 'synced',
              existingInfo: exists,
              title: exists.title || cleanName
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
        addLog(`Diagnóstico concluído: ${newItemsCount} filmes novos detectados | ${alreadySyncedCount} já sincronizados no Firestore.`, 'success');
        setActiveStep('ready');
      } else {
        // --- DIAGNÓSTICO DE SÉRIES E EPISÓDIOS (PostgreSQL REST API) ---
        addLog(`Consultando API PostgreSQL (${SERIES_API_URL}/series) para mapear séries existentes...`, 'info');
        let existingSeriesList = [];
        try {
          const res = await axios.get(`${SERIES_API_URL}/series?limit=5000`);
          existingSeriesList = res.data?.series || [];
          addLog(`PostgreSQL possui ${existingSeriesList.length} séries cadastradas no momento.`, 'success');
        } catch (apiErr) {
          addLog(`Aviso ao conectar à API de séries: ${apiErr.message}`, 'warn');
        }

        // Mapeia séries existentes no PostgreSQL com múltiplos identificadores
        const existingSeriesLookup = {};

        for (const s of existingSeriesList) {
          const normTitle = normalizeTitle(s.title);
          const cleanTitle = normalizeTitle(cleanSeriesTitle(s.title));

          existingSeriesLookup[String(s.id)] = s;
          if (s.tmdb_id) existingSeriesLookup[String(s.tmdb_id)] = s;
          existingSeriesLookup[s.title.trim().toLowerCase()] = s;
          if (normTitle) existingSeriesLookup[normTitle] = s;
          if (cleanTitle) existingSeriesLookup[cleanTitle] = s;
        }

        // Agrupa linhas do Baserow por Série
        const seriesMap = {};
        validRows.forEach(row => {
          const nome = row.Nome || row.nome || row.Name || row.name || '';
          const link = (row.Link || row.link || row.Url || row.url || '').trim();
          const cleanName = cleanSeriesTitle(nome);

          if (!cleanName) return;

          if (!seriesMap[cleanName]) {
            seriesMap[cleanName] = {
              cleanName,
              rawRows: [],
              episodes: []
            };
          }

          seriesMap[cleanName].rawRows.push(row);

          const epDetail = parseEpisodeDetails(row, link, nome);
          if (epDetail) {
            seriesMap[cleanName].episodes.push(epDetail);
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
          const sName = seriesKeys[i];
          const sData = seriesMap[sName];
          const cleanTitle = cleanSeriesTitle(sName);
          const normSName = normalizeTitle(sName);
          const normClean = normalizeTitle(cleanTitle);

          // Busca correspondência da série no PostgreSQL
          let existing = existingSeriesLookup[sName.toLowerCase()] 
            || existingSeriesLookup[cleanTitle.toLowerCase()]
            || existingSeriesLookup[normSName]
            || existingSeriesLookup[normClean];

          if (!existing && normClean.length >= 4) {
            for (const s of existingSeriesList) {
              const sNorm = normalizeTitle(s.title);
              if (sNorm.includes(normClean) || normClean.includes(sNorm)) {
                existing = s;
                break;
              }
            }
          }

          // Deduplica episódios do Baserow por TemporadaxEpisódio
          const uniqueEpisodesMap = new Map();
          sData.episodes.forEach(ep => {
            const key = `${ep.seasonNumber}x${ep.episodeNumber}`;
            if (!uniqueEpisodesMap.has(key)) {
              uniqueEpisodesMap.set(key, ep);
            }
          });
          const baserowEpisodes = Array.from(uniqueEpisodesMap.values());

          if (!existing) {
            // Série Nova (ainda não existe no banco)
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
            // Série já existe no PostgreSQL! Checamos se tem episódios novos
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
              // Série cadastrada no banco com 0 episódios
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
              // Checa se há episódios novos no Baserow
              const newEpisodes = baserowEpisodes.filter(ep => {
                const epKey = `${ep.seasonNumber}x${ep.episodeNumber}`;
                const epUrl = (ep.videoUrl || '').trim().toLowerCase();
                return !existingEpSet.has(epKey) && (!epUrl || !existingUrlSet.has(epUrl));
              });

              if (newEpisodes.length > 0) {
                seriesWithNewEpisodesCount++;
                addLog(`Série "${existing.title}": ${newEpisodes.length} novo(s) episódio(s) detectado(s)!`, 'warn');
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
                // Série 100% atualizada
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
   * 2. Sincronização Inteligente (Apenas Novos com Proteção Anti-Duplicata)
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

    if (!window.confirm(`Iniciar Sincronização Inteligente para ${itemsToProcess.length} item(ns)?\nIsso NÃO duplicará nenhum item existente, apenas adicionará as novidades reais.`)) {
      return;
    }

    setIsLoading(true);
    setActiveStep('syncing');
    addLog(`Iniciando Sincronização Inteligente para ${itemsToProcess.length} item(ns)...`, 'info');

    try {
      if (syncType === 'movie') {
        // --- SYNC DELTA DE FILMES (COM TRAVA ANTI-DUPLICAÇÃO) ---
        let inserted = 0;
        let skipped = 0;

        // Memória em tempo real para impedir duplicatas no mesmo lote
        const insertedUrls = new Set();
        const insertedTmdb = new Set();

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const itemUrl = (item.playbackUrl || '').trim().toLowerCase();

          if (itemUrl && insertedUrls.has(itemUrl)) {
            skipped++;
            addLog(`[IGNORADO] URL duplicada no lote: "${item.cleanName}". Pulando...`, 'warn');
            continue;
          }

          addLog(`[${i + 1}/${itemsToProcess.length}] Processando filme: "${item.cleanName}"...`, 'info');

          try {
            // Busca dados e capa no TMDB
            const response = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(item.cleanName)}`);
            
            if (response.data.results && response.data.results.length > 0) {
              const tmdbData = response.data.results[0];
              const genreNames = (tmdbData.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);

              if (insertedTmdb.has(String(tmdbData.id))) {
                skipped++;
                addLog(`[IGNORADO] TMDB ID ${tmdbData.id} já inserido neste lote: "${tmdbData.title}".`, 'warn');
                continue;
              }

              // Grava no Firestore com baserowRowId e segurança
              await addDoc(collection(db, 'movies'), {
                baserowRowId: item.id,
                tmdbId: tmdbData.id,
                title: tmdbData.title || item.cleanName,
                overview: tmdbData.overview || '',
                posterPath: tmdbData.poster_path || null,
                backdropPath: tmdbData.backdrop_path || null,
                voteAverage: tmdbData.vote_average || 0,
                releaseDate: tmdbData.release_date || null,
                videoUrl: item.playbackUrl || '',
                tags: genreNames,
                isHighlight: false,
                source: 'baserow',
                createdAt: serverTimestamp()
              });

              inserted++;
              if (itemUrl) insertedUrls.add(itemUrl);
              insertedTmdb.add(String(tmdbData.id));
              addLog(`Sucesso: "${tmdbData.title}" salvo no Firestore.`, 'success');
            } else {
              addLog(`Aviso: "${item.cleanName}" não encontrado no TMDB. Pulando...`, 'warn');
            }
          } catch (mErr) {
            addLog(`Erro ao salvar filme "${item.cleanName}": ${mErr.message}`, 'error');
          }

          await new Promise(r => setTimeout(r, 120));
        }

        addLog(`Sincronização de filmes finalizada! ${inserted} adicionados | ${skipped} duplicatas evitadas.`, 'success');
        setSyncModal({
          type: 'success',
          text: `Sincronização Concluída!\n\n${inserted} novo(s) filme(s) adicionado(s) com sucesso ao Firestore.\n${skipped} duplicatas evitadas com proteção inteligente.`
        });
      } else {
        // --- SYNC DELTA DE SÉRIES E NOVOS EPISÓDIOS ---
        addLog(`Preparando payload de séries e episódios para envio à API PostgreSQL...`, 'info');
        const seriesPayload = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];

          if (item.status === 'new') {
            // Série Nova: busca capa no TMDB
            addLog(`Buscando dados no TMDB para nova série: "${item.cleanName}"...`, 'info');
            try {
              const tmdbResp = await axios.get(`https://api.themoviedb.org/3/search/tv?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(item.cleanName)}`);
              
              if (tmdbResp.data.results && tmdbResp.data.results.length > 0) {
                const tmdbData = tmdbResp.data.results[0];
                const genreNames = (tmdbData.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);

                seriesPayload.push({
                  tmdbId: tmdbData.id,
                  title: tmdbData.name || item.cleanName,
                  overview: tmdbData.overview || '',
                  posterPath: tmdbData.poster_path || null,
                  backdropPath: tmdbData.backdrop_path || null,
                  voteAverage: tmdbData.vote_average || 0,
                  releaseDate: tmdbData.first_air_date || null,
                  tags: genreNames,
                  isHighlight: false,
                  episodes: item.episodes
                });
                addLog(`TMDB OK para "${tmdbData.name}": ${item.episodes.length} episódios prontos.`, 'success');
              }
            } catch (err) {
              addLog(`Erro no TMDB para "${item.cleanName}": ${err.message}`, 'error');
            }
            await new Promise(r => setTimeout(r, 120));
          } else {
            // Série Existente com Novos Episódios: envia apenas os episódios faltantes
            addLog(`Série existente "${item.title}": enviando ${item.newEpisodesList.length} episódio(s) faltante(s)...`, 'info');
            seriesPayload.push({
              tmdbId: item.tmdbId,
              title: item.title,
              overview: item.existingInfo?.overview || '',
              posterPath: item.existingInfo?.poster_path || null,
              backdropPath: item.existingInfo?.backdrop_path || null,
              voteAverage: item.existingInfo?.vote_average || 0,
              releaseDate: item.existingInfo?.release_date || null,
              tags: item.existingInfo?.tags || [],
              isHighlight: item.existingInfo?.is_highlight || false,
              episodes: item.newEpisodesList
            });
          }
        }

        if (seriesPayload.length === 0) {
          addLog("Nenhuma série ou episódio válido para envio.", 'warn');
          setIsLoading(false);
          setActiveStep('ready');
          return;
        }

        addLog(`Enviando ${seriesPayload.length} série(s) e seus episódios para o PostgreSQL (${SERIES_API_URL}/series/sync)...`, 'info');
        
        const apiResponse = await axios.post(
          `${SERIES_API_URL}/series/sync`,
          { series: seriesPayload },
          { headers: { 'x-admin-secret': ADMIN_SECRET, 'Content-Type': 'application/json' } }
        );

        const result = apiResponse.data;
        addLog(`Sucesso no PostgreSQL! Séries sincronizadas: ${result.insertedSeries} | Novos episódios: ${result.insertedEpisodes} | Episódios mantidos: ${result.skippedEpisodes}`, 'success');

        setSyncModal({
          type: 'success',
          text: `Sincronização PostgreSQL Concluída!\n\n` +
                `📺 Séries processadas: ${result.insertedSeries}\n` +
                `🎬 Novos episódios inseridos: ${result.insertedEpisodes}\n` +
                `🛡️ Episódios existentes preservados: ${result.skippedEpisodes}`
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

  /**
   * 3. Limpeza de Duplicatas no Firestore (One-Click Cleanup)
   */
  const handleDeduplicateFirestore = async () => {
    if (!window.confirm("Deseja verificar e remover filmes duplicados existentes no Firestore?\n\nO sistema manterá a primeira cópia de cada filme e removerá apenas as repetições (por link ou TMDB).")) {
      return;
    }

    setIsLoading(true);
    addLog("Iniciando varredura de filmes duplicados no Firestore...", 'info');

    try {
      const snap = await getDocs(collection(db, 'movies'));
      addLog(`Total de documentos analisados: ${snap.size}`, 'info');

      const seenUrls = new Map();
      const seenTmdb = new Map();
      const duplicatesToDelete = [];

      snap.forEach(docSnap => {
        const d = docSnap.data();
        const id = docSnap.id;
        const url = (d.videoUrl || '').trim().toLowerCase();
        const tmdb = d.tmdbId ? String(d.tmdbId) : null;

        let isDup = false;
        if (url && seenUrls.has(url)) {
          duplicatesToDelete.push(id);
          isDup = true;
        } else if (url) {
          seenUrls.set(url, id);
        }

        if (!isDup && tmdb && seenTmdb.has(tmdb)) {
          duplicatesToDelete.push(id);
          isDup = true;
        } else if (!isDup && tmdb) {
          seenTmdb.set(tmdb, id);
        }
      });

      if (duplicatesToDelete.length === 0) {
        addLog("Nenhuma duplicata encontrada! O catálogo do Firestore está 100% limpo.", 'success');
        setSyncModal({ type: 'success', text: "Nenhuma duplicata encontrada! O catálogo está limpo." });
        setIsLoading(false);
        return;
      }

      addLog(`Detectadas ${duplicatesToDelete.length} duplicatas. Removendo com segurança em lotes...`, 'warn');

      const BATCH_SIZE = 350;
      for (let i = 0; i < duplicatesToDelete.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = duplicatesToDelete.slice(i, i + BATCH_SIZE);
        chunk.forEach(docId => {
          batch.delete(doc(db, 'movies', docId));
        });
        await batch.commit();
        addLog(`Removidas ${Math.min(i + BATCH_SIZE, duplicatesToDelete.length)} de ${duplicatesToDelete.length} duplicatas...`, 'info');
      }

      addLog(`Limpeza concluída! ${duplicatesToDelete.length} filmes repetidos foram removidos com sucesso.`, 'success');
      setSyncModal({
        type: 'success',
        text: `Limpeza Concluída com Sucesso!\n\n${duplicatesToDelete.length} filmes repetidos foram removidos do Firestore.\nAgora cada filme possui apenas um registro único.`
      });

      // Atualiza diagnóstico automaticamente
      handleLiveCheck();
    } catch (err) {
      console.error("Erro na limpeza de duplicatas:", err);
      addLog(`Erro ao limpar duplicatas: ${err.message}`, 'error');
      setSyncModal({ type: 'error', text: `Erro ao limpar duplicatas: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtragem na Tabela
  const filteredItems = items.filter(item => {
    if (filterMode === 'new' && item.status !== 'new') return false;
    if (filterMode === 'new_episodes' && item.status !== 'new_episodes') return false;
    if (filterMode === 'incomplete' && item.status !== 'incomplete') return false;
    if (filterMode === 'synced' && item.status !== 'synced') return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchClean = (item.cleanName || '').toLowerCase().includes(q);
      return matchTitle || matchClean;
    }

    return true;
  });

  // Cálculos de Paginação
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* CABEÇALHO & SELETOR DE MÍDIA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Sincronização Inteligente Baserow
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Detecção precisa de novidades, proteção anti-duplicação e sincronização delta em tempo real.
          </p>
        </div>

        {/* Alternador de Tipo de Mídia com Bordas Suaves */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-light)',
          padding: '4px',
          borderRadius: '14px',
          border: '1px solid var(--surface-border)'
        }}>
          <button
            onClick={() => { setSyncType('movie'); setItems([]); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: syncType === 'movie' ? 'white' : 'var(--text-muted)',
              background: syncType === 'movie' ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'transparent',
              boxShadow: syncType === 'movie' ? '0 4px 12px var(--primary-glow)' : 'none',
              transition: 'all 0.25s'
            }}
          >
            <Film size={18} />
            Filmes (Firestore)
          </button>
          <button
            onClick={() => { setSyncType('series'); setItems([]); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: syncType === 'series' ? 'white' : 'var(--text-muted)',
              background: syncType === 'series' ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'transparent',
              boxShadow: syncType === 'series' ? '0 4px 12px var(--primary-glow)' : 'none',
              transition: 'all 0.25s'
            }}
          >
            <Tv size={18} />
            Séries & Episódios (PostgreSQL)
          </button>
        </div>
      </div>

      {/* CARD DE CONTROLE E AÇÕES PRINCIPAIS */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: syncType === 'movie' ? 'rgba(0, 212, 255, 0.12)' : 'rgba(123, 47, 247, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: syncType === 'movie' ? 'var(--accent)' : 'var(--primary-light)'
          }}>
            <Database size={26} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>
              Conexão: Baserow API
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px' }}>
              URL: <code style={{ color: 'var(--accent)' }}>{baserowConfig?.baseUrl || 'https://db.leflow.com.br/api'}</code> • 
              Tabela {syncType === 'movie' ? 'Filmes' : 'Séries'}: <strong style={{ color: 'white' }}>{syncType === 'movie' ? baserowConfig?.moviesTableId : baserowConfig?.seriesTableId}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {syncType === 'movie' && (
            <button
              onClick={handleDeduplicateFirestore}
              disabled={isLoading}
              className="btn-secondary"
              style={{ borderRadius: '12px', color: '#FBBF24', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              title="Varre e remove filmes duplicados no Firestore"
            >
              <Trash2 size={16} />
              Limpar Duplicados no Firestore
            </button>
          )}

          <button
            onClick={handleLiveCheck}
            disabled={isLoading}
            className="btn-secondary"
            style={{ borderRadius: '12px' }}
          >
            <Search size={18} />
            {isLoading && activeStep === 'scanning' ? 'Verificando...' : 'Verificar Status ao Vivo'}
          </button>

          {stats.newItems > 0 || stats.newEpisodes > 0 || stats.incompleteSeries > 0 ? (
            <button
              onClick={() => handleSmartSync(false)}
              disabled={isLoading}
              className="btn-primary"
              style={{ borderRadius: '12px' }}
            >
              <Zap size={18} />
              {isLoading && activeStep === 'syncing' 
                ? 'Sincronizando...' 
                : `Sincronizar Novidades (${stats.newItems + stats.newEpisodes + stats.incompleteSeries})`
              }
            </button>
          ) : null}
        </div>
      </div>

      {/* DASHBOARD DE ESTATÍSTICAS AO VIVO */}
      {stats.totalBaserow > 0 && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(123, 47, 247, 0.15)', color: 'var(--primary-light)' }}>
              <Layers size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalBaserow}</div>
              <div className="stat-label">Total no Baserow</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              <CheckCircle size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.alreadySynced}</div>
              <div className="stat-label">Já Sincronizados</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper" style={{ background: 'rgba(0, 212, 255, 0.15)', color: 'var(--accent)' }}>
              <Zap size={24} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.newItems}</div>
              <div className="stat-label">{syncType === 'movie' ? 'Filmes Novos' : 'Séries Novas'}</div>
            </div>
          </div>

          {syncType === 'series' && stats.newEpisodes > 0 && (
            <div className="stat-card">
              <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }}>
                <PlayCircle size={24} />
              </div>
              <div className="stat-info">
                <div className="stat-value">{stats.newEpisodes}</div>
                <div className="stat-label">Novos Episódios</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TERMINAL DE LOGS AO VIVO (COM CONTROLES E SEM SCROLL NA JANELA) */}
      {liveLogs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <Terminal size={16} style={{ color: 'var(--accent)' }} />
              <span>Processo ao Vivo (Live Terminal)</span>
              <span className="pulse-indicator" style={{ backgroundColor: isLoading ? '#00D4FF' : '#10B981' }}></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAutoScrollTerminal(!autoScrollTerminal)}
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: autoScrollTerminal ? 'rgba(0, 212, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  color: autoScrollTerminal ? 'var(--accent)' : 'var(--text-muted)',
                  border: '1px solid var(--surface-border)'
                }}
                title="Ativar/desativar rolagem automática"
              >
                {autoScrollTerminal ? '● Auto-scroll Ativo' : '○ Auto-scroll Pausado'}
              </button>
              <button
                type="button"
                onClick={() => setLiveLogs([])}
                style={{
                  fontSize: '0.75rem',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--surface-border)'
                }}
                title="Limpar mensagens do terminal"
              >
                Limpar
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {liveLogs.length} eventos registrados
              </span>
            </div>
          </div>

          <div className="live-terminal" ref={terminalBoxRef}>
            {liveLogs.map((log, idx) => (
              <div key={idx} className="terminal-line">
                <span className="terminal-time">[{log.time}]</span>
                <span className={`terminal-type-${log.type}`}>
                  [{log.type.toUpperCase()}]
                </span>
                <span>{log.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABELA DE ITENS COM FILTROS & PAGINAÇÃO */}
      {items.length > 0 && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {/* Barra de Filtros e Busca */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('all')}
                style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '10px' }}
              >
                Todos ({items.length})
              </button>
              <button
                className={filterMode === 'new' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('new')}
                style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '10px' }}
              >
                Novos ({stats.newItems})
              </button>
              {syncType === 'series' && (
                <button
                  className={filterMode === 'new_episodes' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setFilterMode('new_episodes')}
                  style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '10px' }}
                >
                  Novos Episódios ({stats.newEpisodes})
                </button>
              )}
              <button
                className={filterMode === 'synced' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('synced')}
                style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '10px' }}
              >
                Em Dia ({stats.alreadySynced})
              </button>
            </div>

            <div style={{ position: 'relative', minWidth: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.85rem', borderRadius: '10px' }}
              />
            </div>
          </div>

          {/* Tabela de Resultados */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 16px' }}>Nome / Título</th>
                  {syncType === 'series' && <th style={{ padding: '14px 16px' }}>Episódios no Baserow</th>}
                  {syncType === 'series' && <th style={{ padding: '14px 16px' }}>Episódios no Banco</th>}
                  {syncType === 'movie' && <th style={{ padding: '14px 16px' }}>Link de Reprodução</th>}
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Ações / Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item, idx) => {
                  const isExpanded = expandedSeries[item.id];

                  return (
                    <React.Fragment key={item.id || idx}>
                      <tr style={{ borderBottom: '1px solid var(--surface-border)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '14px 16px' }}>
                          {item.status === 'new' && (
                            <span className="badge badge-new">
                              <Zap size={12} /> Novo
                            </span>
                          )}
                          {item.status === 'new_episodes' && (
                            <span className="badge badge-warning">
                              <PlayCircle size={12} /> +{item.newEpisodesList?.length || 0} Novos
                            </span>
                          )}
                          {item.status === 'incomplete' && (
                            <span className="badge badge-danger">
                              <AlertTriangle size={12} /> 0 Episódios
                            </span>
                          )}
                          {item.status === 'synced' && (
                            <span className="badge badge-success">
                              <CheckCircle size={12} /> Atualizado
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <div>{item.title}</div>
                          {item.rawName && item.rawName !== item.title && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              Original: {item.rawName}
                            </div>
                          )}
                        </td>

                        {syncType === 'series' && (
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{item.baserowCount}</strong> eps
                          </td>
                        )}

                        {syncType === 'series' && (
                          <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                            {item.status === 'new' ? (
                              <span style={{ color: 'var(--text-muted)' }}>Ainda não criado</span>
                            ) : (
                              <span><strong style={{ color: '#34D399' }}>{item.dbEpisodeCount || 0}</strong> cadastrados</span>
                            )}
                          </td>
                        )}

                        {syncType === 'movie' && (
                          <td style={{ padding: '14px 16px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.playbackUrl}
                          </td>
                        )}

                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {syncType === 'series' && item.episodes?.length > 0 && (
                            <button
                              onClick={() => setExpandedSeries(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {isExpanded ? 'Ocultar' : 'Ver Episódios'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Visualização detalhada de episódios */}
                      {syncType === 'series' && isExpanded && (
                        <tr style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                          <td colSpan={5} style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
                                Lista de Episódios Mapeados no Baserow ({item.episodes.length}):
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                                {item.episodes.map((ep, eIdx) => {
                                  const isNewEp = item.newEpisodesList?.some(
                                    ne => ne.seasonNumber === ep.seasonNumber && ne.episodeNumber === ep.episodeNumber
                                  );

                                  return (
                                    <div 
                                      key={eIdx} 
                                      style={{
                                        background: isNewEp ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                        border: isNewEp ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--surface-border)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ color: isNewEp ? '#FBBF24' : 'var(--text-primary)' }}>
                                          T{ep.seasonNumber} : E{ep.episodeNumber}
                                        </strong>
                                        {isNewEp && (
                                          <span style={{ fontSize: '0.7rem', color: '#FBBF24', fontWeight: 700 }}>
                                            NOVO
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '4px' }}>
                                        {ep.videoUrl}
                                      </div>
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

          {/* BARRA DE PAGINAÇÃO COMPLETA E ELEGANTE */}
          <div className="pagination-container" style={{ marginTop: '14px', borderRadius: '12px' }}>
            <div className="pagination-info">
              Mostrando <strong style={{ color: 'var(--text-primary)' }}>{filteredItems.length === 0 ? 0 : startIndex + 1}</strong> até <strong style={{ color: 'var(--text-primary)' }}>{Math.min(startIndex + itemsPerPage, filteredItems.length)}</strong> de <strong style={{ color: 'var(--text-primary)' }}>{filteredItems.length}</strong> {syncType === 'movie' ? 'filmes' : 'séries'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Itens por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="pagination-select"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage === 1}
                  title="Primeira Página"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={validCurrentPage === 1}
                  title="Página Anterior"
                >
                  &lsaquo;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalPages || Math.abs(page - validCurrentPage) <= 2;
                  })
                  .map((page, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                        <button
                          type="button"
                          className={`pagination-btn ${page === validCurrentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })
                }

                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={validCurrentPage === totalPages}
                  title="Próxima Página"
                >
                  &rsaquo;
                </button>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage === totalPages}
                  title="Última Página"
                >
                  &raquo;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RESULTADO / NOTIFICAÇÃO */}
      {syncModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--surface-border-bright)',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ padding: '24px', background: syncModal.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '50%',
                  background: syncModal.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: syncModal.type === 'success' ? '#34D399' : '#F87171'
                }}>
                  {syncModal.type === 'success' ? <CheckCircle size={28} /> : <AlertTriangle size={28} />}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>
                  {syncModal.type === 'success' ? 'Operação Realizada' : 'Aviso do Sistema'}
                </h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                {syncModal.text}
              </p>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)' }}>
              <button
                onClick={() => setSyncModal(null)}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default BaserowSync;
