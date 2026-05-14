// src/app/tours/page.tsx
"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api"; // Dodaj direktan poziv pošto nismo dodali getPublishedTours u servis
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";

export default function PublishedToursPage() {
  const [tours, setTours] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get("/tours").then((res) => setTours(res.data.tours || []));
  }, []);

  return (
    <RoleGuard allowedRoles={["tourist", "admin"]}>
      <div className="max-w-5xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-6">Dostupne Ture</h1>
        <div className="grid gap-4">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="bg-white p-4 border rounded shadow-sm flex justify-between"
            >
              <div>
                <h2 className="text-xl font-bold">{tour.name}</h2>
                <p className="text-gray-500">Težina: {tour.difficulty}/5</p>
              </div>
              <Link
                href={`/tours/${tour.id}`}
                className="text-blue-600 font-bold self-center"
              >
                Pregledaj →
              </Link>
            </div>
          ))}
          {tours.length === 0 && (
            <p className="text-gray-500">Nema objavljenih tura.</p>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
