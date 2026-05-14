"use client";
import { useEffect, useState } from "react";
import {
  getMyTours,
  archiveTour,
  reactivateTour,
} from "@/lib/services/tourService";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";

export default function MyToursPage() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTours = () => {
    setLoading(true);
    getMyTours().then((data) => {
      setTours(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchTours();
  }, []);

  const handleArchive = async (id: string) => {
    if (confirm("Da li ste sigurni da želite da arhivirate ovu turu?")) {
      await archiveTour(id);
      fetchTours();
    }
  };

  const handleReactivate = async (id: string) => {
    await reactivateTour(id);
    fetchTours();
  };

  const renderTourList = (status: string, title: string) => {
    const filteredTours = tours.filter((t) =>
      t.status.toLowerCase().includes(status),
    );

    if (filteredTours.length === 0) return null;

    return (
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-4 border-b pb-2 uppercase text-gray-700">
          {title}
        </h2>
        <div className="grid gap-4">
          {filteredTours.map((tour) => (
            <div
              key={tour.id}
              className="bg-white p-4 border rounded shadow-sm flex justify-between items-center"
            >
              <div>
                <h3 className="text-lg font-bold">{tour.name}</h3>
                <p className="text-sm text-gray-500">
                  Kreirana: {new Date(tour.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3">
                {status === "draft" && (
                  <Link
                    href={`/tours/${tour.id}/edit`}
                    className="bg-blue-50 text-blue-600 px-4 py-2 rounded font-bold border border-blue-200 hover:bg-blue-100"
                  >
                    Uredi →
                  </Link>
                )}

                {status === "published" && (
                  <button
                    onClick={() => handleArchive(tour.id)}
                    className="bg-red-50 text-red-600 px-4 py-2 rounded font-bold border border-red-200 hover:bg-red-100"
                  >
                    Arhiviraj
                  </button>
                )}

                {status === "archived" && (
                  <button
                    onClick={() => handleReactivate(tour.id)}
                    className="bg-green-50 text-green-600 px-4 py-2 rounded font-bold border border-green-200 hover:bg-green-100"
                  >
                    Aktiviraj ponovo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <RoleGuard allowedRoles={["author", "admin"]}>
      <div className="max-w-5xl mx-auto mt-10 pb-20">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Upravljanje Turama
          </h1>
          <Link
            href="/tours/new"
            className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors"
          >
            + Nova Tura
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Učitavanje tura...</div>
        ) : (
          <>
            {renderTourList("draft", "Skice (Draft)")}
            {renderTourList("published", "Objavljene Ture")}
            {renderTourList("archived", "Arhiva")}

            {tours.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed rounded-lg bg-gray-50">
                <p className="text-gray-500">
                  Još uvek niste kreirali nijednu turu.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}
