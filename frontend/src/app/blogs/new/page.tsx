// src/app/blogs/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createBlog } from '@/lib/services/blogService';
import RoleGuard from '@/components/auth/RoleGuard';
import ReactMarkdown from 'react-markdown';

export default function NewBlogPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const user = getUser();
    if (!user) return;

    try {
      await createBlog({
        authorId: user.id,
        title,
        description,
        images: [] // Ostavljamo prazno za sad, pošto su opcione
      });
      router.push('/blogs'); // Vrati ga na listu svih blogova
    } catch (err) {
      setError('Greška prilikom kreiranja bloga.');
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['tourist', 'author', 'admin']}>
      <div className="max-w-4xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Forma za unos */}
        <div className="bg-white p-6 border rounded-lg shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Napiši novi blog</h1>
          {error && <div className="text-red-500 mb-4">{error}</div>}
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block font-bold mb-1">Naslov</label>
              <input 
                type="text" className="w-full border p-2 rounded" 
                value={title} onChange={e => setTitle(e.target.value)} required 
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Tekst (Podržava Markdown)</label>
              <textarea 
                className="w-full border p-2 rounded h-64 font-mono text-sm" 
                value={description} onChange={e => setDescription(e.target.value)} required
                placeholder="# Naslov\n\n**Podebljan tekst** i *iskošen tekst*..."
              />
            </div>
            <button type="submit" disabled={loading} className="bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">
              {loading ? 'Objavljivanje...' : 'Objavi blog'}
            </button>
          </form>
        </div>

        {/* Live Preview Markdown-a */}
        <div className="bg-gray-50 p-6 border rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-500">Pregled bloga</h2>
          <div className="prose max-w-none">
            {description ? (
              <ReactMarkdown>{description}</ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">Ovde će se prikazati vaš formatiran tekst...</p>
            )}
          </div>
        </div>

      </div>
    </RoleGuard>
  );
}