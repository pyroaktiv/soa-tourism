// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { User } from '@/types/tourism/auth/v1/auth';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <h1 className="text-5xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse">
        {user ? `✨ OMG DOBRODOŠLI NAZAD, ${user.username.toUpperCase()}! ✨` : '🚀 DOBRODOŠLI U SOA TOURISM 3000! 🚀'}
      </h1>
      
      <div className="text-lg text-gray-800 max-w-3xl space-y-6 bg-white p-8 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.1)] border-4 border-dashed border-pink-400">
        <p className="text-2xl font-black text-pink-600">
          🌟 SPREMI SE ZA REVOLUCIJU PUTOVANJA! 🌟
        </p>
        
        <p>
          Zaboravi na dosadne aplikacije! 😴 Naša <strong>M-I-K-R-O-S-E-R-V-I-S-N-A</strong> arhitektura 🤯 (da, imamo Gateway, Mongo, Neo4j, Go, Java, Python 🐍☕) donosi ti najluđe i najbrže iskustvo ikada! 🌍✈️🚀 
        </p>
        
        <p className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 text-left">
          ✍️ <strong>PIŠI BLOGOVE KAO HAKER:</strong> Podržavamo MARKDOWN! 💻 Budi pravi programer dok opisuješ svoj izlet na Zlatibor! 🌲⛰️ Lajkuj ❤️, ostavljaj komentare 💬 i postani ultimativni travel influenser! 📸💅
        </p>
        
        <p className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500 text-left">
          👯‍♀️ <strong>MREŽA NOVE GENERACIJE:</strong> Naš napredni <em>Neo4j GRAF ALGORITAM</em> 🕸️ analizira tvoje pratioce i preporučuje ti KOGA DA ZAPRATIŠ na osnovu zajedničkih prijatelja! 🧠🤖 Pronađi svoju travel srodnu dušu! 🤝🔥
        </p>
        
        <p className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500 text-left">
          🗺️ <strong>TURE (USKORO DOLAZI!):</strong> Skupljaj tokene 🪙, kupuj rute, prati GPS 🛰️ i osvajaj ključne tačke kao u video igrici! 🎮 Biće GIGACHAD nivo zabave! 🗿
        </p>

        <p className="font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 text-2xl pt-4 animate-bounce">
          👇 KORISTI MENI GORE DA ZAPOČNEŠ AVANTURU! 👇
        </p>
      </div>
    </div>
  );
}