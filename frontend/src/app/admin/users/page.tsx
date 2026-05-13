'use client';

import { useEffect, useState } from 'react';
import { listUsers, blockUser } from '@/lib/services/authService';
import RoleGuard from '@/components/auth/RoleGuard';
import type { User } from '@/types/tourism/auth/v1/auth';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await listUsers(pageSize, page);
      setUsers(res.users || []);
      // int64 se iz gRPC preko buf-a često prenosi kao string, pa parsiramo
      setTotalCount(Number(res.totalCount) || 0);
    } catch (err) {
      console.error(err);
      setMessage('Došlo je do greške pri učitavanju korisnika.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page]);

  const handleBlockUser = async (userId: string, username: string) => {
    if (!confirm(`Da li ste sigurni da želite da blokirate korisnika: ${username}?`)) return;
    
    try {
      await blockUser(userId);
      setMessage(`Korisnik ${username} je uspešno blokiran.`);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setMessage(`Greška prilikom blokiranja korisnika ${username}.`);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="max-w-5xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-6">Upravljanje Korisnicima (Admin Panel)</h1>
        
        {message && (
          <div className="mb-4 p-3 bg-blue-100 text-blue-800 border border-blue-200 rounded">
            {message}
          </div>
        )}

        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-700">Korisničko Ime</th>
                <th className="px-6 py-3 font-medium text-gray-700">Email</th>
                <th className="px-6 py-3 font-medium text-gray-700">Uloge</th>
                <th className="px-6 py-3 font-medium text-gray-700">Status</th>
                <th className="px-6 py-3 font-medium text-gray-700">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-6">Učitavanje...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">Nema pronađenih korisnika.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold">{user.username}</td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      {user.roles?.map(role => (
                        <span key={role} className="inline-block bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full mr-1">
                          {role}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      {user.blocked ? (
                         <span className="text-red-600 font-bold">Blokiran</span>
                      ) : (
                         <span className="text-green-600 font-bold">Aktivan</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {/* Sakrij dugme ako je korisnik admin (da ne blokira sam sebe) ili ako je već blokiran */}
                      {!user.blocked && !user.roles?.includes('admin') && (
                        <button 
                          onClick={() => handleBlockUser(user.id, user.username)}
                          className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-xs transition-colors"
                        >
                          Blokiraj
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
              <span className="text-sm text-gray-600">
                Prikazano stranica {page} od {totalPages}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-200 font-medium"
                >
                  Prethodna
                </button>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-200 font-medium"
                >
                  Sledeća
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}