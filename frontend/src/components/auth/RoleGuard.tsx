// src/components/auth/RoleGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    
    // Ako nije ulogovan, teraj ga na login
    if (!user) {
      router.push('/login');
      return;
    }

    const hasAllowedRole = user.roles.some((role) => allowedRoles.includes(role));
    
    if (!hasAllowedRole) {
      router.push('/'); 
      return;
    }

    setIsAuthorized(true);
    setLoading(false);
  }, [router, allowedRoles]);

  return <>{isAuthorized ? children : null}</>;
}