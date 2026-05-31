"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  getCart,
  removeFromCart,
  checkout,
} from "@/lib/services/paymentService";
import type { ShoppingCart } from "@/types/tourism/payment/v1/payment";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<ShoppingCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await getCart();
      setCart(data);
    } catch {
      setError("Greška pri učitavanju korpe.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRemove = async (tourId: string) => {
    try {
      const updated = await removeFromCart(tourId);
      setCart(updated);
    } catch {
      alert("Neuspešno uklanjanje stavke.");
    }
  };

  const handleCheckout = async () => {
    if (!cart || !cart.items || cart.items.length === 0) return;
    setSubmitting(true);
    try {
      await checkout();
      router.push("/purchases");
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          "Checkout nije uspeo. Probajte ponovo."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["tourist"]}>
      <div className="max-w-4xl mx-auto mt-10">
        <h1 className="text-3xl font-bold mb-6">Moja korpa</h1>

        {loading && <p className="text-gray-500">Učitavanje...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && cart && (cart.items?.length ?? 0) === 0 && (
          <div className="bg-white p-6 border rounded shadow-sm">
            <p className="text-gray-600 mb-4">
              Vaša korpa je prazna.
            </p>
            <Link
              href="/tours"
              className="text-blue-600 font-bold hover:underline"
            >
              Pretraži dostupne ture →
            </Link>
          </div>
        )}

        {!loading && cart && (cart.items?.length ?? 0) > 0 && (
          <>
            <div className="bg-white border rounded shadow-sm divide-y">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <h2 className="text-lg font-bold">{item.tourName}</h2>
                    <p className="text-sm text-gray-500">
                      Dodato:{" "}
                      {new Date(item.addedAt).toLocaleString("sr-RS")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg">
                      {item.price.toFixed(2)} RSD
                    </span>
                    <button
                      onClick={() => handleRemove(item.tourId)}
                      className="text-red-500 hover:text-red-700 text-sm font-bold"
                    >
                      Ukloni
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border rounded shadow-sm p-4 mt-4 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Ukupno</p>
                <p className="text-2xl font-bold">
                  {cart.totalPrice.toFixed(2)} RSD
                </p>
              </div>
              <button
                onClick={handleCheckout}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded"
              >
                {submitting ? "Obrada..." : "Plati i završi"}
              </button>
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
