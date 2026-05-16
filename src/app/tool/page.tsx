'use client';

import { useState } from 'react';
import { generateExcelBlob } from '../../lib/restaurant-pipeline/excel-exporter';
import { generateCsvContent } from '../../lib/restaurant-pipeline/csv-exporter';

export default function PipelinePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [removeBusinessWords, setRemoveBusinessWords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (files.length === 0) {
      setError('入力ファイルを選択してください。');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('removeBusinessWords', String(removeBusinessWords));

    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '処理中にエラーが発生しました。');

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期せぬエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  const getExportFileName = (ext: string) => {
    const now = new Date();
    const dateStr = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + 
                    String(now.getMinutes()).padStart(2, '0');
    
    let prefix = '店舗統合結果';
    if (files.length > 0) {
      // ファイル名を分割して、媒体名などを除外する
      let namePart = files[0].name.split('.')[0];
      
      // 除外したい単語
      const ignoreWords = ['google', 'tabelog', 'hotpepper', '食べログ', 'ホットペッパー', 'グーグルマップ', 'マップ', 'map', 'の予約・クーポン'];
      
      // スペースや記号で分割
      let parts = namePart.split(/[\s_　!！|｜-]+/);
      
      // 不要な単語や空文字を除去
      let filteredParts = parts.filter(p => {
        const lp = p.toLowerCase();
        return p && !ignoreWords.some(ignore => lp.includes(ignore));
      });
      
      if (filteredParts.length > 0) {
        prefix = filteredParts.join('_') + '_重複統合結果';
      } else {
        prefix = '店舗_重複統合結果';
      }
    }
    
    return `${prefix}_${dateStr}.${ext}`;
  };

  const handleDownloadCsv = () => {
    if (!result) return;
    const csvContent = generateCsvContent(result);
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', getExportFileName('csv'));
    link.click();
  };

  const handleDownloadExcel = () => {
    if (!result) return;
    const blob = generateExcelBlob(result);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', getExportFileName('xlsx'));
    link.click();
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Restaurant Pipeline</h1>
        <p>店舗データの正規化・統合・重複排除をブラウザで実行</p>
      </header>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>1. データのアップロード</h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            入力データ (CSV / JSON 複数可)
          </label>
          <input
            type="file"
            multiple
            accept=".csv,.json"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '0.5rem' }}
          />
          <div className="file-list">
            {files.map((f, i) => (
              <div key={i} className="file-item">
                <span>{f.name}</span>
                <span className="status-badge status-info">入力データ</span>
              </div>
            ))}
          </div>
        </div>


        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="removeBusinessWords"
            checked={removeBusinessWords}
            onChange={(e) => setRemoveBusinessWords(e.target.checked)}
          />
          <label htmlFor="removeBusinessWords">業態語（居酒屋・カフェ等）を除去して正規化する</label>
        </div>

        <button className="btn btn-primary" onClick={handleRun} disabled={loading || files.length === 0} style={{ width: '100%' }}>
          {loading ? (
            <>
              <div className="loader"></div>
              処理中...
            </>
          ) : (
            'パイプラインを実行'
          )}
        </button>

        {error && (
          <div style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.9rem', padding: '1rem', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="result-area">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>2. 処理結果</h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleDownloadExcel}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>Excelで保存 (3シート)</span>
              </button>
              <button
                onClick={handleDownloadCsv}
                style={{
                  padding: '0.6rem 1.2rem',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                CSVで保存
              </button>
            </div>
            </div>

            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-value">{result.summary.inputCount}</span>
                <span className="summary-label">総入力件数</span>
              </div>
              <div className="summary-item">
                <span className="summary-value">{result.summary.chainExcludedCount}</span>
                <span className="summary-label">チェーン除外</span>
              </div>
              <div className="summary-item">
                <span className="summary-value">{result.summary.duplicateClusterCount}</span>
                <span className="summary-label">重複クラスタ</span>
              </div>
              <div className="summary-item">
                <span className="summary-value" style={{ color: '#818cf8' }}>{result.summary.outputCount}</span>
                <span className="summary-label">最終出力店舗数</span>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>上位 5 件の統合データ (プレビュー)</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem' }}>店名</th>
                      <th style={{ padding: '0.75rem' }}>ソース</th>
                      <th style={{ padding: '0.75rem' }}>住所</th>
                      <th style={{ padding: '0.75rem' }}>電話</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stores.slice(0, 5).map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem' }}>{s.name}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {s.sources.map((src: string, j: number) => (
                              <span key={j} className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px' }}>{src}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{s.address}</td>
                        <td style={{ padding: '0.75rem' }}>{s.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
