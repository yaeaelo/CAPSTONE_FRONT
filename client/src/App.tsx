import { useEffect, useState } from 'react';
import { BeatsService, Beat } from './api/beats.service';

export function Catalog() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    BeatsService.getAll()
    .then((data) => setBeats(data))
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-white p-8">Cargando catálogo desde backend...</div>;
  if (error) return <div className="text-red-500 p-8">Error conectando al backend: {error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {beats.map((beat) => (
      <div key={beat.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <img src={beat.coverUrl} alt={beat.title} className="w-full h-48 object-cover rounded-lg mb-3" />
      <h3 className="text-lg font-bold text-white">{beat.title}</h3>
      <p className="text-neutral-400 text-sm">{beat.producer} · {beat.bpm} BPM · {beat.genre}</p>
      <div className="mt-4 flex justify-between items-center">
      <span className="text-emerald-400 font-semibold">${beat.price.toLocaleString('es-CL')} CLP</span>
      <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm">
      Reproducir
      </button>
      </div>
      </div>
    ))}
    </div>
  );
}
