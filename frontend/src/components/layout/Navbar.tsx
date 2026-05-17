// src/components/Navbar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser } from "@/lib/auth";
import { logoutUser } from "@/lib/services/authService";
import type { User } from "@/types/tourism/auth/v1/auth";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setUser(getUser());
    setMounted(true);
  }, [pathname]);

  if (!mounted) {
    return (
      <nav className="bg-blue-600 p-4 text-white shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">
            SOA Tourism
          </Link>
        </div>
      </nav>
    );
  }

  const isAdmin = user?.roles?.includes("admin");
  const isAuthor = user?.roles?.includes("author");
  const isTourist = user?.roles?.includes("tourist");

  return (
    <nav className="bg-blue-600 p-4 text-white shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          SOA Tourism
        </Link>
        <div className="flex items-center space-x-4">
          <Link href="/blogs" className="hover:text-blue-200">
            Blogovi
          </Link>

          {/* Autorski linkovi */}
          {isAuthor && (
            <Link href="/tours/mine" className="hover:text-blue-200">
              Moje Ture
            </Link>
          )}

          {/* Turistički linkovi - ubačeni samo oni za koje trenutno imamo back */}
          {isTourist && (
              <>
                <Link href="/tours" className="hover:text-blue-200">
                  Ture
                </Link>
                <Link href="/simulator" className="hover:text-blue-200">
                  Simulator
                </Link>
              </>
          )}

          {user ? (
            <>
              <Link href="/users" className="hover:text-blue-200">
                Pronađi Ljude
              </Link>
              <Link
                href={`/profiles/${user.id}`}
                className="hover:text-blue-200"
              >
                Moj Profil
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/users"
                  className="text-yellow-300 font-bold hover:text-yellow-100"
                >
                  Admin Panel
                </Link>
              )}
              <button
                onClick={logoutUser}
                className="bg-red-500 px-3 py-1 rounded text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Odjavi se
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-200">
                Prijava
              </Link>
              <Link
                href="/register"
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                Registracija
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
