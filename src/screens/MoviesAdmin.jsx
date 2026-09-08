import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc, 
  query, where, updateDoc, getCountFromServer, limit, startAfter, orderBy 
} from 'firebase/firestore';
import axios from 'axios';
import { Plus, Search, Trash2, Video, Edit2, Star, Film, ChevronLeft, ChevronRight } from 'lucide-react';

const TMDB_API_KEY = '384caf4e90af984a7c5595ea5d9bb386';
const PAGE_SIZE = 20;

function MoviesAdmin() {
  const [movies, setMovies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Paginação e Contadores
  const [totalMovies, setTotalMovies] = useState(0);
  const [page, setPage] = useState(1);
  const [pageHistory, setPageHistory] = useState([null]); // Guarda os cursores (lastVisible) de cada página
  const [hasMore, setHasMore] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Add Form state
  const [tmdbId, setTmdbId] = useState('');
  const [preview, setPreview] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [tags, setTags] = useState([]); 
  const [isHighlightAdd, setIsHighlightAdd] = useState(false);
  const [isNewRelease, setIsNewRelease] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Form state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', overview: '', videoUrl: '', tags: [], isHighlight: false, posterPath: ''
  });

  useEffect(() => {
    fetchTotalCount();
    fetchMovies(null); // primeira página
    fetchCategories();
  }, []);

  const fetchTotalCount = async () => {
    try {
      const coll = collection(db, 'movies');
      const snapshot = await getCountFromServer(coll);
      setTotalMovies(snapshot.data().count);
    } catch (e) {
      console.error("Erro ao buscar total:", e);
    }
  };

  const fetchMovies = async (startAfterDoc) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'movies'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (startAfterDoc) {
        q = query(q, startAfter(startAfterDoc));
      }

      const querySnapshot = await getDocs(q);
      const moviesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMovies(moviesList);
      
      // Verifica se tem mais para a próxima página
      if (querySnapshot.docs.length === PAGE_SIZE) {
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setHasMore(true);
        
        // Atualiza histórico se estivermos indo pra frente
        if (pageHistory.length === page) {
          setPageHistory([...pageHistory, lastDoc]);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching movies: ", error);
    } finally {
      setLoading(false);
    }
  };

  const goToNextPage = () => {
    if (!hasMore) return;
    const currentCursor = pageHistory[page]; // O cursor para iniciar a próxima página
    setPage(page + 1);
    fetchMovies(currentCursor);
  };

  const goToPrevPage = () => {
    if (page <= 1) return;
    const prevPage = page - 1;
    setPage(prevPage);
    // Para ir para a pág anterior, usamos o cursor guardado no index (prevPage - 1)
    const cursor = prevPage === 1 ? null : pageHistory[prevPage - 1];
    fetchMovies(cursor);
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
      const response = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=pt-BR`);
      setPreview(response.data);
      
      const genreMap = {
        28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
        99: 'Documentário', 18: 'Drama', 10751: 'Família', 14: 'Fantasia',
        36: 'História', 27: 'Terror', 10402: 'Música', 9648: 'Mistério',
        10749: 'Romance', 878: 'Ficção Científica', 10770: 'Cinema TV',
        53: 'Thriller', 10752: 'Guerra', 37: 'Faroeste'
      };
      const tmdbData = response.data;
      const genreNames = tmdbData.genres 
        ? tmdbData.genres.map(g => g.name)
        : (tmdbData.genre_ids || []).map(id => genreMap[id]);
      const validGenreNames = genreNames.filter(name => name);
      const relYear = tmdbData.release_date ? parseInt(tmdbData.release_date.split('-')[0]) : 0; 
      const isRecent = relYear >= new Date().getFullYear() - 1; 
      setTags([...new Set([...(isRecent ? ['recent'] : []), ...validGenreNames])]);

    } catch (error) {
      alert("Filme não encontrado no TMDB. Verifique o ID.");
      setPreview(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveMovie = async () => {
    if (!preview || !videoUrl) {
      alert("Por favor, importe um filme e cole a URL do vídeo.");
      return;
    }
    setIsSaving(true);
    try {
      const q = query(collection(db, 'movies'), where('tmdbId', '==', preview.id));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert("Este filme já está cadastrado no banco de dados!");
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

      const lowerTitle = (preview.title || '').toLowerCase();
      
      const docRef = await addDoc(collection(db, 'movies'), {
        tmdbId: preview.id || null,
        title: preview.title || '',
        titleLower: lowerTitle,
        overview: preview.overview || '',
        posterPath: preview.poster_path || null,
        backdropPath: preview.backdrop_path || null,
        voteAverage: preview.vote_average || 0,
        releaseDate: preview.release_date || null,
        videoUrl: videoUrl || '',
        tags: tags,
        isHighlight: isHighlightAdd,
        createdAt: serverTimestamp()
      });

      if (isNewRelease) {
        try {
          const itemTitle = preview.title;
          const imageUrl = preview.backdrop_path ? `https://image.tmdb.org/t/p/w780${preview.backdrop_path}` : (preview.poster_path ? `https://image.tmdb.org/t/p/w500${preview.poster_path}` : '');
          
          await addDoc(collection(db, 'notifications'), {
            title: `Novo Lançamento: ${itemTitle}`,
            body: `${itemTitle} já está disponível no PoltroPlay. Venha assistir agora mesmo!`,
            imageUrl: imageUrl,
            contentId: docRef.id,
            contentType: 'movie',
            createdAt: serverTimestamp(),
            status: 'sent' 
          });
        } catch (e) {
          console.error("Erro ao enviar notificação de lançamento:", e);
        }
      }

      alert("Filme salvo com sucesso!");
      setIsAddModalOpen(false);
      resetAddForm();
      // Atualiza e volta pra primeira página
      setPage(1);
      setPageHistory([null]);
      fetchTotalCount();
      fetchMovies(null);
      fetchCategories();
    } catch (error) {
      alert("Erro ao salvar filme.");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (movie) => {
    setEditingId(movie.id);
    setEditForm({
      title: movie.title || '',
      overview: movie.overview || '',
      videoUrl: movie.videoUrl || '',
      tags: movie.tags || [],
      isHighlight: movie.isHighlight || false,
      posterPath: movie.posterPath || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateMovie = async () => {
    setIsSaving(true);
    try {
      const missingCategories = editForm.tags.filter(tag => !categories.includes(tag));
      for (const newCat of missingCategories) {
        await addDoc(collection(db, 'categories'), {
          name: newCat,
          createdAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'movies', editingId), {
        title: editForm.title,
        titleLower: editForm.title.toLowerCase(),
        overview: editForm.overview,
        videoUrl: editForm.videoUrl,
        tags: editForm.tags,
        isHighlight: editForm.isHighlight
      });
      
      alert("Filme atualizado com sucesso!");
      setIsEditModalOpen(false);
      // Recarrega a página atual
      const cursor = page === 1 ? null : pageHistory[page - 1];
      fetchMovies(cursor);
      fetchCategories();
    } catch (error) {
      alert("Erro ao atualizar filme.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este filme?")) {
      await deleteDoc(doc(db, 'movies', id));
      fetchTotalCount();
      // Recarrega a página atual
      const cursor = page === 1 ? null : pageHistory[page - 1];
      fetchMovies(cursor);
    }
  };

  const resetAddForm = () => {
    setTmdbId('');
    setPreview(null);
    setVideoUrl('');
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
              padding: '6px 12px',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Gerenciar Filmes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Adicione filmes, defina destaques e categorias.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Contador Total */}
          <div className="glass-card" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(123, 47, 247, 0.2)', padding: '10px', borderRadius: '12px' }}>
              <Film size={24} color="var(--primary-light)" />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total de Filmes</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalMovies}</div>
            </div>
          </div>

          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', height: 'fit-content' }} onClick={() => setIsAddModalOpen(true)}>
            <Plus size={20} />
            Novo Filme
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando catálogo de filmes...</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left', background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Filme</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600' }}>Tags / Categorias</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: '600', width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {movies.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum filme nesta página.
                    </td>
                  </tr>
                ) : (
                  movies.map(movie => (
                    <tr key={movie.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} className="hover-row">
                      <td style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img 
                          src={`https://image.tmdb.org/t/p/w92${movie.posterPath}`} 
                          alt={movie.title} 
                          style={{ width: '48px', height: '72px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: '500', fontSize: '15px' }}>{movie.title}</span>
                            {movie.isHighlight && <Star size={14} color="#FFD700" fill="#FFD700" title="Destaque" />}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ID TMDB: {movie.tmdbId}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {movie.tags?.map(tag => (
                            <span key={tag} style={{ background: 'rgba(123, 47, 247, 0.15)', color: 'var(--primary-light)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid rgba(123, 47, 247, 0.3)' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => openEdit(movie)} className="action-btn edit-btn" title="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(movie.id)} className="action-btn delete-btn" title="Excluir">
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
                Mostrando página <b>{page}</b> {totalMovies > 0 && `de aproximadamente ${Math.ceil(totalMovies / PAGE_SIZE)}`}
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

      {/* MODAL: ADICIONAR FILME */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Importar Novo Filme</h2>
            
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
                  alt={preview.title}
                  style={{ width: '100px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                />
                <div>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{preview.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
                    {preview.overview}
                  </p>
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>URL do Vídeo (M3U8 ou MP4)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '0 16px', transition: 'border-color 0.2s' }}>
                <Video size={18} color="var(--primary-light)" />
                <input 
                  type="url" style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '14px 0', width: '100%' }}
                  placeholder="https://servidor.com/filme.m3u8" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                />
              </div>
            </div>

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
              <button className="btn-primary" onClick={handleSaveMovie} disabled={isSaving || !preview}>
                {isSaving ? 'Salvando...' : 'Salvar Filme'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR FILME */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Editar Filme</h2>
            
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>URL do Vídeo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '0 16px' }}>
                <Video size={18} color="var(--primary-light)" />
                <input 
                  type="url" style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '14px 0', width: '100%' }}
                  value={editForm.videoUrl} onChange={(e) => setEditForm({...editForm, videoUrl: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Categorias / Tags</label>
              {renderTagsSelector(editForm.tags, true)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
              <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleUpdateMovie} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MoviesAdmin;
