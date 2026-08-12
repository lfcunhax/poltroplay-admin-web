import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import axios from 'axios';
import { Database, Search, CheckCircle, AlertTriangle, UploadCloud, Trash2 } from 'lucide-react';

const DEFAULT_TMDB_KEY = '384caf4e90af984a7c5595ea5d9bb386';

function BaserowSync() {
  // Configs
  const [baserowConfig, setBaserowConfig] = useState(null);
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncType, setSyncType] = useState('movie'); // 'movie' or 'series'
  const [streams, setStreams] = useState([]); 
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });
  const [matchedStreams, setMatchedStreams] = useState([]); 
  const [manualQueries, setManualQueries] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'matched', 'unmatched'

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

  // 1. Fetch from Baserow
  const handleAutoSync = async (e) => {
    e.preventDefault();
    if (!baserowConfig || !baserowConfig.token || !baserowConfig.baseUrl) {
      alert("Configure as credenciais do Baserow primeiro em Configurações.");
      return;
    }
    if (!window.confirm(`Iniciar Sincronização Inteligente 1-Click para ${syncType === 'movie' ? 'Filmes' : 'Séries'}?\\nIsso vai baixar, bater no TMDB e salvar no Firebase automaticamente apenas os resultados válidos.`)) return;

    setLoading(true);
    setSyncProgress({ current: 0, total: 0, status: 'Iniciando Auto-Sync...' });
    
    try {
      const tableId = syncType === 'movie' ? baserowConfig.moviesTableId : baserowConfig.seriesTableId;
      let baseUrl = baserowConfig.baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
      let nextPageUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
      
      let allRows = [];
      let pageCount = 1;

      while (nextPageUrl) {
        setSyncProgress({ current: pageCount, total: '?', status: 'Baixando do Baserow...' });
        const response = await axios.get(nextPageUrl, {
          headers: { Authorization: `Token ${baserowConfig.token}` }
        });
        allRows = [...allRows, ...response.data.results];
        
        if (response.data.next) {
          pageCount++;
          let nextUrl = response.data.next;
          if (nextUrl && baseUrl.startsWith('https://') && nextUrl.startsWith('http://')) {
            nextUrl = nextUrl.replace(/^http:\/\//i, 'https://');
          }
          nextPageUrl = nextUrl;
        } else {
          break; 
        }
      }

      setSyncProgress({ current: 0, total: allRows.length, status: 'Filtrando lixo e Canais de TV...' });
      const tvKeywords = ['espn', 'premiere', 'telecine', 'hbo', 'sportv', 'globo', 'sbt', 'record', 'band', 'cnn', 'fox sports', 'discovery', 'history', 'tnt', 'space', 'megapix', 'cinemax', 'paramount', 'a&e', 'axn', 'warner', 'sony', 'universal', 'syfy', 'amc', 'fox', 'fx', 'multishow', 'viva', 'gnt', 'bis', 'off', 'combate', 'conmebol', 'dazn', 'ufc', 'bbb', 'fazenda', 'playboy', 'sexy hot', 'venus', 'sex prive', 'band news', 'record news', 'tv', 'ao vivo', '24h', 'futebol', 'campeonato', 'novela'];
      
      const validRows = allRows.filter(row => {
        const link = (row.Link || row.link || row.Url || row.url || '').trim().toLowerCase();
        const nome = (row.Nome || row.nome || row.Name || row.name || '').trim().toLowerCase();
        
        if (!link.startsWith('http')) return false; 
        if (link.includes('.m3u8') || link.includes('.ts')) return false; 
        
        const isTvChannel = tvKeywords.some(kw => new RegExp(`\\\\b${kw}\\\\b`, 'i').test(nome));
        if (isTvChannel) return false;
        
        return true;
      });

      const parsedStreams = validRows.map(row => {
        const nome = row.Nome || row.nome || row.Name || row.name || '';
        const link = row.Link || row.link || row.Url || row.url || '';
        let limpo = nome.split(' - ')[0].split(' – ')[0].replace(/\[.*?\]|\(.*?\)/g, '').trim();
        return { id: row.id, rawName: nome, cleanName: limpo, playbackUrl: link.trim() };
      }).filter(s => s.cleanName !== '');

      setSyncProgress({ current: 0, total: parsedStreams.length, status: 'Verificando no TMDB...' });
      const genreMap = {
        28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
        99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
        36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
        10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
        53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste',
        10759: 'Ação e Aventura', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 
        10765: 'Sci-Fi e Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
      };

      let matched = [];
      const uniqueSeriesNames = syncType === 'series' ? [...new Set(parsedStreams.map(s => s.cleanName))] : [];
      const itemsToSearch = syncType === 'movie' ? parsedStreams : uniqueSeriesNames.map(name => ({ cleanName: name }));

      for (let i = 0; i < itemsToSearch.length; i++) {
        const itemToSearch = itemsToSearch[i];
        setSyncProgress(prev => ({ ...prev, current: i + 1, total: itemsToSearch.length }));
        
        try {
          const tmdbType = syncType === 'movie' ? 'movie' : 'tv';
          const response = await axios.get(`https://api.themoviedb.org/3/search/${tmdbType}?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(itemToSearch.cleanName)}`);
          
          if (response.data.results && response.data.results.length > 0) {
            const tmdbData = response.data.results[0]; 
            const genreNames = (tmdbData.genre_ids || []).map(id => genreMap[id]).filter(name => name); 

            const tmdbInfo = {
              tmdbId: tmdbData.id, title: tmdbData.title || tmdbData.name, overview: tmdbData.overview,
              posterPath: tmdbData.poster_path, backdropPath: tmdbData.backdrop_path,
              voteAverage: tmdbData.vote_average, releaseDate: tmdbData.release_date || tmdbData.first_air_date,
              tmdbTags: genreNames, matched: true
            };

            if (syncType === 'movie') {
              matched.push({ ...itemToSearch, ...tmdbInfo });
            } else {
              const epis = parsedStreams.filter(s => s.cleanName === itemToSearch.cleanName);
              epis.forEach(epi => matched.push({ ...epi, ...tmdbInfo }));
            }
          }
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 200)); 
      }

      const toSync = matched.filter(s => s.matched);
      setSyncProgress({ current: 0, total: toSync.length, status: 'Salvando no Banco de Dados...' });
      
      if (syncType === 'movie') {
        for (let i = 0; i < toSync.length; i++) {
          const stream = toSync[i];
          setSyncProgress(prev => ({ ...prev, current: i + 1 }));
          const q = query(collection(db, 'movies'), where('tmdbId', '==', stream.tmdbId));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) continue; 

          const combinedTags = [...(typeof stream !== 'undefined' ? stream.tmdbTags : (typeof data !== 'undefined' && data.info ? data.info.tmdbTags : (typeof seriesData !== 'undefined' && seriesData.info ? seriesData.info.tmdbTags : []))) || []];
          await addDoc(collection(db, 'movies'), {
            tmdbId: stream.tmdbId, title: stream.title, overview: stream.overview || '',
            posterPath: stream.posterPath || null, backdropPath: stream.backdropPath || null,
            voteAverage: stream.voteAverage || 0, releaseDate: stream.releaseDate || null,
            videoUrl: stream.playbackUrl || '', tags: combinedTags, isHighlight: false,
            source: 'baserow', createdAt: serverTimestamp()
          });
        }
      } else {
        const seriesMap = {};
        toSync.forEach(stream => {
          if (!seriesMap[stream.tmdbId]) { seriesMap[stream.tmdbId] = { info: stream, episodes: [] }; }
          seriesMap[stream.tmdbId].episodes.push(stream);
        });

        const seriesKeys = Object.keys(seriesMap);
        for (let i = 0; i < seriesKeys.length; i++) {
          const sId = seriesKeys[i];
          setSyncProgress(prev => ({ ...prev, current: i + 1, total: seriesKeys.length }));
          const data = seriesMap[sId];
          
          let seriesDocRef;
          const q = query(collection(db, 'series'), where('tmdbId', '==', data.info.tmdbId));
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.empty) {
            const combinedTags = [...(typeof stream !== 'undefined' ? stream.tmdbTags : (typeof data !== 'undefined' && data.info ? data.info.tmdbTags : (typeof seriesData !== 'undefined' && seriesData.info ? seriesData.info.tmdbTags : []))) || []];
            seriesDocRef = await addDoc(collection(db, 'series'), {
              tmdbId: data.info.tmdbId, title: data.info.title, overview: data.info.overview || '',
              posterPath: data.info.posterPath || null, backdropPath: data.info.backdropPath || null,
              voteAverage: data.info.voteAverage || 0, releaseDate: data.info.releaseDate || null,
              tags: combinedTags, isHighlight: false, source: 'baserow', createdAt: serverTimestamp()
            });
          } else {
            seriesDocRef = querySnapshot.docs[0].ref;
          }

          for (const epi of data.episodes) {
            const epiRef = doc(seriesDocRef, 'episodes', epi.id.toString());
            const epiSnap = await getDoc(epiRef);
            if (!epiSnap.exists()) {
              await setDoc(epiRef, {
                title: epi.rawName, videoUrl: epi.playbackUrl || '',
                createdAt: serverTimestamp()
              });
            }
          }
        }
      }

      alert("🎉 Auto-Sync Inteligente Concluído com Sucesso!");
      setStreams(parsedStreams);
      setMatchedStreams(matched);
      setSyncProgress({ current: 0, total: 0, status: '' });
      setIsConnected(true);
    } catch (error) {
      console.error(error);
      alert(`Erro no Auto-Sync: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  const handleConnect = async (e) => {
    e.preventDefault();
    if (!baserowConfig || !baserowConfig.token || !baserowConfig.baseUrl) {
      alert("Configurações do Baserow incompletas. Vá para a tela de Configurações.");
      return;
    }
    
    const tableId = syncType === 'movie' ? baserowConfig.moviesTableId : baserowConfig.seriesTableId;
    if (!tableId) {
      alert("Preencha o ID da Tabela correspondente nas Configurações.");
      return;
    }

    setLoading(true);
    setSyncProgress({ current: 0, total: 0, status: 'Conectando ao Baserow...' });
    try {
      const cleanToken = baserowConfig.token.replace(/^Token\s+/i, '').trim();
      // Limpa qualquer '/api' ou '/' do final da URL, não importa como foi digitado
      const baseUrl = baserowConfig.baseUrl.replace(/(\/api\/?|\/)$/i, '');
      
      let allRows = [];
      // Fazemos a chamada direto para a URL base (sem o proxy do vite, para funcionar em VPS próprio)
      let nextPageUrl = `${baseUrl}/api/database/rows/table/${tableId}/?user_field_names=true&size=200`;
      
      while (nextPageUrl) {
        setSyncProgress({ current: allRows.length, total: 0, status: `Baixando do Baserow... (${allRows.length} itens)` });

        const response = await axios.get(nextPageUrl, {
          headers: { Authorization: `Token ${cleanToken}` }
        });
        
        if (response.data && response.data.results) {
          allRows = [...allRows, ...response.data.results];
          let nextUrl = response.data.next; // URL for the next page, null if last page
          if (nextUrl && baseUrl.startsWith('https://') && nextUrl.startsWith('http://')) {
            nextUrl = nextUrl.replace(/^http:\/\//i, 'https://');
          }
          nextPageUrl = nextUrl;
        } else {
          break; // Error or unexpected response
        }
      }
      
      if (allRows.length > 0) {
        // Filtro agressivo de canais de TV
        const tvKeywords = ['espn', 'premiere', 'telecine', 'hbo', 'sportv', 'globo', 'sbt', 'record', 'band', 'cnn', 'fox sports', 'discovery', 'history', 'tnt', 'space', 'megapix', 'cinemax', 'paramount', 'a&e', 'axn', 'warner', 'sony', 'universal', 'syfy', 'amc', 'fox', 'fx', 'multishow', 'viva', 'gnt', 'bis', 'off', 'combate', 'conmebol', 'dazn', 'ufc', 'bbb', 'fazenda', 'playboy', 'sexy hot', 'venus', 'sex prive', 'band news', 'record news', 'tv', 'ao vivo'];
        
        const validRows = allRows.filter(row => {
          const link = (row.Link || row.link || '').trim().toLowerCase();
          const nome = (row.Nome || row.nome || row.Name || row.name || '').trim().toLowerCase();
          
          // 1. Ignorar se o link for vazio
          if (link === '') return false;
          
          // 2. Ignorar se o link for formato de TV Ao Vivo (.m3u8 ou .ts)
          if (link.includes('.m3u8') || link.includes('.ts')) return false;
          
          // 3. Ignorar se o nome contiver palavras-chave de canais
          // Usamos expressão regular com word boundary (\b) para não bloquear filmes acidentalmente (ex: "Space Jam" não deve ser bloqueado por "space")
          // No entanto, para simplificar e ser agressivo, verificaremos inclusão direta para a maioria.
          // Para palavras perigosas como 'tv' ou 'fox', o ideal seria \b, mas faremos a checagem básica primeiro.
          const isTvChannel = tvKeywords.some(kw => {
             // Checar se a palavra está isolada ou é o nome exato do canal
             const regex = new RegExp(`\\b${kw}\\b`, 'i');
             return regex.test(nome);
          });
          
          if (isTvChannel) return false;
          
          return true;
        });

        // Mapear colunas Nome e Link
        const parsedStreams = validRows.map(row => {
          const nome = row.Nome || row.nome || row.Name || row.name || '';
          const link = row.Link || row.link || '';
          
          // Limpeza agressiva para melhorar a busca no TMDB (remove subtítulos após " - " ou " – " e remove texto entre parênteses)
          let limpo = nome.split(' - ')[0].split(' – ')[0];
          limpo = limpo.replace(/\[.*?\]|\(.*?\)/g, '').trim();
          
          return {
            id: row.id,
            rawName: nome,
            cleanName: limpo,
            playbackUrl: link.trim(),
          };
        }).filter(s => s.cleanName !== '');

        setStreams(parsedStreams);
        setIsConnected(true);
        setSyncProgress({ current: 0, total: 0, status: '' });
      } else {
        alert("Resposta inválida do Baserow. Nenhuma linha encontrada.");
      }
    } catch (error) {
      console.error(error);
      let errorMsg = error.message;
      let status = error.response ? error.response.status : 'Nenhum (Bloqueio de Rede/CORS)';
      let detail = error.response?.data?.detail || error.response?.data?.error || '';
      
      alert(`Erro no Baserow!\nStatus: ${status}\nMensagem: ${errorMsg}\nDetalhe: ${detail}\nVeja o console (F12) para mais dados.`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Enrich with TMDB
  const handleMatchTmdb = async () => {
    setLoading(true);
    setSyncProgress({ current: 0, total: streams.length, status: 'Buscando capas no TMDB...' });
    
    const genreMap = {
      28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
      99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
      36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
      10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
      53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste',
      10759: 'Ação e Aventura', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 
      10765: 'Sci-Fi e Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    let matched = [];
    
    // Agrupar por nome no caso de séries para não bater na API do TMDB toda hora para o mesmo episódio
    const uniqueSeriesNames = syncType === 'series' 
      ? [...new Set(streams.map(s => s.cleanName))] 
      : [];
    
    const itemsToSearch = syncType === 'movie' ? streams : uniqueSeriesNames.map(name => ({ cleanName: name }));

    for (let i = 0; i < itemsToSearch.length; i++) {
      const itemToSearch = itemsToSearch[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1, total: itemsToSearch.length }));
      
      try {
        const tmdbType = syncType === 'movie' ? 'movie' : 'tv';
        const response = await axios.get(`https://api.themoviedb.org/3/search/${tmdbType}?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(itemToSearch.cleanName)}`);
        
        if (response.data.results && response.data.results.length > 0) {
          const tmdbData = response.data.results[0]; // Melhor resultado
          
          const genreNames = (tmdbData.genre_ids || [])
            .map(id => genreMap[id])
            .filter(name => name); 

          const tmdbInfo = {
            tmdbId: tmdbData.id,
            title: tmdbData.title || tmdbData.name,
            overview: tmdbData.overview,
            posterPath: tmdbData.poster_path,
            backdropPath: tmdbData.backdrop_path,
            voteAverage: tmdbData.vote_average,
            releaseDate: tmdbData.release_date || tmdbData.first_air_date,
            tmdbTags: genreNames,
            matched: true
          };

          if (syncType === 'movie') {
            matched.push({ ...itemToSearch, ...tmdbInfo });
          } else {
            // Se for série, aplica o tmdbInfo para TODOS os episódios com este nome
            const epis = streams.filter(s => s.cleanName === itemToSearch.cleanName);
            epis.forEach(epi => {
              matched.push({ ...epi, ...tmdbInfo });
            });
          }
        } else {
          if (syncType === 'movie') {
            matched.push({ ...itemToSearch, matched: false });
          } else {
             const epis = streams.filter(s => s.cleanName === itemToSearch.cleanName);
             epis.forEach(epi => matched.push({ ...epi, matched: false }));
          }
        }
      } catch (e) {
        // Erro
      }
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay p/ não tomar block
    }
    
    setMatchedStreams(matched);
    setSyncProgress({ current: 0, total: 0, status: 'Busca concluída!' });
    setLoading(false);
  };

  // 2.5 Manual Search
  const handleManualSearch = async (streamId, originalName) => {
    const queryStr = manualQueries[streamId] || '';
    if (!queryStr.trim()) {
      alert("Digite um nome alternativo ou um ID numérico do TMDB.");
      return;
    }
    
    setLoading(true);
    const isId = /^\d+$/.test(queryStr.trim());
    const tmdbType = syncType === 'movie' ? 'movie' : 'tv';
    
    const genreMap = {
      28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
      99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
      36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
      10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
      53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste',
      10759: 'Ação e Aventura', 10762: 'Kids', 10763: 'News', 10764: 'Reality', 
      10765: 'Sci-Fi e Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics'
    };

    try {
      let tmdbData = null;
      if (isId) {
        const response = await axios.get(`https://api.themoviedb.org/3/${tmdbType}/${queryStr.trim()}?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR`);
        if (response.data) tmdbData = response.data;
      } else {
        const response = await axios.get(`https://api.themoviedb.org/3/search/${tmdbType}?api_key=${baserowConfig?.tmdbKey || DEFAULT_TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(queryStr.trim())}`);
        if (response.data.results && response.data.results.length > 0) {
          tmdbData = response.data.results[0]; // Pega o primeiro
        }
      }

      if (tmdbData) {
        // Quando busca por ID, a API retorna "genres" com os nomes direto. Quando busca por nome, retorna "genre_ids".
        const genreNames = tmdbData.genres 
          ? tmdbData.genres.map(g => g.name) 
          : (tmdbData.genre_ids || []).map(id => genreMap[id]).filter(name => name);
        
        const tmdbInfo = {
          tmdbId: tmdbData.id,
          title: tmdbData.title || tmdbData.name,
          overview: tmdbData.overview,
          posterPath: tmdbData.poster_path,
          backdropPath: tmdbData.backdrop_path,
          voteAverage: tmdbData.vote_average,
          releaseDate: tmdbData.release_date || tmdbData.first_air_date,
          tmdbTags: genreNames,
          matched: true
        };
        
        setMatchedStreams(prev => prev.map(s => {
          if (syncType === 'series' && s.cleanName === originalName) {
            return { ...s, ...tmdbInfo }; // Sincroniza todos os eps da mesma série
          }
          if (syncType === 'movie' && s.id === streamId) {
            return { ...s, ...tmdbInfo };
          }
          return s;
        }));
        
        // Limpa a query de busca manual para essa linha
        setManualQueries(prev => ({...prev, [streamId]: ''}));
        
      } else {
        alert("Nenhum resultado encontrado no TMDB para essa busca.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro na busca manual. Se estiver usando ID, verifique se ele existe.");
    }
    setLoading(false);
  };

  // 3. Save to Firebase
  const handleSyncFirebase = async () => {
    const toSync = matchedStreams.filter(s => s.matched);
    if (toSync.length === 0) return;
    
    if (!window.confirm(`Sincronizar para o Firebase?`)) return;

    setLoading(true);

    try {
      if (syncType === 'movie') {
        setSyncProgress({ current: 0, total: toSync.length, status: 'Salvando Filmes...' });
        for (let i = 0; i < toSync.length; i++) {
          const stream = toSync[i];
          setSyncProgress(prev => ({ ...prev, current: i + 1 }));
          
          // Anti-duplicação
          const q = query(collection(db, 'movies'), where('tmdbId', '==', stream.tmdbId));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) continue; 

          const combinedTags = [...(typeof stream !== 'undefined' ? stream.tmdbTags : (typeof data !== 'undefined' && data.info ? data.info.tmdbTags : (typeof seriesData !== 'undefined' && seriesData.info ? seriesData.info.tmdbTags : []))) || []];

          await addDoc(collection(db, 'movies'), {
            tmdbId: stream.tmdbId,
            title: stream.title,
            overview: stream.overview || '',
            posterPath: stream.posterPath || null,
            backdropPath: stream.backdropPath || null,
            voteAverage: stream.voteAverage || 0,
            releaseDate: stream.releaseDate || null,
            videoUrl: stream.playbackUrl || '',
            tags: combinedTags,
            isHighlight: false,
            source: 'baserow',
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Processar SÉRIES e EPISÓDIOS
        // Agrupar por série (tmdbId)
        const seriesMap = {};
        toSync.forEach(stream => {
          if (!seriesMap[stream.tmdbId]) {
            seriesMap[stream.tmdbId] = {
              info: stream,
              episodes: []
            };
          }
          seriesMap[stream.tmdbId].episodes.push(stream);
        });

        const seriesKeys = Object.keys(seriesMap);
        setSyncProgress({ current: 0, total: seriesKeys.length, status: 'Salvando Séries e Episódios...' });

        for (let i = 0; i < seriesKeys.length; i++) {
          const seriesData = seriesMap[seriesKeys[i]];
          setSyncProgress(prev => ({ ...prev, current: i + 1 }));
          
          // 1. Checar se a série já existe
          const q = query(collection(db, 'series'), where('tmdbId', '==', seriesData.info.tmdbId));
          const querySnapshot = await getDocs(q);
          
          let seriesDocId = null;
          
          if (!querySnapshot.empty) {
            seriesDocId = querySnapshot.docs[0].id; // Já existe, pegar o ID
          } else {
            // Criar nova série
            const combinedTags = [...(typeof stream !== 'undefined' ? stream.tmdbTags : (typeof data !== 'undefined' && data.info ? data.info.tmdbTags : (typeof seriesData !== 'undefined' && seriesData.info ? seriesData.info.tmdbTags : []))) || []];
            const docRef = await addDoc(collection(db, 'series'), {
              tmdbId: seriesData.info.tmdbId,
              title: seriesData.info.title,
              overview: seriesData.info.overview || '',
              posterPath: seriesData.info.posterPath || null,
              backdropPath: seriesData.info.backdropPath || null,
              voteAverage: seriesData.info.voteAverage || 0,
              releaseDate: seriesData.info.releaseDate || null,
              numberOfSeasons: 0, // Será calculado
              numberOfEpisodes: seriesData.episodes.length,
              tags: combinedTags,
              isHighlight: false,
              source: 'baserow',
              createdAt: serverTimestamp()
            });
            seriesDocId = docRef.id;
          }

          // 2. Salvar episódios processando o Link com Regex (1x1.mp4)
          let maxSeason = 0;
          for (const epi of seriesData.episodes) {
            let seasonNum = 1;
            let episodeNum = 1;
            
            // Regex para pegar 1x1, 2x05, 03x12, etc no meio do link
            const match = epi.playbackUrl.match(/(\d+)x(\d+)/i);
            if (match) {
              seasonNum = parseInt(match[1], 10);
              episodeNum = parseInt(match[2], 10);
            }
            
            if (seasonNum > maxSeason) maxSeason = seasonNum;

            await addDoc(collection(db, `series/${seriesDocId}/episodes`), {
              title: `Episódio ${episodeNum}`,
              seasonNumber: seasonNum,
              episodeNumber: episodeNum,
              videoUrl: epi.playbackUrl,
              source: 'baserow',
              createdAt: serverTimestamp()
            });
          }
        }
      }
      
      alert("Sincronização concluída com sucesso!");
      setStreams([]);
      setMatchedStreams([]);
      setIsConnected(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar no banco.");
    } finally {
      setSyncProgress({ current: 0, total: 0, status: '' });
      setLoading(false);
    }
  };

  const handleDeleteBaserowData = async () => {
    if (!window.confirm("ATENÇÃO: Isso apagará TODOS os filmes e séries que foram importados via Baserow. Conteúdos manuais serão mantidos. Continuar?")) return;
    
    setLoading(true);
    setSyncProgress({ current: 0, total: 100, status: 'Apagando dados (pode demorar)...' });
    
    try {
      // Deletar filmes
      const qMovies = query(collection(db, 'movies'), where('source', '==', 'baserow'));
      const snapMovies = await getDocs(qMovies);
      const batchMovies = writeBatch(db);
      snapMovies.docs.forEach(doc => batchMovies.delete(doc.ref));
      await batchMovies.commit();

      // Séries (Nota: idealmente precisamos deletar os episódios subcoleção antes, mas para simplicidade apagaremos o doc pai da série)
      // Como o firestore não deleta subcoleções automaticamente, em prod precisaria de uma cloud function ou script recursivo.
      // Aqui deletaremos as séries 'baserow' para sumirem do App.
      const qSeries = query(collection(db, 'series'), where('source', '==', 'baserow'));
      const snapSeries = await getDocs(qSeries);
      const batchSeries = writeBatch(db);
      snapSeries.docs.forEach(doc => batchSeries.delete(doc.ref));
      await batchSeries.commit();

      alert("Limpeza concluída!");
    } catch (e) {
      console.error(e);
      alert("Erro ao limpar dados.");
    } finally {
      setLoading(false);
      setSyncProgress({ current: 0, total: 0, status: '' });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Sincronização Baserow</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Integração via API com seu banco de dados Baserow.</p>
        </div>
        <button 
          onClick={handleDeleteBaserowData}
          disabled={loading}
          style={{ background: 'var(--accent-alt)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Trash2 size={18} /> Apagar tudo do Baserow
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button 
          className={syncType === 'movie' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setSyncType('movie'); setIsConnected(false); setStreams([]); setMatchedStreams([]); }}
          style={{ flex: 1, padding: '16px' }}
        >
          🎬 Tabela de Filmes
        </button>
        <button 
          className={syncType === 'series' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => { setSyncType('series'); setIsConnected(false); setStreams([]); setMatchedStreams([]); }}
          style={{ flex: 1, padding: '16px' }}
        >
          📺 Tabela de Séries
        </button>
      </div>

      {!baserowConfig ? (
        <div style={{ padding: '24px', backgroundColor: 'rgba(233, 69, 96, 0.1)', border: '1px solid var(--accent-alt)', borderRadius: '12px', textAlign: 'center' }}>
          <AlertTriangle size={32} color="var(--accent-alt)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: 'white' }}>Configurações Pendentes</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Você precisa configurar a URL do Baserow e o Token antes de sincronizar.</p>
          <Link to="/settings" className="btn-primary" style={{ display: 'inline-flex', padding: '10px 20px', textDecoration: 'none' }}>
            Ir para Configurações
          </Link>
        </div>
      ) : !isConnected ? (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={24} color="var(--accent)" /> Conectar API
          </h2>
                    <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>URL Base: <strong style={{ color: 'white' }}>{baserowConfig.baseUrl}</strong></span>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Tabela Alvo: <strong style={{ color: 'white' }}>{syncType === 'movie' ? baserowConfig.moviesTableId : baserowConfig.seriesTableId}</strong></span>
              <Link to="/settings" style={{ fontSize: '12px', color: 'var(--accent)' }}>Alterar nas configurações</Link>
            </div>
            
            <button type="button" onClick={handleAutoSync} className="btn-primary" disabled={loading} style={{ marginTop: '8px', justifyContent: 'center', background: '#4CAF50', border: 'none', padding: '16px', fontSize: '16px', fontWeight: 'bold' }}>
              {loading ? 'Sincronizando...' : '✨ Auto-Sync Inteligente (Recomendado)'}
            </button>
            
            <button type="button" onClick={handleConnect} className="btn-secondary" disabled={loading} style={{ justifyContent: 'center', opacity: 0.7, fontSize: '12px' }}>
              Baixar Dados Manualmente (Modo Antigo)
            </button>
          </form>
        </div>
      ) : (
        <div>
          {/* Progress Banner */}
          {syncProgress.total > 0 && (
            <div style={{ background: 'var(--surface-light)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>{syncProgress.status}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>{syncProgress.current} de {syncProgress.total} processados</p>
              </div>
              <div style={{ width: '200px', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <button 
              className="btn-secondary" 
              onClick={handleMatchTmdb} 
              disabled={loading || matchedStreams.length > 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Search size={18} /> 1. Buscar no TMDB
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSyncFirebase} 
              disabled={loading || matchedStreams.filter(s => s.matched).length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UploadCloud size={18} /> 2. Salvar no Firestore
            </button>
          </div>

          {/* Filtros de Tabela */}
          {matchedStreams.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button 
                className={filterMode === 'all' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('all')}
                style={{ padding: '6px 12px', fontSize: '14px' }}
              >
                Todos ({matchedStreams.length})
              </button>
              <button 
                className={filterMode === 'matched' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('matched')}
                style={{ padding: '6px 12px', fontSize: '14px', background: filterMode === 'matched' ? '#4CAF50' : '' }}
              >
                <CheckCircle size={14} style={{ marginRight: '4px', display: 'inline' }} />
                Encontrados ({matchedStreams.filter(s => s.matched).length})
              </button>
              <button 
                className={filterMode === 'unmatched' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setFilterMode('unmatched')}
                style={{ padding: '6px 12px', fontSize: '14px', background: filterMode === 'unmatched' ? '#FF9800' : '' }}
              >
                <AlertTriangle size={14} style={{ marginRight: '4px', display: 'inline' }} />
                Não Encontrados ({matchedStreams.filter(s => !s.matched).length})
              </button>
            </div>
          )}

          {/* Streams Table */}
          <div className="glass-card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Status</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Nome (Baserow)</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Link (Baserow)</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>TMDB</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Ação Manual</th>
                </tr>
              </thead>
              <tbody>
                {(matchedStreams.length > 0 ? matchedStreams : streams)
                  .filter(stream => {
                    if (matchedStreams.length === 0) return true;
                    if (filterMode === 'matched') return stream.matched;
                    if (filterMode === 'unmatched') return !stream.matched;
                    return true;
                  })
                  .map((stream, idx) => (
                  <tr key={stream.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      {matchedStreams.length > 0 ? (
                        stream.matched ? (
                          <CheckCircle size={18} color="#4CAF50" />
                        ) : (
                          <AlertTriangle size={18} color="#FF9800" />
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Aguardando</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {stream.cleanName}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stream.playbackUrl}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {stream.matched ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>{stream.title}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {matchedStreams.length > 0 && !stream.matched ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Nome ou ID TMDB" 
                            value={manualQueries[stream.id] || ''}
                            onChange={(e) => setManualQueries(prev => ({...prev, [stream.id]: e.target.value}))}
                            style={{ width: '130px', padding: '6px 8px', fontSize: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '4px' }}
                          />
                          <button 
                            onClick={() => handleManualSearch(stream.id, stream.cleanName)}
                            style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Buscar
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default BaserowSync;
