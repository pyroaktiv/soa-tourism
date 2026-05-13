'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getBlog, toggleLike, addComment } from '@/lib/services/blogService';
import { checkIsFollowing } from '@/lib/services/followerService';
import { getUser } from '@/lib/auth';
import type { Blog } from '@/types/tourism/blog/v1/blog';
import ReactMarkdown from 'react-markdown';

export default function SingleBlogPage() {
  const { id } = useParams() as { id: string };
  const currentUser = getUser();
  const currentUserId = currentUser?.id
  
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState('');
  const [hasLiked, setHasLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  const [canComment, setCanComment] = useState(false);

  useEffect(() => {
    const fetchBlogData = async () => {
      try {
        const fetchedBlog = await getBlog(id);
        setBlog(fetchedBlog);
        
        const likes = fetchedBlog.likedByUserIds || [];
        setLikeCount(likes.length);
        
        if (currentUserId) {
          setHasLiked(likes.includes(currentUserId));

          const isAdmin = currentUser.roles.includes('admin');
          const isAuthor = currentUserId === fetchedBlog.authorId;
          
          if (isAdmin || isAuthor) {
            setCanComment(true);
          } else {
            const following = await checkIsFollowing(currentUserId, fetchedBlog.authorId);
            setCanComment(following);
          }
        }
      } catch (err) {
        console.error("Greška pri dohvatanju bloga:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogData();
  }, [id, currentUserId]);

  const handleLike = async () => {
    if (!currentUser || !blog) return alert('Morate biti ulogovani da biste lajkovali!');
    const wasLiked = hasLiked;
    setHasLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      await toggleLike(blog.id, currentUser.id);
    } catch (error) {
      setHasLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !blog || !newComment.trim() || !canComment) return;

    try {
      const updatedBlog = await addComment(blog.id, currentUser.id, newComment);
      setBlog(updatedBlog);
      setNewComment('');
    } catch (error) {
      alert('Greška pri dodavanju komentara.');
    }
  };

  if (loading) return <div className="text-center mt-10">Učitavanje bloga...</div>;
  if (!blog) return <div className="text-center mt-10 text-red-500">Blog nije pronađen!</div>;

  return (
    <div className="max-w-3xl mx-auto mt-10 pb-10">
      
      <div className="bg-white border rounded-lg p-8 shadow-sm mb-6">
        <h1 className="text-4xl font-bold mb-2">{blog.title}</h1>
        <p className="text-sm text-gray-500 mb-6 flex gap-2">
          Objavio: <Link href={`/profiles/${blog.authorId}`} className="text-blue-600 hover:underline">{blog.authorUsername}</Link> | Objavljeno: {new Date(blog.creationDate).toLocaleDateString()}
        </p>
        
        <div className="prose max-w-none mb-8">
          <ReactMarkdown>{blog.description}</ReactMarkdown>
        </div>

        <div className="flex items-center border-t pt-4">
          <button 
            onClick={handleLike} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold border transition-colors ${
              hasLiked ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="text-xl">{hasLiked ? '❤️' : '🤍'}</span>
            <span>{likeCount} {likeCount === 1 ? 'Lajk' : 'Lajkova'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-8 shadow-sm">
        <h2 className="text-2xl font-bold mb-6">Komentari ({blog.comments?.length || 0})</h2>
        
        {!currentUser ? (
          <div className="mb-8 p-4 bg-gray-50 border rounded text-center text-gray-600">
            Morate biti ulogovani da biste ostavili komentar.
          </div>
        ) : canComment ? (
          <form onSubmit={handleAddComment} className="mb-8">
            <textarea 
              className="w-full border p-3 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Napiši komentar..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              required
            />
            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">
              Komentariši
            </button>
          </form>
        ) : (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded flex justify-between items-center">
            <span>Samo pratioci autora mogu da komentarišu ovaj blog.</span>
            <Link href={`/profiles/${blog.authorId}`} className="bg-white px-4 py-1 border border-yellow-300 rounded font-bold hover:bg-yellow-100">
              Vidi profil i zaprati
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {blog.comments?.slice().reverse().map((comment, index) => (
            <div key={index} className="border-b pb-4">
              <div className="flex justify-between items-center mb-2">
                <Link href={`/profiles/${comment.authorId}`} className="font-bold text-gray-800 hover:underline">
                  Korisnik: {comment.authorUsername}
                </Link>
                <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-gray-700">{comment.text}</p>
            </div>
          ))}
          {(!blog.comments || blog.comments.length === 0) && (
            <p className="text-gray-500">Nema komentara. Budi prvi!</p>
          )}
        </div>
      </div>
    </div>
  );
}