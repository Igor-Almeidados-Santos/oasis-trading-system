// File: control-center/frontend/src/app/(auth)/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";

// Assumindo que definimos a interface Position em algum lugar (ex: lib/types.ts)
interface Position {
  symbol: string;
  quantity: string;
  average_price: string;
  mode: string;
}

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setError("Não autenticado."); // Deveria ser tratado pelo layout, mas como fallback
        setLoading(false);
        return;
      }

      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
        const response = await fetch(`${apiUrl}/api/v1/portfolio`, {
          headers: {
            Authorization: `Bearer ${token}`, // Envia o token
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Falha ao buscar portefólio");
        }

        const data: Position[] = await response.json();
        setPortfolio(data);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []); // Executa apenas na montagem inicial

  return (
    <div>
      <h1>Dashboard Principal</h1>
      {loading && <p>A carregar portefólio...</p>}
      {error && <p style={{ color: "red" }}>Erro: {error}</p>}
      {portfolio && (
        <div>
          <h2>Posições Atuais</h2>
          {portfolio.length === 0 ? (
            <p>Nenhuma posição aberta.</p>
          ) : (
            <table border={1} cellPadding={5}>
              <thead>
                <tr>
                  <th>Modo</th>
                  <th>Símbolo</th>
                  <th>Quantidade</th>
                  <th>Preço Médio</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((pos, index) => (
                  <tr key={index}>
                    <td>{pos.mode}</td>
                    <td>{pos.symbol}</td>
                    <td>{pos.quantity}</td>
                    <td>{pos.average_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {/* TODO: Adicionar mais painéis (Gráficos, Métricas, etc.) */}
    </div>
  );
}
