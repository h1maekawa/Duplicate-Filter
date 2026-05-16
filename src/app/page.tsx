import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="lp-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div 
          className="hero-bg" 
          style={{ backgroundImage: 'url("/hero-bg.png")' }}
        ></div>
        
        <div className="hero-content animate-in">
          <span className="hero-tag">DATA ENGINEERING & AI SOLUTIONS</span>
          <h1 className="hero-title">
            Restaurant Data<br />
            Integration Pipeline
          </h1>
          <p className="hero-desc">
            散らばった店舗データを、洗練されたビジネス資産へ。
            高度な正規化、重複排除、チェーン店判定を一気通貫で自動化するプロフェッショナル・ツール。
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/tool" className="btn btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}>
              ツールを起動する
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '6rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Powerful Core Features</h2>
            <p style={{ color: 'var(--text-muted)' }}>データクレンジングの課題を、アルゴリズムで解決します</p>
          </div>

          <div className="feature-grid">
            <div className="feature-card glass-card">
              <div className="feature-icon">✨</div>
              <h3>高度な正規化エンジン</h3>
              <p>
                「(株)」などの業態語の除去、電話番号の書式統一、住所のゆらぎ補正など、
                日本国内の店舗データに特化した強力な正規化処理を実行します。
              </p>
              <div className="tech-tags">
                <span className="tech-tag">Regex</span>
                <span className="tech-tag">Normalization</span>
              </div>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon">🛡️</div>
              <h3>チェーン店自動排除</h3>
              <p>
                800件以上の主要チェーン店マスターを内蔵。
                部分一致や正規表現を組み合わせ、ターゲット外の店舗を瞬時にフィルタリングします。
              </p>
              <div className="tech-tags">
                <span className="tech-tag">Master Data</span>
                <span className="tech-tag">Filtering</span>
              </div>
            </div>

            <div className="feature-card glass-card">
              <div className="feature-icon">🧬</div>
              <h3>スコアリング重複排除</h3>
              <p>
                Union-Find アルゴリズムと多角的なスコアリング評価を統合。
                電話・位置・店名の類似度から、高精度に同一店舗を特定しマージします。
              </p>
              <div className="tech-tags">
                <span className="tech-tag">Union-Find</span>
                <span className="tech-tag">Fuzzy Matching</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container" style={{ padding: '6rem 2rem' }}>
        <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 400px' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem' }}>Full-Stack Performance</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.8' }}>
              このアプリケーションは、最新の Web テクノロジーを結集して構築されています。
              大規模な CSV 処理もローカル環境の Node.js サーバーを利用することで、制限なく高速に実行可能です。
              フロントエンドからバックエンドまで、一貫した型安全性と高可用性を実現しています。
            </p>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '1.5rem', color: '#fff' }}>Local</strong>
                <span className="summary-label">Execution Environment</span>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.5rem', color: '#fff' }}>100%</strong>
                <span className="summary-label">Data Privacy</span>
              </div>
            </div>
          </div>
          
          <div style={{ flex: '1 1 300px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="summary-item" style={{ background: 'rgba(255,255,255,0.05)' }}>Next.js 15</div>
            <div className="summary-item" style={{ background: 'rgba(255,255,255,0.05)' }}>TypeScript</div>
            <div className="summary-item" style={{ background: 'rgba(255,255,255,0.05)' }}>Node.js</div>
            <div className="summary-item" style={{ background: 'rgba(255,255,255,0.05)' }}>SheetJS</div>
          </div>
        </div>
      </section>

      {/* Local Usage Instructions */}
      <section style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '6rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>How to Use Locally</h2>
            <p style={{ color: 'var(--text-muted)' }}>安全かつ制限なくデータ処理を行うため、ローカル環境での起動を推奨しています</p>
          </div>

          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>1. リポジトリのクローン</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>GitHubからソースコードをダウンロードします。</p>
              <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#a5b4fc' }}>
                git clone https://github.com/h1maekawa/Duplicate-Filter.git<br/>
                cd Duplicate-Filter
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>2. 依存関係のインストール</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Node.js環境が必要です。必要なパッケージをインストールします。</p>
              <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#a5b4fc' }}>
                npm install
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>3. ローカルサーバーの起動</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>開発用サーバーを起動し、ブラウザでアクセスします。</p>
              <div style={{ background: '#000', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', color: '#a5b4fc' }}>
                npm run dev
              </div>
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.9rem' }}>
                ※ 起動後、ブラウザで <strong>http://localhost:3000</strong> （ポートが使用中の場合は3001等）にアクセスしてください。<br/>
                ※ 画面内の「ツールを起動する」ボタンから処理を実行できます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2024 Restaurant Pipeline Project. Built for Excellence.</p>
        <div style={{ marginTop: '1rem' }}>
          <Link href="/tool" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Launch Tool →
          </Link>
        </div>
      </footer>
    </div>
  );
}
