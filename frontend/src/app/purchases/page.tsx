"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";
import { listMyPurchases } from "@/lib/services/paymentService";
import type { TourPurchaseToken } from "@/types/tourism/payment/v1/payment";

export default function PurchasesPage() {
  const [tokens, setTokens] = useState<TourPurchaseToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyPurchases()
      .then(setTokens)
      .finally(() => setLoading(false));
  }, []);

  return (
    <RoleGuard allowedRoles={["tourist"]}>
      <div className="max-w-4xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-6">Moje kupljene ture</h1>

        {loading && <p className="text-gray-500">Učitavanje...</p>}

        {!loading && tokens.length === 0 && (
          <div className="bg-white p-6 border rounded shadow-sm">
            <p className="text-gray-600 mb-4">Još niste kupili nijednu turu.</p>
            <Link
              href="/tours"
              className="text-blue-600 font-bold hover:underline"
            >
              Pregledaj dostupne ture →
            </Link>
          </div>
        )}

        {!loading && tokens.length > 0 && (
          <div className="grid gap-4">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="bg-white p-4 border rounded shadow-sm flex justify-between items-center"
              >
                <div>
                  <h2 className="text-xl font-bold">{token.tourName}</h2>
                  <p className="text-sm text-gray-500">
                    Kupljeno:{" "}
                    {new Date(token.purchasedAt).toLocaleString("sr-RS")}
                  </p>
                  <p className="text-sm text-gray-500">
                    Cena: {token.price.toFixed(2)} RSD
                  </p>
                </div>
                <Link
                  href={`/tours/${token.tourId}`}
                  className="text-blue-600 font-bold self-center"
                >
                  Pregledaj →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
