'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getRecommendations } from '@/lib/services/followerService';
import { getUser } from '@/lib/auth';
import type { Recommendation } from '@/types/tourism/follower/v1/follower';
import RoleGuard from '@/components/auth/RoleGuard';

export default function UsersPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getUser();
    if (user) {
      getRecommendations(10)
        .then(res => setRecommendations(res.recommendations || []))
        .catch(err => console.error("Greška pri učitavanju preporuka:", err))
        .finally(() => setLoading(false));
    }
  }, []);

  return (
    <RoleGuard allowedRoles={['tourist', 'author', 'admin']}>
      <div className="max-w-4xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-8">Pronađi nove ljude</h1>

        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">Preporuke za vas</h2>
          <p className="text-sm text-gray-500 mb-6">
            Zasnovano na vašoj mreži pratilaca (zajednički prijatelji).
          </p>

          {loading ? (
            <p>Učitavanje preporuka...</p>
          ) : recommendations.length === 0 ? (
            <p className="text-gray-500">
              Trenutno nemamo novih preporuka. Zaprati nekoga da bismo pronašli slične profile!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div key={rec.userId} className="border border-gray-100 p-4 rounded flex items-center justify-between bg-gray-50">
                  <div>
                    <span className="font-bold text-gray-800 block">Korisnik: {rec.username}</span>
                    <span className="text-xs text-gray-500">Zajedničkih prijatelja: {rec.mutualFollows}</span>
                  </div>
                  <Link 
                    href={`/profiles/${rec.userId}`}
                    className="text-blue-600 text-sm font-bold bg-white border px-3 py-1 rounded hover:bg-blue-50"
                  >
                    Vidi profil
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}