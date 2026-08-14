import React from 'react';

function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0A0A0A 0%, #1A1A2E 100%)',
      color: '#fff',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '48px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #7B2FF7, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}>PoltroPlay</h1>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
            Política de Privacidade
          </h2>
          <p style={{ color: '#B0B0B0', marginTop: '12px', fontSize: '14px' }}>
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div style={{ lineHeight: '1.8', color: '#D0D0D0', fontSize: '15px' }}>
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>1. Informações que Coletamos</h3>
            <p>O PoltroPlay coleta as seguintes informações quando você utiliza nosso aplicativo:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li><strong>Informações da conta Google:</strong> Nome, endereço de e-mail e foto de perfil, obtidos através do login via Google Sign-In.</li>
              <li><strong>Dados de uso:</strong> Informações sobre como você interage com o aplicativo, incluindo filmes e séries favoritos e histórico de visualização.</li>
              <li><strong>Dados do dispositivo:</strong> Tipo de dispositivo, sistema operacional e identificadores para envio de notificações push.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>2. Como Usamos suas Informações</h3>
            <p>Utilizamos suas informações para:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li>Criar e gerenciar sua conta de usuário.</li>
              <li>Personalizar sua experiência no aplicativo.</li>
              <li>Enviar notificações sobre novos conteúdos e atualizações.</li>
              <li>Melhorar nossos serviços e funcionalidades.</li>
              <li>Exibir anúncios relevantes através do Google AdMob.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>3. Compartilhamento de Dados</h3>
            <p>Não vendemos, trocamos ou transferimos suas informações pessoais para terceiros, exceto nos seguintes casos:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li><strong>Google Firebase:</strong> Utilizamos para autenticação, armazenamento de dados e notificações push.</li>
              <li><strong>Google AdMob:</strong> Para exibição de anúncios. O AdMob pode coletar dados de uso conforme a política do Google.</li>
              <li><strong>Exigência legal:</strong> Quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>4. Armazenamento e Segurança</h3>
            <p>Seus dados são armazenados de forma segura nos servidores do Google Firebase, que utiliza criptografia de ponta a ponta e segue os mais rigorosos padrões de segurança da indústria.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>5. Seus Direitos</h3>
            <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li>Acessar seus dados pessoais.</li>
              <li>Solicitar a correção de dados incompletos ou desatualizados.</li>
              <li>Solicitar a exclusão dos seus dados pessoais.</li>
              <li>Revogar o consentimento a qualquer momento.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>6. Exclusão de Dados</h3>
            <p>Você pode solicitar a exclusão total da sua conta e todos os dados associados entrando em contato conosco pelo e-mail abaixo. A exclusão será processada em até 30 dias.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>7. Contato</h3>
            <p>Para dúvidas ou solicitações relacionadas à privacidade, entre em contato:</p>
            <p style={{ marginTop: '8px' }}>📧 E-mail: <a href="mailto:contato@poltroplay.com" style={{ color: '#7B2FF7' }}>contato@poltroplay.com</a></p>
          </section>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#6C6C6C', fontSize: '13px' }}>© {new Date().getFullYear()} PoltroPlay. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
