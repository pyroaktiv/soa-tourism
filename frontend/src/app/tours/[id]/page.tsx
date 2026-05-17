// src/app/tours/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getTour,
  addReview,
  uploadReviewImage,
} from "@/lib/services/tourService";
import { getUser } from "@/lib/auth";
import RoleGuard from "@/components/auth/RoleGuard";

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SEAWEEDFS_URL}${path}`;
};

export default function TouristTourPage() {
  const { id } = useParams() as { id: string };
  const [tour, setTour] = useState<any>(null);
  const currentUser = getUser();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTour(id)
      .then(setTour)
      .catch(() => setTour(null));
  }, [id]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return alert("Morate biti ulogovani!");
    setSubmitting(true);
    try {
      let imageUrls: string[] = [];

      if (reviewFiles.length > 0) {
        for (const file of reviewFiles) {
          const uploadedUrl = await uploadReviewImage(file);
          imageUrls.push(uploadedUrl);
        }
      }

      await addReview(id, rating, comment, visitDate + "T00:00:00Z", imageUrls);
      alert("Recenzija uspešno dodata!");
      getTour(id).then(setTour);
      setComment("");
      setReviewFiles([]);
    } catch (err) {
      alert("Greška pri dodavanju recenzije.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!tour) return <div className="text-center mt-10">Učitavanje...</div>;

  return (
    <RoleGuard allowedRoles={["tourist", "admin"]}>
      <div className="max-w-4xl mx-auto mt-10 pb-20">
        <div className="bg-white p-8 rounded-lg shadow border mb-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-4xl font-bold">{tour.name}</h1>
            <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded">
              Težina: {tour.difficulty}/5
            </span>
          </div>
          <p className="text-gray-700 text-lg mb-6">{tour.description}</p>
          <div className="flex gap-2">
            {tour.tags?.map((tag: string) => (
              <span
                key={tag}
                className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow border mb-8">
          <h2 className="text-2xl font-bold mb-4">Početna tačka ture</h2>
          {tour.keypoints && tour.keypoints.length > 0 ? (
            <div className="flex gap-4 items-center bg-gray-50 p-4 rounded border">
              {tour.keypoints[0].imageUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={getImageUrl(tour.keypoints[0].imageUrl)}
                  alt="KP"
                  className="w-24 h-24 object-cover rounded"
                />
              )}
              <div>
                <h3 className="font-bold text-lg">{tour.keypoints[0].name}</h3>
                <p className="text-gray-600">{tour.keypoints[0].description}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              Ova tura još uvek nema ključnih tačaka.
            </p>
          )}
        </div>

        <div className="bg-white p-8 rounded-lg shadow border">
          <h2 className="text-2xl font-bold mb-6">Recenzije</h2>

          {currentUser?.roles.includes("tourist") && (
            <form
              onSubmit={handleReviewSubmit}
              className="mb-8 p-4 border rounded bg-gray-50"
            >
              <h3 className="font-bold mb-4">Ostavi svoju recenziju</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Ocena (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Datum posete
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">Komentar</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-1">
                  Slike (Opciono)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setReviewFiles(Array.from(e.target.files));
                    } else {
                      setReviewFiles([]);
                    }
                  }}
                  className="w-full"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded"
              >
                {submitting ? "Slanje..." : "Pošalji recenziju"}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {tour.reviews?.map((r: any) => (
              <div key={r.id} className="border-b pb-4">
                <div className="flex justify-between">
                  <span className="font-bold">
                    {r.touristUsername || r.touristId}
                  </span>
                  <span className="text-yellow-500 font-bold">
                    ★ {r.rating}/5
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Posetio: {new Date(r.visitDate).toLocaleDateString()}
                </p>
                <p className="text-gray-700">{r.comment}</p>
                {r.imageUrls && r.imageUrls.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {r.imageUrls.map((url: string, idx: number) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={idx}
                        src={getImageUrl(url)}
                        alt={`Review ${idx + 1}`}
                        className="h-20 w-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
