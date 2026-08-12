import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Settings, Save, CheckCircle, Trash2, Loader2 } from 'lucide-react';

function SettingsAdmin() {
  const [baseUrl, setBaseUrl] = useState('https://api.baserow.io');
  const [token, setToken] = useState('');
  const [moviesTableId, setMoviesTableId] = useState('1094109');
  const [seriesTableId, setSeriesTableId] = useState('1094110');
  const [tmdbKey, setTmdbKey] = useState('384caf4e90af984a7c5595ea5d9bb386'); // Opcional, futuramente
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Carregar do localStorage ao iniciar
    const savedConfig = localStorage.getItem('poltroplay_baserow_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
        if (parsed.token) setToken(parsed.token);
        if (parsed.moviesTableId) setMoviesTableId(parsed.moviesTableId);
        if (parsed.seriesTableId) setSeriesTableId(parsed.seriesTableId);
        if (parsed.tmdbKey) setTmdbKey(parsed.tmdbKey);
      } catch (err) {
        console.error("Erro ao ler configurações locais:", err);
      }
    }
  }, []);

  const [cleaning, setCleaning] = useState(false);
  const [cleanStatus, setCleanStatus] = useState('');

  const handleCleanTags = async () => {
    if (!window.confirm('Tem certeza que deseja remover as tags baserow, xtream e recent de TODOS os filmes e séries do banco de dados? Esta ação não pode ser desfeita.')) return;
    
    setCleaning(true);
    setCleanStatus('Iniciando limpeza...');
    
    try {
      let totalUpdated = 0;
      const tagsToRemove = ['baserow', 'xtream', 'recent'];

      // Limpar Filmes
      setCleanStatus('Buscando filmes...');
      const moviesSnap = await getDocs(collection(db, 'movies'));
      let batch = writeBatch(db);
      let batchCount = 0;
      
      moviesSnap.forEach(document => {
        const data = document.data();
        if (data.tags && Array.isArray(data.tags)) {
          const newTags = data.tags.filter(t => !tagsToRemove.includes(t));
          if (newTags.length !== data.tags.length) {
            batch.update(document.ref, { tags: newTags });
            batchCount++;
            totalUpdated++;
          }
        }
        
        if (batchCount === 450) {
          batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      });
      if (batchCount > 0) await batch.commit();

      // Limpar Séries
      setCleanStatus('Buscando séries...');
      const seriesSnap = await getDocs(collection(db, 'series'));
      batch = writeBatch(db);
      batchCount = 0;
      
      seriesSnap.forEach(document => {
        const data = document.data();
        if (data.tags && Array.isArray(data.tags)) {
          const newTags = data.tags.filter(t => !tagsToRemove.includes(t));
          if (newTags.length !== data.tags.length) {
            batch.update(document.ref, { tags: newTags });
            batchCount++;
            totalUpdated++;
          }
        }
        
        if (batchCount === 450) {
          batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      });
      if (batchCount > 0) await batch.commit();

      setCleanStatus(`Concluído! ${totalUpdated} itens atualizados.`);
      setTimeout(() => setCleanStatus(''), 5000);
    } catch (error) {
      console.error(error);
      alert('Erro ao limpar tags: ' + error.message);
      setCleanStatus('Erro na limpeza.');
    } finally {
      setCleaning(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const config = {
      baseUrl,
      token,
      moviesTableId,
      seriesTableId,
      tmdbKey
    };
    localStorage.setItem('poltroplay_baserow_config', JSON.stringify(config));
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="admin-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Settings size={28} color="var(--primary)" />
        <h1 style={{ margin: 0 }}>Configurações do Sistema</h1>
      </div>

      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Configurações do Baserow (VPS)
        </h2>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>URL Base do Baserow (VPS ou api.baserow.io)</label>
            <input 
              type="url" 
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="admin-input"
              placeholder="Ex: https://baserow.meusite.com"
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Token de Banco de Dados</label>
            <input 
              type="text" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="admin-input"
              placeholder="Database Token"
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>ID da Tabela - Filmes</label>
              <input 
                type="text" 
                value={moviesTableId}
                onChange={(e) => setMoviesTableId(e.target.value)}
                className="admin-input"
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>ID da Tabela - Séries</label>
              <input 
                type="text" 
                value={seriesTableId}
                onChange={(e) => setSeriesTableId(e.target.value)}
                className="admin-input"
                required
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '12px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>TMDB API Key (Para buscar capas e sinopses)</label>
            <input 
              type="text" 
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              className="admin-input"
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
            <button type="submit" className="admin-button" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
              <Save size={18} /> Salvar Configurações
            </button>
            
            {showSuccess && (
              <span style={{ color: '#00D4FF', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <CheckCircle size={18} /> Salvo localmente com sucesso!
              </span>
            )}
          </div>
          
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            *Estas configurações ficam salvas apenas neste navegador por segurança.
          </p>
        </form>
      </div>

      <div style={{
        backgroundColor: 'var(--surface)',
        borderRadius: '16px',
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.05)',
        marginTop: '24px'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '24px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#E94560' }}>
          <Trash2 size={24} /> Manutenção do Banco de Dados
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', maxWidth: '600px', lineHeight: '1.5' }}>
          Remova tags de sistema (como <strong>baserow</strong>, <strong>xtream</strong> e <strong>recent</strong>) que foram adicionadas no passado e estão poluindo o visual do aplicativo para o usuário final. Isso verificará todos os filmes e séries.
        </p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={handleCleanTags}
            disabled={cleaning}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
              backgroundColor: '#E94560', color: 'white', border: 'none', borderRadius: '8px',
              cursor: cleaning ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: cleaning ? 0.7 : 1
            }}
          >
            {cleaning ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />}
            {cleaning ? 'Limpando...' : 'Limpar Tags de Sistema'}
          </button>
          
          {cleanStatus && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {cleanStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsAdmin;
