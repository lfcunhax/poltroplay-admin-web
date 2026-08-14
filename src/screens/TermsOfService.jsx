import React from 'react';

function TermsOfService() {
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
            Termos de Serviço
          </h2>
          <p style={{ color: '#B0B0B0', marginTop: '12px', fontSize: '14px' }}>
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        <div style={{ lineHeight: '1.8', color: '#D0D0D0', fontSize: '15px' }}>
          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>1. Aceitação dos Termos</h3>
            <p>Ao baixar, instalar e utilizar o aplicativo PoltroPlay, você concorda com estes Termos de Serviço. Se você não concordar com algum destes termos, por favor não utilize o aplicativo.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>2. Descrição do Serviço</h3>
            <p>O PoltroPlay é um aplicativo de entretenimento que permite aos usuários explorar, organizar e assistir conteúdos de filmes e séries. O aplicativo oferece:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li>Catálogo de filmes e séries com informações detalhadas.</li>
              <li>Sistema de favoritos e lista personalizada.</li>
              <li>Reprodução de conteúdos multimídia.</li>
              <li>Notificações sobre novos conteúdos.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>3. Conta de Usuário</h3>
            <p>Para utilizar o PoltroPlay, é necessário fazer login com uma conta Google. Você é responsável por manter a segurança da sua conta e por todas as atividades realizadas sob ela.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>4. Uso Adequado</h3>
            <p>Ao utilizar o PoltroPlay, você concorda em:</p>
            <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
              <li>Não utilizar o aplicativo para fins ilegais ou não autorizados.</li>
              <li>Não tentar acessar áreas restritas do sistema.</li>
              <li>Não compartilhar sua conta com terceiros.</li>
              <li>Respeitar os direitos de propriedade intelectual de terceiros.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>5. Conteúdo</h3>
            <p>O conteúdo disponibilizado no PoltroPlay é fornecido "como está". Não garantimos a disponibilidade contínua de qualquer conteúdo específico. Reservamo-nos o direito de adicionar, modificar ou remover conteúdos a qualquer momento.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>6. Anúncios</h3>
            <p>O PoltroPlay pode exibir anúncios fornecidos pelo Google AdMob. Ao utilizar o aplicativo, você concorda com a exibição de anúncios conforme a política de publicidade do Google.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>7. Limitação de Responsabilidade</h3>
            <p>O PoltroPlay é fornecido sem garantias de qualquer tipo, expressas ou implícitas. Não nos responsabilizamos por quaisquer danos diretos, indiretos, incidentais ou consequenciais decorrentes do uso do aplicativo.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>8. Modificações</h3>
            <p>Reservamo-nos o direito de modificar estes Termos de Serviço a qualquer momento. As alterações entrarão em vigor imediatamente após sua publicação. O uso continuado do aplicativo após as modificações constitui aceitação dos novos termos.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>9. Encerramento</h3>
            <p>Podemos encerrar ou suspender o acesso ao aplicativo a qualquer momento, sem aviso prévio, por violação destes termos ou por qualquer outro motivo.</p>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ color: '#00D4FF', fontSize: '18px', marginBottom: '12px' }}>10. Contato</h3>
            <p>Para dúvidas sobre estes termos, entre em contato:</p>
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

export default TermsOfService;
