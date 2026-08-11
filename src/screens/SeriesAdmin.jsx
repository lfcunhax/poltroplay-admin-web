import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import axios from 'axios';
import { Plus, Search, Trash2, Video, Tag, ListVideo, Edit2, Star } from 'lucide-react';
import SeriesEpisodesManager from '../components/SeriesEpisodesManager';

const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';

function SeriesAdmin() {
  const [series, setSeries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
  const [isNewRelease, setIsNewRelease] = useState(true); // default true
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Form state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', overview: '', tags: [], isHighlight: false, posterPath: ''
  });

  useEffect(() => {
    fetchSeries();
    fetchCategories();
  }, []);

  const fetchSeries = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'series'));
      const seriesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSeries(seriesList.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (error) {
      console.error("Error fetching series: ", error);
    } finally {
      setLoading(false);
    }
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
      const genreNames = response.data.genres 
        ? response.data.genres.map(g => g.name)
        : (response.data.genre_ids || []).map(id => genreMap[id]);
      const validGenreNames = genreNames.filter(name => name);
      setTags([...new Set(['recent', ...validGenreNames])]);

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

      // Salvar tags novas nas categorias globais
      const missingCategories = tags.filter(tag => !categories.includes(tag));
      for (const newCat of missingCategories) {
        await addDoc(collection(db, 'categories'), {
          name: newCat,
          createdAt: serverTimestamp()
        });
      }

      const docRef = await addDoc(collection(db, 'series'), {
        tmdbId: preview.id || null,
        title: preview.name || '',
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

          await fetch('http://localhost:3000/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              title: `Novo Lançamento: ${itemTitle}`, 
              body: `${itemTitle} já está disponível no PoltroPlay. Venha assistir agora mesmo!`, 
              imageUrl: imageUrl,
              contentId: docRef.id,
              contentType: 'tv'
            })
          });
        } catch (e) {
          console.error("Erro ao enviar notificação de lançamento:", e);
        }
      }

      alert("Série cadastrada! Você pode adicionar os links dos episódios em seguida." + (missingCategories.length > 0 ? `\n${missingCategories.length} nova(s) categoria(s) cadastrada(s).` : ""));
      setIsAddModalOpen(false);
      resetAddForm();
      fetchSeries();
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
      // Salvar tags novas nas categorias globais
      const missingCategories = editForm.tags.filter(tag => !categories.includes(tag));
      for (const newCat of missingCategories) {
        await addDoc(collection(db, 'categories'), {
          name: newCat,
          createdAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'series', editingId), {
        title: editForm.title,
        overview: editForm.overview,
        tags: editForm.tags,
        isHighlight: editForm.isHighlight
      });
      alert("Série atualizada com sucesso!");
      setIsEditModalOpen(false);
      fetchSeries();
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
      fetchSeries();
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Gerenciar Séries</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Adicione séries e gerencie os episódios.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setIsAddModalOpen(true)}>
          <Plus size={20} />
          Adicionar Série
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando séries...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Série</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Tags</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {series.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma série cadastrada.
                  </td>
                </tr>
              ) : (
                series.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <img 
                        src={`https://image.tmdb.org/t/p/w92${item.posterPath}`} 
                        alt={item.title} 
                        style={{ width: '40px', borderRadius: '4px' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '500' }}>{item.title}</span>
                          {item.isHighlight && <Star size={14} color="#FFD700" fill="#FFD700" title="Destaque" />}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TMDB: {item.tmdbId}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {item.tags?.map(tag => (
                          <span key={tag} style={{ background: 'rgba(123, 47, 247, 0.2)', color: 'var(--primary-light)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          className="btn-secondary" 
                          onClick={() => setSelectedSeries(item)}
                          style={{ padding: '6px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' }} 
                          title="Gerenciar Episódios"
                        >
                          <ListVideo size={16} /> Episódios
                        </button>
                        <button onClick={() => openEdit(item)} style={{ color: 'var(--text-secondary)', padding: '6px' }} title="Editar Série">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ color: 'var(--accent-alt)', padding: '6px' }} title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL: ADICIONAR SÉRIE */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
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
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
                <img 
                  src={`https://image.tmdb.org/t/p/w185${preview.poster_path}`} 
                  alt={preview.name}
                  style={{ width: '100px', borderRadius: '8px' }}
                />
                <div>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{preview.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {preview.overview}
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Categorias / Tags</label>
              {renderTagsSelector(tags, false)}
            </div>

            <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
                  <input type="checkbox" checked={isHighlightAdd} onChange={(e) => setIsHighlightAdd(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>⭐ Marcar como Destaque (Banner Principal)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isNewRelease} onChange={(e) => setIsNewRelease(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>🔔 É Lançamento? (Enviar Notificação Push automaticamente)</span>
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar Série</h2>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <img 
                  src={`https://image.tmdb.org/t/p/w185${editForm.posterPath}`} 
                  alt={editForm.title}
                  style={{ width: '80px', borderRadius: '8px' }}
              />
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Título</label>
                <input 
                  type="text" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.isHighlight} onChange={(e) => setEditForm({...editForm, isHighlight: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>⭐ Destaque</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Sinopse</label>
              <textarea 
                value={editForm.overview} onChange={(e) => setEditForm({...editForm, overview: e.target.value})}
                style={{ width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '12px', color: 'white' }}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Categorias / Tags</label>
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
