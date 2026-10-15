import React, { useEffect, useState } from 'react';
import { TracksService } from './api/tracks.service';
import { Track } from './types';

export function Catalog() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    TracksService.getAll()
      .then((data) => {
        setTracks(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const togglePlay = (track: Track) => {
    if (playingId === track.id) {
      audio?.pause();
      setPlayingId(null);
    } else {
      audio?.pause();
      const newAudio = new Audio(track.previewUrl || track.audioUrl);
      newAudio.play().catch(e => console.log('Audio error:', e));
      newAudio.onended = () => setPlayingId(null);
      setAudio(newAudio);
      setPlayingId(track.id);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-zinc-400">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mb-4"></div>
        <p className="text-sm">Cargando catálogo desde Django...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-6 text-red-200 my-8">
        <h3 className="font-bold text-lg mb-1">Error conectando con el Backend</h3>
        <p className="text-sm text-red-300 mb-4">{error}</p>
        <p className="text-xs text-red-400">Verifica que Django esté corriendo en el puerto 8000.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Catálogo de Instrumentales</h2>
          <p className="text-sm text-zinc-400">{tracks.length} beats disponibles en la plataforma</p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">🎹</div>
          <h3 className="text-lg font-semibold text-white mb-1">No hay instrumentales aún en la base de datos</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
            La conexión con Django está funcionando exitosamente. Puedes agregar tracks desde el panel de administración de Django o subirlos como productor.
          </p>
          <a
            href="http://localhost:8000/admin/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
          >
            Abrir Django Admin (Cargar Tracks)
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="relative group aspect-square bg-zinc-950 overflow-hidden">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <button
                    onClick={() => togglePlay(track)}
                    className="absolute inset-0 m-auto w-14 h-14 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg transform transition active:scale-95"
                  >
                    {playingId === track.id ? '⏸' : '▶'}
                  </button>
                  <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-xs font-medium px-2.5 py-1 rounded-md text-zinc-200">
                    {track.genre}
                  </span>
                  <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-xs font-mono px-2 py-0.5 rounded text-zinc-300">
                    {track.bpm} BPM
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-base font-bold text-white truncate" title={track.title}>
                    {track.title}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    Por <span className="text-zinc-300 font-medium">{track.producerName}</span>
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">Licencia</span>
                  <span className="text-emerald-400 font-bold text-base">
                    ${Number(track.price).toLocaleString('es-CL')} CLP
                  </span>
                </div>
                <button
                  onClick={() => alert(`Agregado al carrito: ${track.title}`)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition"
                >
                  Comprar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center text-lg shadow-md">
            🎵
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">BeatsCloud</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Backend Django Conectado
          </span>
          <a
            href="http://localhost:8000/admin/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 hover:text-white transition"
          >
            Admin Django ↗
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <Catalog />
      </main>

      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        BeatsCloud © 2026 - Capstone Proyecto Integrado Frontend & Django
      </footer>
    </div>
  );
}

export default App;
