import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Image as ImageIcon, Link as LinkIcon, Trash2, Power } from 'lucide-react';

function PromotionsAdmin() {
  const [promotions, setPromotions] = useState([]);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'promotions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const promosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromotions(promosData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddPromotion = async (e) => {
    e.preventDefault();
    if (!title || !imageUrl || !targetUrl) {
      alert("Preencha todos os campos!");
      return;
    }

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'promotions'), {
        title,
        imageUrl,
        targetUrl,
        isActive: true,
        createdAt: serverTimestamp()
      });
      setTitle('');
      setImageUrl('');
      setTargetUrl('');
      alert("Promoção adicionada com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar:", error);
      alert("Erro ao adicionar promoção.");
    } finally {
      setIsAdding(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'promotions', id), {
        isActive: !currentStatus
      });
    } catch (error) {
      console.error("Erro ao alterar status:", error);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Deseja realmente remover esta promoção?")) {
      try {
        await deleteDoc(doc(db, 'promotions', id));
      } catch (error) {
        console.error("Erro ao deletar:", error);
      }
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h1>Anúncios e Promoções</h1>
        <p>Gerencie banners publicitários, produtos ou avisos para exibir no carrossel de destaques do app.</p>
      </div>

      <div className="form-card" style={{ marginBottom: '32px' }}>
        <h3>Nova Promoção</h3>
        
        {/* Aviso de Proporção exigido pelo usuário */}
        <div style={{
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          borderLeft: '4px solid #FFD700',
          padding: '16px',
          borderRadius: '4px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <ImageIcon color="#FFD700" size={24} />
          <div>
            <h4 style={{ margin: 0, color: '#FFD700', fontSize: '14px' }}>Atenção: Resolução Ideal</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
              Para garantir que a qualidade fique perfeita e não quebre o layout no carrossel do aplicativo, 
              <strong> utilize imagens na proporção horizontal (ex: 1280x720 ou 1920x1080)</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddPromotion} className="notification-form">
          <div className="form-group">
            <label>Título / Referência Interna</label>
            <input 
              type="text" 
              placeholder="Ex: Anúncio Camisetas Nerd" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>URL do Banner (Imagem 1280x720)</label>
            <input 
              type="text" 
              placeholder="https://exemplo.com/banner.jpg" 
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Link de Destino (Para onde o usuário vai ao clicar?)</label>
            <input 
              type="url" 
              placeholder="https://sua-loja.com/produto" 
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isAdding}>
            {isAdding ? 'Adicionando...' : <><Plus size={18} /> Adicionar ao Carrossel</>}
          </button>
        </form>
      </div>

      <div className="form-card">
        <h3>Promoções Ativas e Inativas</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Promoções marcadas como <strong>Ativas</strong> aparecerão misturadas com os filmes em destaque na tela inicial.
        </p>
        
        {promotions.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma promoção cadastrada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {promotions.map(promo => (
              <div key={promo.id} style={{ 
                display: 'flex', 
                gap: '16px', 
                background: 'var(--surface-light)', 
                padding: '16px', 
                borderRadius: '12px',
                border: `1px solid ${promo.isActive ? 'rgba(123, 47, 247, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                alignItems: 'center'
              }}>
                <img 
                  src={promo.imageUrl} 
                  alt={promo.title} 
                  style={{ width: '160px', height: '90px', objectFit: 'cover', borderRadius: '8px', opacity: promo.isActive ? 1 : 0.5 }} 
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/1280x720?text=Erro+na+Imagem' }}
                />
                
                <div style={{ flex: 1, opacity: promo.isActive ? 1 : 0.5 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{promo.title}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <LinkIcon size={14} />
                    <a href={promo.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)' }}>
                      {promo.targetUrl}
                    </a>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    onClick={() => toggleStatus(promo.id, promo.isActive)}
                    className="btn-secondary"
                    style={{ 
                      padding: '8px', 
                      display: 'flex', 
                      gap: '8px', 
                      justifyContent: 'center',
                      borderColor: promo.isActive ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255,255,255,0.1)',
                      color: promo.isActive ? '#00D4FF' : 'var(--text-muted)'
                    }}
                  >
                    <Power size={16} />
                    {promo.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button 
                    onClick={() => handleDelete(promo.id)}
                    className="btn-secondary"
                    style={{ padding: '8px', display: 'flex', gap: '8px', justifyContent: 'center', color: '#ff4d4d', borderColor: 'rgba(255, 77, 77, 0.2)' }}
                  >
                    <Trash2 size={16} /> Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PromotionsAdmin;
