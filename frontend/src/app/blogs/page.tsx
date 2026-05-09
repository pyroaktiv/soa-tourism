// src/app/blogs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllBlogs } from '@/lib/services/blogService';
import type { Blog } from '@/types/tourism/blog/v1/blog';

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllBlogs()
      .then(setBlogs)
      .catch(err => console.error("Greška pri učitavanju blogova:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center mt-10">Učitavanje blogova...</div>;

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Svi Blogovi</h1>
        <Link 
          href="/blogs/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700"
        >
          + Kreiraj Blog
        </Link>
      </div>

      {blogs.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">Trenutno nema objavljenih blogova.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <div key={blog.id} className="border rounded-lg p-6 bg-white shadow-sm flex flex-col">
              <h2 className="text-xl font-bold mb-2 line-clamp-1">{blog.title}</h2>
              <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-grow">
                {blog.description.replace(/[#*`\-']/g, '')}
              </p>
              <div className="flex justify-between items-center mt-auto pt-4 border-t">
                <span className="text-xs text-gray-400">{blog.creationDate}</span>
                <Link 
                  href={`/blogs/${blog.id}`} 
                  className="text-blue-600 font-bold text-sm hover:underline"
                >
                  Pročitaj više →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}