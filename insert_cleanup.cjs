const fs = require('fs');
let code = fs.readFileSync('src/screens/SettingsAdmin.jsx', 'utf8');

const imports = `import { db } from '../firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { Settings, Save, CheckCircle, Trash2, Loader2 } from 'lucide-react';`;

code = code.replace(/import \{ Settings, Save, CheckCircle \} from 'lucide-react';/, imports);

const logic = `  const [cleaning, setCleaning] = useState(false);
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

      setCleanStatus(\`Concluído! \${totalUpdated} itens atualizados.\`);
      setTimeout(() => setCleanStatus(''), 5000);
    } catch (error) {
      console.error(error);
      alert('Erro ao limpar tags: ' + error.message);
      setCleanStatus('Erro na limpeza.');
    } finally {
      setCleaning(false);
    }
  };

  const handleSave`;

code = code.replace('  const handleSave', logic);

const ui = `        </form>
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
    </div>`;

code = code.replace(/        <\/form>\s*<\/div>\s*<\/div>/, ui);

fs.writeFileSync('src/screens/SettingsAdmin.jsx', code);
console.log('Settings updated');
