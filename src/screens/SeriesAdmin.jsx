import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, 
  query, where, updateDoc, getCountFromServer, limit, startAfter, orderBy, writeBatch
} from 'firebase/firestore';
import axios from 'axios';
import { Plus, Search, Trash2, ListVideo, Edit2, Star, Tv, ChevronLeft, ChevronRight } from 'lucide-react';
import SeriesEpisodesManager from '../components/SeriesEpisodesManager';

const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';
const PAGE_SIZE = 20;

function SeriesAdmin() {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Paginação e Contadores
  const [totalSeries, setTotalSeries] = useState(0);
  const [page, setPage] = useState(1);
  const [pageHistory, setPageHistory] = useState([null]);
  const [hasMore, setHasMore] = useState(false);
  
  // Navigation State
  const [selectedSeries, setSelectedSeries] = useState(null);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Add Form state
  const [tmdbId, setTmdbId] = useState('');
  const [preview, setPreview] = useState(null);
  const [tags, setTags] = useState([]);
  const [isHighlightAdd, setIsHighlightAdd] = useState(false);
  const [isNewRelease, setIsNewRelease] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Form state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', overview: '', tags: [], isHighlight: false, posterPath: ''
  });

  useEffect(() => {
    fetchTotalCount();
    fetchSeries(null);
    fetchCategories();
  }, []);

  const fetchTotalCount = async () => {
    try {
      const coll = collection(db, 'series');
      const snapshot = await getCountFromServer(coll);
      setTotalSeries(snapshot.data().count);
    } catch (e) {
      console.error("Erro ao buscar total:", e);
    }
  };

  const fetchSeries = async (startAfterDoc) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'series'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }

      const querySnapshot = await getDocs(q);
      const seriesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSeries(seriesList);

      if (querySnapshot.docs.length === PAGE_SIZE) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setHasMore(true);
        if (pageHistory.length === page) {
          setPageHistory([...pageHistory, lastDoc]);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching series: ", error);
    } finally {
      setLoading(false);
    }
  };

  const goToNextPage = () => {
    if (!hasMore) return;
    const currentCursor = pageHistory[page];
    setPage(page + 1);
    fetchSeries(currentCursor);
  };

  const goToPrevPage = () => {
    if (page <= 1) return;
    const prevPage = page - 1;
    setPage(prevPage);
    const cursor = prevPage === 1 ? null : pageHistory[prevPage - 1];
    fetchSeries(cursor);
  };

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const cats = snap.docs.map(doc => doc.data().name);
      setCategories(cats.sort());
    } catch (error) {
      console.error("Error fetching categories: ", error);
    }
  };

  const searchTmdb = async () => {
    if (!tmdbId) return;
    setIsSearching(true);
    try {
      const response = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setPreview(response.data);
      
      const genreMap = {
        10759: 'Ação e Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
        99: 'Documentário', 18: 'Drama', 10751: 'Família', 10762: 'Kids',
        9648: 'Mistério', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi e Fantasy',
        10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Faroeste'
      };
      const tmdbData = response.data;
      const genreNames = tmdbData.genres 
        ? tmdbData.genres.map(g => g.name)
        : (tmdbData.genre_ids || []).map(id => genreMap[id]);
      const validGenreNames = genreNames.filter(name => name);
      const relYear = tmdbData.first_air_date ? parseInt(tmdbData.first_air_date.split('-')[0]) : 0; 
      const isRecent = relYear >= new Date().getFullYear() - 1; 
      setTags([...new Set([...(isRecent ? ['recent'] : []), ...validGenreNames])]);

    } catch (error) {
      alert("Série não encontrada no TMDB. Verifique o ID.");
      setPreview(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveSeries = async () => {
    if (!preview) {
      alert("Por favor, importe uma série.");
      return;
    }
    setIsSaving(true);
    try {
      const q = query(collection(db, 'series'), where('tmdbId', '==', preview.id));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert("Esta série já está cadastrada no banco de dados!");
        setIsSaving(false);
        return;
      }

      const missingCategories = tags.filter(tag => !categories.includes(tag));
      for (const newCat of missingCategories) {
        await addDoc(collection(db, 'categories'), {
          name: newCat,
          createdAt: serverTimestamp()
        });
      }

      const lowerTitle = (preview.name || '').toLowerCase();

      const docRef = await addDoc(collection(db, 'series'), {
        tmdbId: preview.id || null,
        title: preview.name || '',
        titleLower: lowerTitle,
        overview: preview.overview || '',
        posterPath: preview.poster_path || null,
        backdropPath: preview.backdrop_path || null,
        voteAverage: preview.vote_average || 0,
        releaseDate: preview.first_air_date || null,
        numberOfSeasons: preview.number_of_seasons || 0,
        numberOfEpisodes: preview.number_of_episodes || 0,
        tags: tags,
        isHighlight: isHighlightAdd,
        createdAt: serverTimestamp()
      });
      
      if (isNewRelease) {
        try {
          const itemTitle = preview.name;
          const imageUrl = preview.backdrop_path ? `https://image.tmdb.org/t/p/w780${preview.backdrop_path}` : (preview.poster_path ? `https://image.tmdb.org/t/p/w500${preview.poster_path}` : '');
          
          await addDoc(collection(db, 'notifications'), {
            title: `Novo Lançamento: ${itemTitle}`,
            body: `${itemTitle} já está disponível no PoltroPlay. Venha assistir agora mesmo!`,
            imageUrl: imageUrl,
            contentId: docRef.id,
            contentType: 'tv',
            createdAt: serverTimestamp(),
            status: 'sent' 
          });
        } catch (e) {
          console.error("Erro ao enviar notificação de lançamento:", e);
        }
      }

      alert("Série cadastrada! Você pode adicionar os links dos episódios em seguida.");
      setIsAddModalOpen(false);
      resetAddForm();
      setPage(1);
      setPageHistory([null]);
      fetchTotalCount();
      fetchSeries(null);
      fetchCategories();
    } catch (error) {
      alert("Erro ao salvar série.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title || '',
      overview: item.overview || '',
      tags: item.tags || [],
      isHighlight: item.isHighlight || false,
      posterPath: item.posterPath || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSeries = async () => {
    setIsSaving(true);
    try {
      const missingCategories = editForm.tags.filter(tag => !categories.includes(tag));
      for (const newCat of missingCategories) {
        await addDoc(collection(db, 'categories'), {
          name: newCat,
          createdAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'series', editingId), {
        title: editForm.title,
        titleLower: editForm.title.toLowerCase(),
        overview: editForm.overview,
        tags: editForm.tags,
        isHighlight: editForm.isHighlight
      });
      alert("Série atualizada com sucesso!");
      setIsEditModalOpen(false);
      const cursor = page === 1 ? null : pageHistory[page - 1];
      fetchSeries(cursor);
      fetchCategories();
    } catch (error) {
      alert("Erro ao atualizar série.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta série? (Isso não exclui os episódios do banco ainda)")) {
      await deleteDoc(doc(db, 'series', id));
      fetchTotalCount();
      const cursor = page === 1 ? null : pageHistory[page - 1];
      fetchSeries(cursor);
    }
  };

  const handleWipeAllSeries = async () => {
    if (window.confirm("PERIGO! Você tem certeza ABSOLUTA que deseja apagar TODAS as séries do banco de dados? Esta ação não pode ser desfeita.")) {
      if (window.prompt("Digite 'CONFIRMAR' em maiúsculo para apagar tudo:") === 'CONFIRMAR') {
        setLoading(true);
        try {
          const snapshot = await getDocs(collection(db, 'series'));
          // Apagar de 100 em 100 para não estourar limite do firebase client
          const batches = [];
          let currentBatch = writeBatch(db);
          let count = 0;

          snapshot.docs.forEach((document) => {
            currentBatch.delete(document.ref);
            count++;
            if (count === 400) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              count = 0;
            }
          });
          
          if (count > 0) batches.push(currentBatch.commit());
          
          await Promise.all(batches);
          
          alert("Todas as séries foram apagadas com sucesso.");
          setPage(1);
          setPageHistory([null]);
          fetchTotalCount();
          fetchSeries(null);
        } catch (e) {
          console.error("Erro ao apagar séries:", e);
          alert("Ocorreu um erro ao apagar as séries. Veja o console.");
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const resetAddForm = () => {
    setTmdbId('');
    setPreview(null);
    setTags([]);
    setIsHighlightAdd(false);
    setIsNewRelease(true);
  };

  const toggleTag = (tag, isEdit = false) => {
    if (isEdit) {
      if (editForm.tags.includes(tag)) {
        setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tag) });
      } else {
        setEditForm({ ...editForm, tags: [...editForm.tags, tag] });
      }
    } else {
      if (tags.includes(tag)) {
        setTags(tags.filter(t => t !== tag));
      } else {
        setTags([...tags, tag]);
      }
    }
  };

  const renderTagsSelector = (currentTags, isEdit = false) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--surface-light)' }}>
      {categories.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>Nenhuma categoria cadastrada.</span> : null}
      {categories.map(cat => {
        const isSelected = currentTags.includes(cat);
        return (
          <div 
            key={cat} 
            onClick={() => toggleTag(cat, isEdit)}
            style={{
              padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
              backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: isSelected ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${isSelected ? 'var(--primary-light)' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.2s'
            }}
          >
            {cat}
          </div>
        );
      })}
    </div>
  );

  if (selectedSeries) {
    return <SeriesEpisodesManager series={selectedSeries} onBack={() => setSelectedSeries(null)} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Gerenciar Séries</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Adicione séries e gerencie os episódios.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Contador Total */}
          <div className="glass-card" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(123, 47, 247, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <Tv size={24} color="var(--primary-light)" />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total de Séries</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalSeries}</div>
            </div>
          </div>

          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: 'fit-content' }} onClick={() => setIsAddModalOpen(true)}>
            <Plus size={20} />
            Nova Série
          </button>
          
          <button 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', height: 'fit-content',
              backgroundColor: 'rgba(233, 69, 96, 0.1)', color: 'var(--accent-alt)',
              padding: '12px 24px', borderRadius: '12px', fontWeight: '600', transition: 'all 0.3s ease',
              border: '1px solid rgba(233, 69, 96, 0.2)'
            }} 
            onClick={handleWipeAllSeries}
          >
            <Trash2 size={20} />
            Limpar Tudo
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando catálogo de séries...</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Série</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Tags / Categorias</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600', width: '220px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma série nesta página.
                    </td>
                  </tr>
                ) : (
                  series.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${item.posterPath}`} 
                          alt={item.title} 
                          style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '500', fontSize: '15px' }}>{item.title}</span>
                            {item.isHighlight && <Star size={14} color="#FFD700" fill="#FFD700" title="Destaque" />}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID TMDB: {item.tmdbId}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {item.tags?.map(tag => (
                            <span key={tag} style={{ background: 'rgba(123, 47, 247, 0.15)', color: 'var(--primary-light)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(123, 47, 247, 0.3)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => setSelectedSeries(item)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', height: 'fit-content' }} 
                            title="Gerenciar Episódios"
                          >
                            <ListVideo size={16} /> Episódios
                          </button>
                          <button onClick={() => openEdit(item)} className="action-btn edit-btn" title="Editar Série">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="action-btn delete-btn" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Paginação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Mostrando página <b>{page}</b> {totalSeries > 0 && `de aproximadamente ${Math.ceil(totalSeries / PAGE_SIZE)}`}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', opacity: page <= 1 ? 0.5 : 1 }} 
                  onClick={goToPrevPage}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', opacity: !hasMore ? 0.5 : 1 }} 
                  onClick={goToNextPage}
                  disabled={!hasMore}
                >
                  Próxima <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL: ADICIONAR SÉRIE */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Importar Nova Série</h2>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <input 
                type="text" placeholder="ID do TMDB..." value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
              />
              <button className="btn-secondary" onClick={searchTmdb} disabled={isSearching} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} /> {isSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {preview && (
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <img 
                  src={`https://image.tmdb.org/t/p/w185${preview.poster_path}`} 
                  alt={preview.name}
                  style={{ width: '100px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                />
                <div>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{preview.name}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
                    {preview.overview}
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Categorias / Tags</label>
              {renderTagsSelector(tags, false)}
            </div>

            <div style={{ marginBottom: '32px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
                  <input type="checkbox" checked={isHighlightAdd} onChange={(e) => setIsHighlightAdd(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>⭐ Marcar como Destaque (Banner Principal)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isNewRelease} onChange={(e) => setIsNewRelease(e.target.checked)} style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>🔔 É Lançamento? (Enviar Notificação Push)</span>
                </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button className="btn-secondary" onClick={() => { setIsAddModalOpen(false); resetAddForm(); }}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveSeries} disabled={isSaving || !preview}>
                {isSaving ? 'Salvando...' : 'Importar Série'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR SÉRIE */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar Série</h2>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
              <img 
                  src={`https://image.tmdb.org/t/p/w185${editForm.posterPath}`} 
                  alt={editForm.title}
                  style={{ width: '100px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Título</label>
                <input 
                  type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  style={{ width: '100%', marginBottom: '16px' }}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: 'rgba(255,215,0,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <input type="checkbox" checked={editForm.isHighlight} onChange={(e) => setEditForm({...editForm, isHighlight: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#FFD700' }} />
                  <span style={{ fontSize: '14px', color: '#FFD700', fontWeight: '600' }}>⭐ Destaque Principal</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Sinopse</label>
              <textarea 
                value={editForm.overview} onChange={(e) => setEditForm({...editForm, overview: e.target.value})}
                style={{ width: '100%', minHeight: '100px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '12px', color: 'white', lineHeight: '1.5' }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Categorias / Tags</label>
              {renderTagsSelector(editForm.tags, true)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleUpdateSeries} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeriesAdmin;
