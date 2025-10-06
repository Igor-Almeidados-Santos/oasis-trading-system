import { useState, useEffect } from 'react';

// Reutilize as interfaces e a lógica de busca do App.tsx original
// ... (cole aqui as interfaces Status, LoadingState e a lógica de busca do fetchStatus)

interface Status {
  product_id: string;
  position_size: number;
  average_price: number;
  realized_pnl: number;
}
type LoadingState = 'loading' | 'success' | 'error';


export function DashboardView() {
    const [status, setStatus] = useState<Status | null>(null);
    const [loadingState, setLoadingState] = useState<LoadingState>('loading');

     useEffect(() => {
        const fetchStatus = async () => {
        setLoadingState('loading'); 
        try {
            const response = await fetch('http://localhost:8000/api/status');
            if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data: Status = await response.json();
            setStatus(data);
            setLoadingState('success');
        } catch (error) {
            console.error("Failed to fetch status:", error);
            setLoadingState('error'); 
        }
        };

        fetchStatus(); 
        const interval = setInterval(fetchStatus, 5000); 

        return () => clearInterval(interval); 
    }, []);

    const formatNumber = (num: number | undefined, decimals: number) => (num ?? 0).toFixed(decimals);

    const PnlDisplay = ({ pnl }: { pnl: number | undefined }) => {
        const value = pnl ?? 0;
        const className = `value ${value >= 0 ? 'positive' : 'negative'}`;
        return <div className={className}>${formatNumber(value, 4)}</div>;
    };


  return (
    <div>
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
        </div>
      )}
    </div>
  );
}