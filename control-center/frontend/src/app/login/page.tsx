// File: control-center/frontend/src/app/login/page.tsx
'use client'; // Indica que este é um Componente de Cliente (interativo)

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      // Endereço do nosso API Backend (Go)
      // Em produção, viria de uma variável de ambiente NEXT_PUBLIC_API_URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha no login');
      }

      const data = await response.json();
      
      // --- Gestão do Token JWT ---
      if (data.access_token) {
        // Guarda o token no localStorage (Simples, mas vulnerável a XSS)
        // Em produção, considerar HttpOnly cookies ou gestão mais segura.
        localStorage.setItem('accessToken', data.access_token);
        
        // Redireciona para o dashboard após login bem-sucedido
        router.push('/dashboard');
      } else {
        throw new Error('Token não recebido');
      }

    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro desconhecido.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc' }}>
      <h2>Oasis Control Center - Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="username">Utilizador:</label><br />
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="password">Palavra-passe:</label><br />
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ padding: '10px 20px' }}>Entrar</button>
      </form>
    </div>
  );
}