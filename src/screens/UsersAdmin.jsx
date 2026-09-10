import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, Search, RefreshCw, Trash2, ShieldCheck, Mail, Calendar, UserCheck } from 'lucide-react';

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Tem certeza que deseja remover o usuário "${name || 'Selecionado'}"?`)) {
      try {
        setDeletingId(id);
        await deleteDoc(doc(db, 'users', id));
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        alert("Erro ao deletar usuário: " + error.message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const name = (user.name || user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const usersWithPhoto = users.filter(u => Boolean(u.photoUrl)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.03em' }}>
            Gerenciamento de Usuários
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
            Visualize os perfis cadastrados no aplicativo, fotos de perfil e status de acesso.
          </p>
        </div>

        <button 
          className="btn-primary" 
          onClick={fetchUsers} 
          disabled={loading}
          style={{ padding: '10px 20px', borderRadius: '12px' }}
        >
          <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Atualizando...' : 'Atualizar Lista'}
        </button>
      </div>

      {/* Cards de Métricas com Bordas Suaves */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(123, 47, 247, 0.15)', color: 'var(--primary-light)' }}>
            <Users size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total de Usuários</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(0, 212, 255, 0.15)', color: 'var(--accent)' }}>
            <UserCheck size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{usersWithPhoto}</div>
            <div className="stat-label">Com Foto de Perfil</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Contas Ativas</div>
          </div>
        </div>
      </div>

      {/* Barra de Busca */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Pesquisar usuário por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '44px', borderRadius: '12px' }}
          />
        </div>
      </div>

      {/* Tabela de Usuários com Bordas Suaves e Fotos Padronizadas */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          <div className="status-dot-online" style={{ margin: '0 auto 16px' }}></div>
          Carregando usuários do banco de dados...
        </div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Perfil & Nome</th>
                <th>Email</th>
                <th>Último Acesso</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    {searchTerm ? 'Nenhum usuário encontrado com esse termo.' : 'Nenhum usuário encontrado no Firestore.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const displayName = user.name || user.displayName || 'Sem Nome';
                  const initial = displayName.charAt(0).toUpperCase() || 'U';

                  let lastAccessStr = 'N/A';
                  if (user.lastLogin) {
                    try {
                      const dateObj = user.lastLogin?.toDate ? user.lastLogin.toDate() : new Date(user.lastLogin);
                      lastAccessStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    } catch (_) {}
                  }

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info-cell">
                          {user.photoUrl ? (
                            <img 
                              src={user.photoUrl} 
                              alt={displayName} 
                              className="user-avatar"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="user-avatar-placeholder" 
                            style={{ display: user.photoUrl ? 'none' : 'flex' }}
                          >
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {displayName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ID: {user.id.substring(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                          <Mail size={15} style={{ color: 'var(--text-muted)' }} />
                          <span>{user.email || 'Sem Email'}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <Calendar size={15} />
                          <span>{lastAccessStr}</span>
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-success">
                          <span className="status-dot-online" style={{ width: '6px', height: '6px' }}></span>
                          Ativo
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-danger" 
                          onClick={() => handleDelete(user.id, displayName)}
                          disabled={deletingId === user.id}
                          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
                          title="Remover Registro de Usuário"
                        >
                          <Trash2 size={14} />
                          {deletingId === user.id ? 'Removendo...' : 'Excluir'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export default UsersAdmin;
