// src/app/tours/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTour } from "@/lib/services/tourService";
import RoleGuard from "@/components/auth/RoleGuard";

export default function NewTourPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    try {
      const newTour = await createTour({
        name,
        description,
        difficulty: Number(difficulty),
        tags,
      });
      router.push(`/tours/${newTour.id}/edit`);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Greška prilikom kreiranja ture.",
      );
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["author", "admin"]}>
      <div className="max-w-2xl mx-auto mt-10 bg-white p-8 rounded-lg shadow-sm border">
        <h1 className="text-3xl font-bold mb-6">Kreiraj novu turu</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block font-bold mb-1">Naziv ture</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Opis</label>
            <textarea
              className="w-full border p-2 rounded h-32"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Težina (1 - 5)</label>
            <input
              type="number"
              min="1"
              max="5"
              className="w-full border p-2 rounded"
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">
              Tagovi (odvojeni zarezom)
            </label>
            <input
              type="text"
              placeholder="npr. planina, priroda, reka"
              className="w-full border p-2 rounded"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700"
          >
            {loading ? "Kreiranje..." : "Kreiraj Turu (Draft)"}
          </button>
        </form>
      </div>
    </RoleGuard>
  );
}
