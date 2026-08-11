import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja remover este registro de usuário?")) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setUsers(users.filter(u => u.id !== id));
      } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        alert("Erro ao deletar usuário.");
      }
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h1>Gerenciamento de Usuários</h1>
        <button className="btn-primary" onClick={fetchUsers}>
          <i className="fas fa-sync-alt"></i> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner">Carregando usuários...</div>
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Último Acesso</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    Nenhum usuário encontrado na coleção "users". 
                    <br />
                    (Certifique-se de que o aplicativo Flutter está salvando os dados do usuário no Firestore ao fazer login).
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-info-cell">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt="Avatar" className="user-avatar" />
                        ) : (
                          <div className="user-avatar-placeholder">
                            <i className="fas fa-user"></i>
                          </div>
                        )}
                        <span>{user.name || user.displayName || 'Sem Nome'}</span>
                      </div>
                    </td>
                    <td>{user.email || 'Sem Email'}</td>
                    <td>{user.lastLogin ? new Date(user.lastLogin?.toDate?.() || user.lastLogin).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <span className="status-badge success">Ativo</span>
                    </td>
                    <td>
                      <button className="btn-icon danger" onClick={() => handleDelete(user.id)} title="Remover Registro">
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UsersAdmin;
