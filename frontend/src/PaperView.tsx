import { useState, useEffect } from 'react';

interface PaperStatus {
  total_pnl_usd: number;
  trade_count: number;
}

export function PaperView() {
  const [status, setStatus] = useState<PaperStatus | null>(null);

  useEffect(() => {
    const fetchPaperStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/paper/status');
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch paper trading status:", error);
      }
    };
    fetchPaperStatus();
  }, []);

  return (
    <div>
      <div className="header">
        <h1>Paper Trading</h1>
        <div className="status-indicator paper-mode">SIMULATION</div>
      </div>
      
      <div className="kpi-grid">
        <div className="kpi-card">
          <h3>Total PnL (Simulado)</h3>
          <div className="value positive">${(status?.total_pnl_usd ?? 0).toFixed(2)}</div>
        </div>
        <div className="kpi-card">
          <h3>Total de Trades</h3>
          <div className="value">{status?.trade_count ?? 0}</div>
        </div>
      </div>

      <div className="card" style={{marginTop: '20px'}}>
        <h2>Histórico de Trades (Simulado)</h2>
        <p>A tabela de histórico de trades simulados seria implementada aqui, buscando dados de <code>/api/paper/trades</code>.</p>
      </div>
    </div>
  );
}