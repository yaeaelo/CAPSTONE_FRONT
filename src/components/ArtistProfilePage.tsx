import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, Track } from '../types';
import {
  Play,
  Pause,
  Download,
  Heart,
  Music,
  ShoppingBag,
  ExternalLink,
  Edit3,
  CheckCircle,
} from 'lucide-react';

interface ArtistProfilePageProps {
  artistId?: string;
  onOpenTrackDetail: (trackId: string) => void;
  onNavigateCatalog: () => void;
}

export const ArtistProfilePage: React.FC<ArtistProfilePageProps> = ({
  artistId,
  onOpenTrackDetail,
  onNavigateCatalog,
}) => {
  const { currentUser, users, tracks, subscriptions, playTrack, activeTrack, isPlaying, updateProfile } = useApp();

  const [activeTab, setActiveTab] = useState<'compras' | 'favoritos' | 'membresias'>('compras');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState('');

  const targetUser: User = artistId
    ? users.find((u) => u.id === artistId) || (currentUser as User)
    : (currentUser as User);

  const isOwner = currentUser?.id === targetUser.id;

  const purchasedTracks = tracks.filter((t) => targetUser.purchasedTrackIds.includes(t.id));
  const likedTracks = tracks.filter((t) => targetUser.likedTrackIds.includes(t.id));
  const activeSubs = subscriptions.filter((s) => targetUser.subscriptions?.includes(s.id));

  const handleSaveBio = () => {
    updateProfile({ bio: editedBio });
    setIsEditingBio(false);
  };

  const handleDownload = (track: Track) => {
    const blob = new Blob(
      [
        `BeatsCloud License & Stems Certificate\nTrack: ${track.title}\nProducer: ${track.producerName}\nBPM: ${track.bpm}\nKey: ${track.scaleKey}\nPurchased by: ${targetUser.artistName}\nLicense: Full Commercial Rights (Unlimited Distribution)`,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title.replace(/[\s/]/g, '_')}_Licencia_BeatsCloud.txt`;
    a.click();
  };

  return (
    <div className="pb-32">
      {/* Banner */}
      <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800">
        <img
          src={targetUser.bannerUrl}
          alt={targetUser.artistName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f15] via-[#0e0f15]/50 to-transparent" />
      </div>

      {/* Profile Card */}
      <div className="relative -mt-20 px-4 sm:px-8 max-w-6xl mx-auto">
        <div className="bg-[#14151f] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
            <img
              src={targetUser.avatarUrl}
              alt={targetUser.artistName}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-4 ring-amber-400 shadow-2xl"
            />
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                  Artista / Cantante
                </span>
                <span className="text-xs text-zinc-400">@{targetUser.username}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
                {targetUser.artistName || targetUser.username}
              </h1>

              {!isEditingBio ? (
                <p className="text-xs sm:text-sm text-zinc-300 max-w-xl leading-relaxed">
                  {targetUser.bio || 'Sin biografía disponible aún.'}
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveBio}
                      className="px-3 py-1 bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setIsEditingBio(false)}
                      className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isOwner && (
            <button
              onClick={() => {
                setEditedBio(targetUser.bio);
                setIsEditingBio(!isEditingBio);
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold px-4 py-2.5 rounded-xl text-xs border border-zinc-700 transition-colors flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Bio</span>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div className="bg-[#14151f] p-4 rounded-2xl border border-zinc-800">
            <span className="text-xs text-zinc-400 block font-semibold">Instrumentales Compradas</span>
            <span className="text-2xl font-black text-amber-400">{purchasedTracks.length}</span>
          </div>
          <div className="bg-[#14151f] p-4 rounded-2xl border border-zinc-800">
            <span className="text-xs text-zinc-400 block font-semibold">Beats Guardados</span>
            <span className="text-2xl font-black text-rose-400">{likedTracks.length}</span>
          </div>
          <div className="bg-[#14151f] p-4 rounded-2xl border border-zinc-800">
            <span className="text-xs text-zinc-400 block font-semibold">Membresías VIP</span>
            <span className="text-2xl font-black text-emerald-400">{activeSubs.length}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mt-10 gap-6">
          <button
            onClick={() => setActiveTab('compras')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'compras' ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Mis Compras ({purchasedTracks.length})</span>
            {activeTab === 'compras' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('favoritos')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'favoritos' ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Beats Favoritos ({likedTracks.length})</span>
            {activeTab === 'favoritos' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('membresias')}
            className={`pb-3 text-sm font-bold transition-all relative ${
              activeTab === 'membresias' ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Membresías Activas ({activeSubs.length})</span>
            {activeTab === 'membresias' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Purchased Tracks */}
        {activeTab === 'compras' && (
          <div className="mt-8 space-y-4">
            {purchasedTracks.length === 0 ? (
              <div className="bg-[#14151f] border border-zinc-800 rounded-2xl p-10 text-center">
                <ShoppingBag className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-300">Aún no has comprado ninguna instrumental</p>
                <p className="text-xs text-zinc-500 mt-1 mb-4">
                  Las canciones que adquieras aparecerán aquí con descarga ilimitada de Stems.
                </p>
                <button
                  onClick={onNavigateCatalog}
                  className="px-5 py-2.5 bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs"
                >
                  Explorar Beats
                </button>
              </div>
            ) : (
              purchasedTracks.map((track) => {
                const isThisPlaying = isPlaying && activeTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    className="bg-[#14151f] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 group">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => playTrack(track)}
                          className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center"
                        >
                          {isThisPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="min-w-0">
                        <h4
                          onClick={() => onOpenTrackDetail(track.id)}
                          className="font-bold text-white text-base hover:text-amber-400 cursor-pointer truncate"
                        >
                          {track.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate">
                          Productor: <span className="text-zinc-300">{track.producerName}</span> •{' '}
                          <span className="text-emerald-400 font-semibold">Licencia Comercial</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownload(track)}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar WAV + Stems</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 2: Liked Tracks */}
        {activeTab === 'favoritos' && (
          <div className="mt-8 space-y-4">
            {likedTracks.length === 0 ? (
              <div className="bg-[#14151f] border border-zinc-800 rounded-2xl p-10 text-center text-sm text-zinc-400">
                No tienes beats guardados en favoritos.
              </div>
            ) : (
              likedTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-[#14151f] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <h4
                        onClick={() => onOpenTrackDetail(track.id)}
                        className="font-bold text-white text-sm hover:text-amber-400 cursor-pointer truncate"
                      >
                        {track.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate">{track.producerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-amber-400">
                      ${track.price.toLocaleString('es-CL')} CLP
                    </span>
                    <button
                      onClick={() => onOpenTrackDetail(track.id)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Subscriptions */}
        {activeTab === 'membresias' && (
          <div className="mt-8 space-y-4">
            {activeSubs.length === 0 ? (
              <div className="bg-[#14151f] border border-zinc-800 rounded-2xl p-10 text-center text-sm text-zinc-400">
                No tienes suscripciones activas actualmente.
              </div>
            ) : (
              activeSubs.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-[#14151f] border border-emerald-500/30 rounded-2xl p-5 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-400">
                      Suscripción Activa
                    </span>
                    <h4 className="text-lg font-black text-white">{sub.title}</h4>
                    <p className="text-xs text-zinc-400">
                      ${sub.price.toLocaleString('es-CL')} CLP / {sub.period}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold">
                    ✓ Activa
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
