'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getProfile } from '@/lib/services/stakeholdersService';
import { checkIsFollowing, followUser, unfollowUser } from '@/lib/services/followerService';
import { getUser } from '@/lib/auth';
import type { Profile } from '@/types/tourism/stakeholders/v1/stakeholders';
import Link from 'next/link';

export default function ProfilePage() {
  const { id } = useParams() as { id: string };
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Follow stanja
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  const currentUser = getUser();
  const currentUserId = currentUser?.id;
  const isMyProfile = currentUser?.id === id;

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const fetchedProfile = await getProfile(id);
        setProfile(fetchedProfile);
        
        if (currentUserId && !isMyProfile) {
          const followingStatus = await checkIsFollowing(currentUserId, id);
          setIsFollowing(followingStatus);
        }
      } catch (err) {
        console.error("Greška pri učitavanju:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAll();
  }, [id, currentUserId, isMyProfile]);

  const handleFollowToggle = async () => {
    if (!currentUser) return alert('Morate biti ulogovani!');
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(id);
        setIsFollowing(false);
      } else {
        await followUser(id);
        setIsFollowing(true);
      }
    } catch (err) {
      alert('Došlo je do greške pri promeni statusa praćenja.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-10">Učitavanje profila...</div>;
  if (!profile) return <div className="text-center mt-10 text-red-500">Profil nije pronađen.</div>;

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="bg-white border border-gray-200 p-8 rounded-lg shadow-sm flex flex-col items-center">
        <div className="w-32 h-32 bg-gray-300 rounded-full mb-4 flex items-center justify-center text-4xl overflow-hidden border-4 border-gray-100 shadow-sm">
          {profile.photoUrl ? (
             /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span>👤</span>
          )}
        </div>
        
        <h1 className="text-3xl font-bold">{profile.name} {profile.surname}</h1>
        <h2 className="text-1xl font-bold">{profile.username}</h2>
        {profile.motto && <p className="italic text-gray-500 mt-2">"{profile.motto}"</p>}
        
        {profile.bio && (
          <div className="mt-6 w-full text-left bg-gray-50 p-4 rounded border">
            <h3 className="font-bold border-b pb-1 mb-2">O meni</h3>
            <p className="whitespace-pre-wrap text-gray-700">{profile.bio}</p>
          </div>
        )}

        <div className="mt-6 flex gap-4">
          {isMyProfile ? (
            <Link href="/profiles/edit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
              Uredi profil
            </Link>
          ) : currentUser ? (
            <button 
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`px-6 py-2 font-bold rounded border-2 transition-colors ${
                isFollowing 
                  ? 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                  : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              }`}
            >
              {followLoading ? 'Učitavanje...' : isFollowing ? 'Otprati' : 'Zaprati'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}