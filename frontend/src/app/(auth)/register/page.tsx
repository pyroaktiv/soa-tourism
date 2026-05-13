// src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerUser } from '@/lib/services/authService';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('tourist'); // Podrazumevana uloga
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registerUser({ username, email, password, roles: [role] });
      router.push('/');
    } catch (err) {
      setError('Greška prilikom registracije. Proverite podatke.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <div className="w-full max-w-md p-8 border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">Registracija</h2>
        
        {error && <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
        
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div>
            <label className="block mb-1 font-medium">Korisničko ime</label>
            <input 
              type="text" 
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Email adresa</label>
            <input 
              type="email" 
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Lozinka</label>
            <input 
              type="password" 
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Uloga</label>
            <select 
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="tourist">Turista</option>
              <option value="author">Autor</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded mt-2 hover:bg-blue-700">
            Registruj se
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Imate nalog? <Link href="/login" className="text-blue-600 font-bold hover:underline">Prijavite se</Link>
        </p>
      </div>
    </div>
  );
}