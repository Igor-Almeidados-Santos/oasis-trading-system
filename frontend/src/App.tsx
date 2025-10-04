import { useState, useEffect } from 'react';
import './App.css';

// Define a interface para os nossos dados de status
interface Status {
  product_id: string;
  position_size: number;
  average_price: number;
  realized_pnl: number;
}

// Define os possíveis estados da nossa aplicação
type LoadingState = 'loading' | 'success' | 'error';

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  useEffect(() => {
    const fetchStatus = async () => {
      setLoadingState('loading'); // Define como carregando a cada nova busca
      try {
        // A API está a correr em localhost:8000, conforme definido no docker-compose
        const response = await fetch('http://localhost:8000/api/status');
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data: Status = await response.json();
        setStatus(data);
        setLoadingState('success'); // Sucesso!
      } catch (error) {
        console.error("Failed to fetch status:", error);
        setLoadingState('error'); // Falha!
      }
    };

    fetchStatus(); // Busca inicial
    const interval = setInterval(fetchStatus, 5000); // Atualiza a cada 5 segundos

    return () => clearInterval(interval); // Limpa o intervalo ao desmontar o componente
  }, []);

  const formatNumber = (num: number | undefined, decimals: number) => (num ?? 0).toFixed(decimals);

  const PnlDisplay = ({ pnl }: { pnl: number | undefined }) => {
    const value = pnl ?? 0;
    const className = `value ${value >= 0 ? 'positive' : 'negative'}`;
    return <div className={className}>${formatNumber(value, 4)}</div>;
  };

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
          {loadingState === 'error' ? (
            <div className="status-indicator stopped">API OFFLINE</div>
          ) : (
            <div className="status-indicator operational">OPERATIONAL</div>
          )}
        </header>

        {loadingState === 'loading' && <div className="loading-message">A carregar dados...</div>}
        {loadingState === 'error' && <div className="error-message">Falha ao conectar à API. Verifique se todos os serviços Docker estão a correr.</div>}
        
        {loadingState === 'success' && (
          <div className="kpi-grid">
            <div className="kpi-card">
              <h3>Posição ({status?.product_id?.split('-')[0]})</h3>
              <div className="value">{formatNumber(status?.position_size, 6)}</div>
            </div>
            <div className="kpi-card">
              <h3>Preço Médio</h3>
              <div className="value">${formatNumber(status?.average_price, 2)}</div>
            </div>
            <div className="kpi-card">
              <h3>PnL Realizado</h3>
              <PnlDisplay pnl={status?.realized_pnl} />
            </div>
            {/* Cards futuros */}
            <div className="kpi-card"><h3>Valor Total (USDT)</h3><div className="value">$ --.--</div></div>
            <div className="kpi-card"><h3>PnL Não Realizado</h3><div className="value">$ --.--</div></div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;