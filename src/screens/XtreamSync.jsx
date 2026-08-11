import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import axios from 'axios';
import { Cloud, Search, CheckCircle, AlertTriangle, UploadCloud } from 'lucide-react';

const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';

function XtreamSync() {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncType, setSyncType] = useState('movie'); // 'movie' or 'series'
  const [streams, setStreams] = useState([]); // List of VODs/Series from Xtream
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, status: '' });
  const [matchedStreams, setMatchedStreams] = useState([]); // Enriched with TMDB data

  // 1. Connect and Fetch VOD list
  const handleConnect = async (e) => {
    e.preventDefault();
    if (!serverUrl || !username || !password) {
      alert("Preencha todos os campos do servidor.");
      return;
    }

    setLoading(true);
    try {
      // Clean URL
      const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
      const action = syncType === 'movie' ? 'get_vod_streams' : 'get_series';
      const apiUrl = `${cleanUrl}/player_api.php?username=${username}&password=${password}&action=${action}`;
      
      const response = await axios.get(apiUrl);
      if (Array.isArray(response.data)) {
        // Limit to 50 for testing, usually this returns thousands
        const vods = response.data.slice(0, 50); 
        setStreams(vods.map(vod => ({
          ...vod,
          cleanName: (vod.name || '').replace(/\[.*?\]|\(.*?\)|1080p|720p|4k|dual áudio|dublado/gi, '').trim(),
          playbackUrl: syncType === 'movie' 
            ? `${cleanUrl}/movie/${username}/${password}/${vod.stream_id}.${vod.container_extension}`
            : '' // Series playback requires episode level details, handle later
        })));
        setIsConnected(true);
      } else {
        alert("Resposta inválida do servidor. Verifique as credenciais.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar no servidor Xtream.");
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
      53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste'
    };

    let matched = [];
    
    for (let i = 0; i < streams.length; i++) {
      const stream = streams[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        const tmdbType = syncType === 'movie' ? 'movie' : 'tv';
        const response = await axios.get(`https://api.themoviedb.org/3/search/${tmdbType}?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(stream.cleanName)}`);
        
        if (response.data.results && response.data.results.length > 0) {
          const tmdbData = response.data.results[0]; // Get best match
          // Map genre IDs to names
          const genreNames = (tmdbData.genre_ids || [])
            .map(id => genreMap[id])
            .filter(name => name); // Remove undefined

          matched.push({
            ...stream,
            tmdbId: tmdbData.id,
            title: tmdbData.title || tmdbData.name,
            overview: tmdbData.overview,
            posterPath: tmdbData.poster_path,
            backdropPath: tmdbData.backdrop_path,
            voteAverage: tmdbData.vote_average,
            releaseDate: tmdbData.release_date || tmdbData.first_air_date,
            tmdbTags: genreNames,
            matched: true
          });
        } else {
          matched.push({ ...stream, matched: false });
        }
      } catch (e) {
        matched.push({ ...stream, matched: false });
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200)); 
    }
    
    setMatchedStreams(matched);
    setSyncProgress({ current: streams.length, total: streams.length, status: 'Busca concluída!' });
    setLoading(false);
  };

  // 3. Save to Firebase
  const handleSyncFirebase = async () => {
    const toSync = matchedStreams.filter(s => s.matched);
    if (toSync.length === 0) return;
    
    if (!window.confirm(`Sincronizar ${toSync.length} ${syncType === 'movie' ? 'filmes' : 'séries'} para o Firebase?`)) return;

    setLoading(true);
    setSyncProgress({ current: 0, total: toSync.length, status: 'Salvando no Firebase...' });

    const collectionName = syncType === 'movie' ? 'movies' : 'series';

    for (let i = 0; i < toSync.length; i++) {
      const stream = toSync[i];
      setSyncProgress(prev => ({ ...prev, current: i + 1 }));
      
      try {
        // Verifica se já existe (Prevenção de Duplicatas)
        const q = query(collection(db, collectionName), where('tmdbId', '==', stream.tmdbId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          console.log(`${collectionName} ${stream.title} já existe. Pulando...`);
          continue; // Pula a inserção se já existir
        }

        const combinedTags = ['xtream', ...(stream.tmdbTags || [])];

        const docData = {
          tmdbId: stream.tmdbId || null,
          title: stream.title || stream.cleanName || '',
          overview: stream.overview || '',
          posterPath: stream.posterPath || null,
          backdropPath: stream.backdropPath || null,
          voteAverage: stream.voteAverage || 0,
          releaseDate: stream.releaseDate || null,
          tags: combinedTags,
          createdAt: serverTimestamp()
        };

        if (syncType === 'movie') {
          docData.videoUrl = stream.playbackUrl || '';
        } else {
          docData.numberOfSeasons = 0;
          docData.numberOfEpisodes = 0;
        }

        await addDoc(collection(db, collectionName), docData);
      } catch (e) {
        console.error("Failed to save", stream.title, e);
      }
    }
    
    alert("Sincronização concluída com sucesso!");
    setSyncProgress({ current: 0, total: 0, status: '' });
    setLoading(false);
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ marginBottom: '8px' }}>Sincronização Xtream Codes</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Conecte seu servidor IPTV para importar conteúdos automaticamente.</p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <button 
            className={syncType === 'movie' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setSyncType('movie'); setIsConnected(false); setStreams([]); setMatchedStreams([]); }}
          >
            Filmes (VOD)
          </button>
          <button 
            className={syncType === 'series' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setSyncType('series'); setIsConnected(false); setStreams([]); setMatchedStreams([]); }}
          >
            Séries
          </button>
        </div>
      </div>

      {!isConnected ? (
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={24} color="var(--accent)" /> Conectar Servidor
          </h2>
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>URL do Servidor (com porta)</label>
              <input type="url" placeholder="http://seuservidor.com:8080" value={serverUrl} onChange={e => setServerUrl(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Usuário</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '16px' }}>
              {loading ? 'Conectando...' : `Conectar e Listar ${syncType === 'movie' ? 'Filmes' : 'Séries'}`}
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
              <Search size={18} /> 1. Enriquecer com TMDB (Automático)
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSyncFirebase} 
              disabled={loading || matchedStreams.filter(s => s.matched).length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <UploadCloud size={18} /> 2. Sincronizar para o Aplicativo (Firebase)
            </button>
          </div>

          {/* Streams Table */}
          <div className="glass-card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Status TMDB</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Filme (Original)</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Título Encontrado (TMDB)</th>
                </tr>
              </thead>
              <tbody>
                {(matchedStreams.length > 0 ? matchedStreams : streams).map((stream, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      {matchedStreams.length > 0 ? (
                        stream.matched ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4CAF50' }}>
                            <CheckCircle size={18} /> Encontrado
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FF9800' }}>
                            <AlertTriangle size={18} /> Não encontrado
                          </div>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Aguardando busca</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {stream.cleanName}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {stream.matched ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img src={`https://image.tmdb.org/t/p/w92${stream.posterPath}`} alt="poster" style={{ height: '40px', borderRadius: '4px' }} />
                          <span style={{ fontWeight: '600' }}>{stream.title}</span>
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

export default XtreamSync;
