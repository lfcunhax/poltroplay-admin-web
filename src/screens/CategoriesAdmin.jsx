import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit2, Tag } from 'lucide-react';

function CategoriesAdmin() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const catList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort alphabetically
      catList.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(catList);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'categories', editingId), { name: name.trim() });
      } else {
        await addDoc(collection(db, 'categories'), {
          name: name.trim(),
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error("Erro ao salvar categoria:", error);
      alert("Falha ao salvar categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja realmente excluir esta categoria?")) {
      await deleteDoc(doc(db, 'categories', id));
      fetchCategories();
    }
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setName(category.name);
    setIsModalOpen(true);
  };

  const openNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Categorias</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerencie as categorias de Filmes e Séries.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={openNew}>
          <Plus size={20} />
          Nova Categoria
        </button>
      </div>

      <div className="glass-card" style={{ padding: '0' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando categorias...</div>
        ) : categories.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma categoria cadastrada.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>Nome da Categoria</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', width: '150px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: '500' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Tag size={18} color="var(--primary-light)" />
                      {cat.name}
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button onClick={() => openEdit(cat)} style={{ color: 'var(--text-secondary)' }} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} style={{ color: 'var(--accent-alt)' }} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '24px' }}>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>Nome da Categoria</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-light)', borderRadius: '8px', padding: '0 16px' }}>
                  <Tag size={18} color="var(--text-muted)" />
                  <input 
                    type="text" 
                    style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '12px 0', width: '100%' }}
                    placeholder="Ex: Ação, Comédia..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSaving || !name.trim()}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoriesAdmin;
