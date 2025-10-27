// File: control-center/frontend/src/app/(auth)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Se não houver token, redireciona para a página de login
      router.replace('/login');
    }
    // TODO: Adicionar validação do token (ex: verificar expiração)
  }, [router]);

  // Se houver token (ou antes do useEffect correr), renderiza o conteúdo
  return <>{children}</>;
}