import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MusicGenre, Track } from '../types';
import { Search, SlidersHorizontal, Play, Pause, ShoppingCart, Heart, MessageSquare, Tag } from 'lucide-react';

interface CatalogPageProps {
  onOpenTrackDetail: (trackId: string) => void;
  onOpenProducerProfile: (producerId: string) => void;
}

const GENRES: ('Todos' | MusicGenre)[] = [
  'Todos',
  'Hip-Hop',
  'Reggaeton',
  'Electronica',
  'R&B',
  'Pop',
  'Rock',
  'Jazz',
  'Metal',
  'Soul',
];

export const CatalogPage: React.FC<CatalogPageProps> = ({
  onOpenTrackDetail,
  onOpenProducerProfile,
}) => {
  const { tracks, playTrack, activeTrack, isPlaying, addToCart, toggleLike, currentUser } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<'Todos' | MusicGenre>('Todos');
  const [sortBy, setSortBy] = useState<'recientes' | 'precio_menor' | 'precio_mayor' | 'likes'>('recientes');
  const [maxPrice, setMaxPrice] = useState<number>(50000);

  const filteredTracks = useMemo(() => {
    return tracks
      .filter((track) => {
        const matchesSearch =
          track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          track.producerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          track.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesGenre = selectedGenre === 'Todos' || track.genre === selectedGenre;
        const matchesPrice = track.price <= maxPrice;

        return matchesSearch && matchesGenre && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'precio_menor') return a.price - b.price;
        if (sortBy === 'precio_mayor') return b.price - a.price;
        if (sortBy === 'likes') return b.likesCount - a.likesCount;
        // Default: recientes
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tracks, searchTerm, selectedGenre, sortBy, maxPrice]);

  return (
    <div className="py-8 pb-32">
      {/* Catalog Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#171822] via-[#20222f] to-[#171822] border border-zinc-800 p-8 sm:p-10 mb-8 shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
          Catálogo de Beats & Instrumentales
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-2xl">
          Explora cientos de instrumentales listas para grabar. Adquiere derechos de uso comercial directo de los mejores productores.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#14151d] border border-zinc-800 rounded-2xl p-5 mb-8 shadow-lg">
        {/* Search input + Sort selector */}
        <div className="flex flex-col md:flex-row gap-4 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por título, productor o etiqueta (Trap, 808, Feid...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700/80 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ordenar:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-amber-400"
            >
              <option value="recientes">Más recientes</option>
              <option value="likes">Más populares</option>
              <option value="precio_menor">Precio: menor a mayor</option>
              <option value="precio_mayor">Precio: mayor a menor</option>
            </select>
          </div>
        </div>

        {/* Genre Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedGenre === genre
                  ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Price summary */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-white">
          Resultados ({filteredTracks.length})
        </h2>
        <span className="text-xs text-zinc-400">
          Mostrando instrumentales disponibles para compra inmediata
        </span>
      </div>

      {/* Tracks Grid */}
      {filteredTracks.length === 0 ? (
        <div className="text-center py-20 bg-[#14151d] rounded-2xl border border-zinc-800">
          <p className="text-base font-bold text-zinc-300">No se encontraron instrumentales</p>
          <p className="text-xs text-zinc-500 mt-1">Intenta con otros términos o cambia los filtros de género</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedGenre('Todos');
            }}
            className="mt-4 px-4 py-2 bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTracks.map((track) => {
            const isThisPlaying = isPlaying && activeTrack?.id === track.id;
            const isLiked = currentUser?.likedTrackIds.includes(track.id);
            const isPurchased = currentUser?.purchasedTrackIds.includes(track.id);

            return (
              <div
                key={track.id}
                className="bg-[#151620] rounded-2xl border border-zinc-800 hover:border-amber-400/40 p-4 transition-all hover:-translate-y-1 shadow-md flex flex-col justify-between group"
              >
                <div>
                  {/* Cover + Play Button Overlay */}
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-zinc-900">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                    {/* Central Play Button */}
                    <button
                      onClick={() => playTrack(track)}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                      title={isThisPlaying ? 'Pausar' : 'Reproducir'}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Genre Badge */}
                    <span className="absolute top-2.5 left-2.5 text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/70 text-amber-400 border border-amber-400/30">
                      {track.genre}
                    </span>

                    {/* Audio Pattern Tag */}
                    <span className="absolute bottom-2.5 left-2.5 text-[11px] font-mono text-zinc-300 bg-black/70 px-2 py-0.5 rounded">
                      {track.bpm} BPM • {track.scaleKey}
                    </span>
                  </div>

                  {/* Title & Producer */}
                  <h3
                    onClick={() => onOpenTrackDetail(track.id)}
                    className="font-bold text-white text-base hover:text-amber-400 cursor-pointer truncate transition-colors"
                  >
                    {track.title}
                  </h3>

                  <button
                    onClick={() => onOpenProducerProfile(track.producerId)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 mt-1 block truncate transition-colors"
                  >
                    Por <span className="font-semibold text-zinc-300">{track.producerName}</span>
                  </button>

                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                    {track.description}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold block uppercase">
                      Licencia
                    </span>
                    <span className="text-base font-black text-amber-400">
                      ${track.price.toLocaleString('es-CL')} CLP
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Like button */}
                    <button
                      onClick={() => toggleLike(track.id)}
                      className={`p-2 rounded-lg border transition-colors ${
                        isLiked
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                          : 'border-zinc-700/60 bg-zinc-800/80 text-zinc-400 hover:text-white'
                      }`}
                      title="Me gusta"
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    </button>

                    {/* Comment count button */}
                    <button
                      onClick={() => onOpenTrackDetail(track.id)}
                      className="p-2 rounded-lg border border-zinc-700/60 bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
                      title="Ver comentarios"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    {/* Cart / Purchased status */}
                    {!isPurchased ? (
                      <button
                        onClick={() => addToCart(track)}
                        className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-3 py-2 rounded-lg text-xs transition-colors shadow-sm"
                        title="Comprar / Agregar al carrito"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Comprar</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                        Adquirido
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
