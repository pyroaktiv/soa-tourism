// src/app/tours/[id]/edit/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  getTour,
  updateTour,
  publishTour,
  addTransportTime,
  addKeypoint,
  uploadKeypointImage,
} from "@/lib/services/tourService";
import RoleGuard from "@/components/auth/RoleGuard";
import TourMap from "@/components/map/TourMap";

const getImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SEAWEEDFS_URL}${path}`;
};

export default function EditTourPage() {
  const { id } = useParams() as { id: string };
  const [tour, setTour] = useState<any>(null);
  const router = useRouter();

  // Stanja za osnovne podatke
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState(1);
  const [tagsInput, setTagsInput] = useState("");
  const [price, setPrice] = useState(0);
  const [updating, setUpdating] = useState(false);

  // Stanja za transport
  const [minutes, setMinutes] = useState(0);
  const [transportType, setTransportType] = useState(1); // 1=FOOT, 2=BICYCLE, 3=CAR

  // Stanja za preview slike ključne tačke
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Stanja za klik na mapu
  const [clickedLat, setClickedLat] = useState<number | null>(null);
  const [clickedLng, setClickedLng] = useState<number | null>(null);

  // Stanje za selektovanu poziciju na mapi (nakon klika)
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getTour(id).then((data) => {
      setTour(data);
      setName(data.name);
      setDescription(data.description);
      setDifficulty(data.difficulty);
      setTagsInput(data.tags?.join(", ") || "");
      setPrice(data.price || 0);
    });
  }, [id]);

  const handleUpdateBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    try {
      await updateTour(id, {
        name,
        description,
        difficulty: Number(difficulty),
        tags,
        price: Number(price),
      });
      alert("Osnovni podaci ažurirani!");
      getTour(id).then(setTour);
    } catch (err) {
      alert("Greška pri ažuriranju.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePublish = async () => {
    try {
      await publishTour(id);
      alert("Tura je objavljena!");
      getTour(id).then(setTour);
      router.push("/tours/mine");
    } catch (err: any) {
      alert(err.response?.data?.message || "Neispunjeni uslovi za objavu!");
    }
  };

  if (!tour) return <div className="text-center mt-10">Učitavanje...</div>;

  const isPublished = tour.status === "PUBLISHED";

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    setClickedLat(latlng.lat);
    setClickedLng(latlng.lng);
    setSelectedPosition(latlng);
  };
  return (
    <RoleGuard allowedRoles={["author", "admin"]}>
      <div className="max-w-6xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
        {/* LEVA KOLONA: Kontrole */}
        <div className="space-y-6">
          {/* 1. OSNOVNI PODACI (Izmena) */}
          <div className="bg-white p-6 border rounded shadow-sm">
            <h2 className="text-xl font-bold mb-4">1. Osnovni podaci</h2>
            <form onSubmit={handleUpdateBasicInfo} className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700">
                  Naziv ture
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPublished}
                  className="w-full border p-2 rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700">
                  Opis
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPublished}
                  className="w-full border p-2 rounded h-24"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">
                    Težina (1-5)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    disabled={isPublished}
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">
                    Tagovi
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    disabled={isPublished}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700">
                    Cena ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    disabled={isPublished}
                    className="w-full border p-2 rounded"
                    required
                  />
                </div>
              </div>
              {!isPublished && (
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-gray-700"
                >
                  {updating ? "Čuvanje..." : "Sačuvaj izmene"}
                </button>
              )}
            </form>
          </div>

          {/* 2. USLOVI I TRANSPORT */}
          <div className="bg-white p-6 border rounded shadow-sm">
            <h2 className="text-xl font-bold mb-4">2. Objava i Transport</h2>
            <ul className="space-y-2 mb-4 text-sm font-medium">
              <li>✅ Osnovni podaci</li>
              <li
                className={
                  tour.keypoints?.length >= 2
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {tour.keypoints?.length >= 2 ? "✅" : "❌"} Bar 2 ključne tačke
                (Ima: {tour.keypoints?.length || 0})
              </li>
              <li
                className={
                  tour.transportTimes?.length >= 1
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {tour.transportTimes?.length >= 1 ? "✅" : "❌"} Bar jedno vreme
                transporta
              </li>
            </ul>

            <div className="flex gap-2 mb-4">
              <input
                type="number"
                min="1"
                className="border p-2 w-24 rounded"
                placeholder="Minuti"
                value={minutes || ""}
                onChange={(e) => setMinutes(Number(e.target.value))}
                disabled={isPublished}
              />
              <select
                className="border p-2 rounded"
                value={transportType}
                onChange={(e) => setTransportType(Number(e.target.value))}
                disabled={isPublished}
              >
                <option value={1}>Peške</option>
                <option value={2}>Bicikl</option>
                <option value={3}>Auto</option>
              </select>
              <button
                onClick={async () => {
                  if (minutes > 0) {
                    await addTransportTime(id, transportType, minutes);
                    getTour(id).then(setTour);
                  }
                }}
                disabled={isPublished}
                className="bg-blue-100 text-blue-800 px-4 py-2 rounded text-sm font-bold hover:bg-blue-200"
              >
                Dodaj
              </button>
            </div>

            {/* Prikaz dodatih transporta */}
            {tour.transportTimes && tour.transportTimes.length > 0 && (
              <div className="mb-4 flex gap-2 flex-wrap">
                {tour.transportTimes.map((tt: any, i: number) => (
                  <span
                    key={i}
                    className="bg-gray-100 px-2 py-1 rounded text-xs border font-bold"
                  >
                    {tt.transport}: {tt.minutes} min
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={isPublished}
              className="w-full bg-green-600 text-white font-bold py-3 rounded disabled:bg-gray-400 hover:bg-green-700 transition-colors"
            >
              {isPublished ? "TURA JE OBJAVLJENA" : "OBJAVI TURU"}
            </button>
          </div>

          {/* 3. DODAVANJE KLJUČNE TAČKE */}
          <div className="bg-blue-50 p-6 border border-blue-200 rounded shadow-sm">
            <h2 className="text-xl font-bold mb-2">3. Ključne Tačke</h2>
            <p className="text-sm text-blue-800 mb-4">
              <em>Ovde će se automatski ubaciti koordinate nakon klika.</em>
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const name = (
                  form.elements.namedItem("kpName") as HTMLInputElement
                ).value;
                const desc = (
                  form.elements.namedItem("kpDesc") as HTMLInputElement
                ).value;
                const lat = Number(
                  (form.elements.namedItem("kpLat") as HTMLInputElement).value,
                );
                const lng = Number(
                  (form.elements.namedItem("kpLng") as HTMLInputElement).value,
                );
                const fileInput = form.elements.namedItem(
                  "kpImage",
                ) as HTMLInputElement;

                try {
                  let imgUrl = "";
                  if (fileInput.files && fileInput.files[0]) {
                    imgUrl = await uploadKeypointImage(fileInput.files[0]);
                  }
                  await addKeypoint(id, name, desc, lat, lng, imgUrl);
                  alert("Tačka dodata!");
                  getTour(id).then(setTour);
                  form.reset();
                  setImagePreview(null);
                } catch (err) {
                  alert("Greška pri dodavanju tačke.");
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="kpLat"
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  disabled={isPublished}
                  className="border p-2 rounded"
                  required
                  value={clickedLat ?? ""}
                  onChange={(e) => setClickedLat(Number(e.target.value) || null)}
                />
                <input
                  name="kpLng"
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  disabled={isPublished}
                  className="border p-2 rounded"
                  required
                  value={clickedLng ?? ""}
                  onChange={(e) => setClickedLng(Number(e.target.value) || null)}
                />
              </div>
              <input
                name="kpName"
                type="text"
                placeholder="Naziv lokacije (npr. Muzej)"
                disabled={isPublished}
                className="w-full border p-2 rounded"
                required
              />
              <textarea
                name="kpDesc"
                placeholder="Opis lokacije"
                disabled={isPublished}
                className="w-full border p-2 rounded"
                required
              />

              <div>
                <label className="block text-sm font-bold mb-2 text-blue-900">
                  Slika lokacije
                </label>

                {/* PREVIEW SLIKE PRE UPLOADA */}
                {imagePreview && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="mb-2 h-32 w-full object-cover rounded border border-gray-300"
                  />
                )}

                <input
                  name="kpImage"
                  type="file"
                  accept="image/*"
                  disabled={isPublished}
                  className="w-full bg-white border p-1 rounded"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImagePreview(URL.createObjectURL(file));
                    } else {
                      setImagePreview(null);
                    }
                  }}
                />
              </div>

              {!isPublished && (
                <button
                  type="submit"
                  className="bg-blue-600 text-white font-bold py-2 px-4 rounded w-full hover:bg-blue-700"
                >
                  + Sačuvaj tačku na mapu
                </button>
              )}
            </form>

            {/* PRIKAZ TRENUTNIH TAČAKA SA SLIKOM */}
            <div className="mt-8">
              <h3 className="font-bold mb-3 border-b border-blue-200 pb-1">
                Unesene tačke ({tour.keypoints?.length || 0}):
              </h3>
              <ul className="space-y-3">
                {tour.keypoints?.map((kp: any, idx: number) => (
                  <li
                    key={idx}
                    className="bg-white p-3 border rounded shadow-sm flex items-center gap-4"
                  >
                    {kp.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={getImageUrl(kp.imageUrl)}
                        alt={kp.name}
                        className="w-16 h-16 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                        Nema slike
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">
                        {idx + 1}. {kp.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Koordinate: {kp.latitude.toFixed(4)},{" "}
                        {kp.longitude.toFixed(4)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* DESNA KOLONA: MAPA */}
        <div className="col-span-1">
          <div className="sticky top-24">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h2 className="text-xl font-bold mb-4">Mapa</h2>
              <TourMap 
                keypoints={tour.keypoints || []} 
                onMapClick={handleMapClick} 
                selectedPosition={selectedPosition}
              />
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
