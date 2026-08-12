import re

with open('src/screens/BaserowSync.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

auto_sync_code = """  const handleAutoSync = async (e) => {
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

          const combinedTags = ['baserow', ...(stream.tmdbTags || [])];
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
            const combinedTags = ['baserow', ...(data.info.tmdbTags || [])];
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

  const handleConnect = async (e) => {"""

code = code.replace("  const handleConnect = async (e) => {", auto_sync_code)

ui_code = """          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
          </form>"""

code = re.sub(r"<form onSubmit=\{handleConnect\} style=\{\{ display: 'flex', flexDirection: 'column', gap: '16px' \}\}>.*?</form>", ui_code, code, flags=re.DOTALL)

with open('src/screens/BaserowSync.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactor completed successfully!")
