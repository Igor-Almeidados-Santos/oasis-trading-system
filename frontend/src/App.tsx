import { useState, useEffect } from 'react';
import './App.css';

interface Status {
  product_id: string;
  position_size: number;
  average_price: number;
  realized_pnl: number;
}

function App() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/status');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data: Status = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Atualiza a cada 5 segundos

    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number | undefined, decimals: number) => {
    return (num ?? 0).toFixed(decimals);
  };
  
  const PnlDisplay = ({ pnl }: { pnl: number | undefined }) => {
    const value = pnl ?? 0;
    const className = `value ${value >= 0 ? 'positive' : 'negative'}`;
    return <div className={className}>${formatNumber(value, 4)}</div>
  }

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Oasis</h2>
        <ul className="nav">
          <li className="active">Dashboard</li>
          <li>Trades</li>
          <li>Configurações</li>
        </ul>
      </div>
      <main className="main-content">
        <header className="header">
          <h1>Dashboard</h1>
          <div className="status-indicator operational">OPERATIONAL</div>
        </header>

        <div className="kpi-grid">
          <div className="kpi-card">
            <h3>Valor Total (USDT)</h3>
            <div className="value">$ --.--</div>
          </div>
          <div className="kpi-card">
            <h3>PnL Realizado</h3>
            <PnlDisplay pnl={status?.realized_pnl} />
          </div>
          <div className="kpi-card">
            <h3>PnL Não Realizado</h3>
            <div className="value">$ --.--</div>
          </div>
          <div className="kpi-card">
            <h3>Posição ({status?.product_id?.split('-')[0]})</h3>
            <div className="value">{formatNumber(status?.position_size, 6)}</div>
          </div>
          <div className="kpi-card">
            <h3>Preço Médio</h3>
            <div className="value">${formatNumber(status?.average_price, 2)}</div>
          </div>
        </div>
        
        {/* Grids futuros aqui */}

      </main>
    </div>
  );
}

export default App;