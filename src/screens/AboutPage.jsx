import React from 'react';

function AboutPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0A0A0A 0%, #1A1A2E 50%, #7B2FF7 100%)',
      color: '#fff',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            width: '120px',
            height: '120px',
            margin: '0 auto 24px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, #7B2FF7, #00D4FF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            boxShadow: '0 20px 60px rgba(123, 47, 247, 0.4)',
          }}>
            P
          </div>
          <h1 style={{
            fontSize: '40px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #7B2FF7, #00D4FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px',
          }}>PoltroPlay</h1>
          <p style={{ color: '#B0B0B0', fontSize: '18px', marginTop: '8px' }}>
            Seus filmes e séries favoritos em um só lugar
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '20px',
          padding: '40px 32px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '32px',
          textAlign: 'left',
        }}>
          <h2 style={{ color: '#00D4FF', fontSize: '22px', marginTop: 0, marginBottom: '16px' }}>Sobre o PoltroPlay</h2>
          <p style={{ lineHeight: '1.8', color: '#D0D0D0', fontSize: '15px' }}>
            O PoltroPlay é a plataforma definitiva de entretenimento para quem ama filmes e séries. 
            Com um catálogo vasto e atualizado, oferecemos uma experiência premium de streaming 
            com interface moderna, notificações inteligentes e recursos avançados como Chromecast.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '48px',
        }}>
          {[
            { icon: '🎬', title: 'Catálogo Vasto', desc: 'Milhares de filmes e séries atualizados diariamente.' },
            { icon: '📱', title: 'Interface Premium', desc: 'Design moderno com modo escuro e animações fluidas.' },
            { icon: '📺', title: 'Chromecast', desc: 'Transmita para sua TV com um toque.' },
            { icon: '🔔', title: 'Notificações', desc: 'Fique por dentro dos novos lançamentos.' },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>{item.icon}</div>
              <h3 style={{ fontSize: '16px', margin: '0 0 8px', color: '#fff' }}>{item.title}</h3>
              <p style={{ fontSize: '13px', color: '#B0B0B0', margin: 0, lineHeight: '1.5' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '32px',
        }}>
          <h3 style={{ color: '#00D4FF', fontSize: '18px', marginTop: 0 }}>Baixe Agora</h3>
          <a
            href="https://play.google.com/store/apps/details?id=com.poltroplay"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #7B2FF7, #00D4FF)',
              color: '#fff',
              borderRadius: '12px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              marginTop: '12px',
              transition: 'transform 0.2s',
            }}
          >
            Google Play Store
          </a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '32px', flexWrap: 'wrap' }}>
          <a href="/privacy" style={{ color: '#7B2FF7', textDecoration: 'none', fontSize: '14px' }}>Política de Privacidade</a>
          <a href="/terms" style={{ color: '#7B2FF7', textDecoration: 'none', fontSize: '14px' }}>Termos de Serviço</a>
        </div>

        <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#6C6C6C', fontSize: '13px' }}>© {new Date().getFullYear()} PoltroPlay. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
