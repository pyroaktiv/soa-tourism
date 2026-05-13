'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/services/stakeholdersService';
import RoleGuard from '@/components/auth/RoleGuard';

export default function EditProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [bio, setBio] = useState('');
  const [motto, setMotto] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const user = getUser();
    if (user) {
      setUserId(user.id);
      getProfile(user.id)
        .then((profile) => {
          if (profile) {
            setName(profile.name || '');
            setSurname(profile.surname || '');
            setBio(profile.bio || '');
            setMotto(profile.motto || '');
          }
        })
        .catch(err => console.error("Profil još ne postoji ili greška:", err))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    try {
      await updateProfile(userId, {
        userId,
        name,
        surname,
        bio,
        motto
      });
      setMessage('Profil uspešno ažuriran!');
      setTimeout(() => router.push(`/profiles/${userId}`), 1500);
    } catch (error) {
      setMessage('Došlo je do greške prilikom čuvanja.');
    }
  };

  if (loading) return <div className="text-center mt-10">Učitavanje...</div>;

  return (
    <RoleGuard allowedRoles={['tourist', 'author', 'admin']}>
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white border border-gray-200 shadow-sm rounded-lg">
        <h1 className="text-3xl font-bold mb-6 border-b pb-2">Uredi profil</h1>
        
        {message && <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">{message}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-medium mb-1">Ime</label>
              <input 
                type="text" className="w-full border p-2 rounded"
                value={name} onChange={(e) => setName(e.target.value)} 
              />
            </div>
            <div className="flex-1">
              <label className="block font-medium mb-1">Prezime</label>
              <input 
                type="text" className="w-full border p-2 rounded"
                value={surname} onChange={(e) => setSurname(e.target.value)} 
              />
            </div>
          </div>
          
          <div>
            <label className="block font-medium mb-1">Moto / Citat</label>
            <input 
              type="text" className="w-full border p-2 rounded"
              value={motto} onChange={(e) => setMotto(e.target.value)} 
              placeholder="Npr. Nije važno gde, već s kim!"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Biografija</label>
            <textarea 
              className="w-full border p-2 rounded h-32"
              value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Napišite nešto o sebi..."
            />
          </div>

          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 w-full mt-4">
            Sačuvaj izmene
          </button>
        </form>
      </div>
    </RoleGuard>
  );
}