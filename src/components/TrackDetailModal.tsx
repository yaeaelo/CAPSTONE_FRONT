import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Track } from '../types';
import {
  X,
  Play,
  Pause,
  ShoppingCart,
  Download,
  Heart,
  MessageSquare,
  Trash2,
  Send,
  ExternalLink,
  ShieldCheck,
  Disc3,
  Clock,
  Sparkles,
} from 'lucide-react';

interface TrackDetailModalProps {
  trackId: string | null;
  onClose: () => void;
  onOpenProducerProfile: (producerId: string) => void;
}

export const TrackDetailModal: React.FC<TrackDetailModalProps> = ({
  trackId,
  onClose,
  onOpenProducerProfile,
}) => {
  const {
    tracks,
    users,
    playTrack,
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    seekAudio,
    toggleLike,
    addToCart,
    addComment,
    deleteComment,
    currentUser,
  } = useApp();

  const [commentText, setCommentText] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!trackId) return null;

  const track = tracks.find((t) => t.id === trackId);
  if (!track) return null;

  const producer = users.find((u) => u.id === track.producerId);
  const isThisPlaying = isPlaying && activeTrack?.id === track.id;
  const isLiked = currentUser?.likedTrackIds.includes(track.id);
  const isPurchased = currentUser?.purchasedTrackIds.includes(track.id);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(track.id, commentText);
    setCommentText('');
  };

  const handleDownload = () => {
    setDownloadSuccess(true);
    // Simulate downloading high-res zip/wav stems
    const blob = new Blob(
      [
        `BeatsCloud License & Stems Certificate\nTrack: ${track.title}\nProducer: ${track.producerName}\nBPM: ${track.bpm}\nKey: ${track.scaleKey}\nPurchased by: ${currentUser?.artistName || 'Artist'}\nLicense: Full Commercial Rights (Unlimited Distribution)`,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title.replace(/[\s/]/g, '_')}_Licencia_BeatsCloud.txt`;
    a.click();
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#14151e] border border-zinc-800 rounded-3xl shadow-2xl overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white flex items-center justify-center border border-zinc-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header / Banner */}
        <div className="relative p-6 sm:p-8 bg-gradient-to-br from-zinc-900 via-[#181924] to-[#12131a] border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Big Cover */}
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 group bg-zinc-800 border border-zinc-700">
              <img
                src={track.coverUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => playTrack(track)}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-110"
              >
                {isThisPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              {isPurchased && (
                <span className="absolute top-2 left-2 text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded shadow">
                  Comprado
                </span>
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/40">
                  {track.genre}
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {track.bpm} BPM • {track.scaleKey}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
                {track.title}
              </h1>

              {/* Producer quick link */}
              <div
                onClick={() => {
                  onClose();
                  onOpenProducerProfile(track.producerId);
                }}
                className="flex items-center gap-2.5 text-zinc-300 hover:text-amber-400 cursor-pointer w-fit mb-4 transition-colors"
              >
                <img
                  src={track.producerAvatar}
                  alt={track.producerName}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-400/30"
                />
                <span className="text-sm font-bold">{track.producerName}</span>
                <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              </div>

              {/* Price & Action Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-zinc-900/90 border border-zinc-700/80 px-4 py-2 rounded-xl">
                  <span className="text-[10px] text-zinc-400 block uppercase font-bold">
                    Precio Licencia
                  </span>
                  <span className="text-lg font-black text-amber-400">
                    ${track.price.toLocaleString('es-CL')} CLP
                  </span>
                </div>

                {!isPurchased ? (
                  <button
                    onClick={() => addToCart(track)}
                    className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black px-5 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-400/20 hover:scale-105"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Agregar al Carrito</span>
                  </button>
                ) : (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black px-5 py-3 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
                  >
                    <Download className="w-4 h-4" />
                    <span>{downloadSuccess ? '¡Descargado!' : 'Descargar Stems & WAV'}</span>
                  </button>
                )}

                <button
                  onClick={() => toggleLike(track.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                    isLiked
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{track.likesCount} Likes</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Live Waveform scrubber bar inside modal */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono mb-2">
              <span className="font-bold text-amber-400">
                {isThisPlaying ? 'Reproduciendo vista previa' : 'Haz clic para escuchar'}
              </span>
              <span>
                {formatTime(isThisPlaying ? currentTime : 0)} / {formatTime(track.duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 h-12 bg-zinc-950/60 rounded-xl px-4 border border-zinc-800">
              {Array.from({ length: 48 }).map((_, i) => {
                const isActive = isThisPlaying && (currentTime / (track.duration || 180)) * 48 > i;
                const dynamicHeight = isThisPlaying
                  ? Math.sin(currentTime * 3 + i * 0.4) * 35 + 45
                  : (Math.sin(i * 0.5) * 20 + 35);

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (!isThisPlaying) playTrack(track);
                      seekAudio((i / 48) * (track.duration || 180));
                    }}
                    className="flex-1 h-full flex items-center justify-center focus:outline-none group py-1"
                    title={`Ir al punto ${Math.round((i / 48) * 100)}%`}
                  >
                    <div
                      className={`w-full rounded-full transition-all duration-150 ${
                        isActive
                          ? 'bg-amber-400 group-hover:bg-amber-300'
                          : 'bg-zinc-700 group-hover:bg-zinc-500'
                      }`}
                      style={{ height: `${Math.max(15, dynamicHeight)}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Body: Details + Comments */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Description, Details & Producer Info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white mb-2">Descripción del Beat</h3>
              <p className="text-sm text-zinc-300 leading-relaxed bg-[#191b26] p-4 rounded-xl border border-zinc-800">
                {track.description}
              </p>
            </div>

            {/* Technical Specs */}
            <div>
              <h3 className="text-base font-bold text-white mb-3">Detalles de Producción</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#191b26] p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block font-semibold">Tempo</span>
                  <span className="text-sm font-bold text-white">{track.bpm} BPM</span>
                </div>
                <div className="bg-[#191b26] p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block font-semibold">Tonalidad</span>
                  <span className="text-sm font-bold text-white">{track.scaleKey}</span>
                </div>
                <div className="bg-[#191b26] p-3 rounded-xl border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block font-semibold">Duración</span>
                  <span className="text-sm font-bold text-white">
                    {formatTime(track.duration)} min
                  </span>
                </div>
              </div>
            </div>

            {/* License Features */}
            <div className="bg-[#191b26] p-5 rounded-2xl border border-zinc-800">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>¿Qué incluye la Licencia Comercial?</span>
              </h4>
              <ul className="text-xs text-zinc-300 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Distribución ilimitada en Spotify, Apple Music, YouTube y TikTok</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Archivo máster en WAV 24-bit sin marcas de voz (un-tagged)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">✓</span>
                  <span>Pistas separadas (Trackout / Stems) para mezcla vocal profesional</span>
                </li>
              </ul>
            </div>

            {/* Comments Thread */}
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>Comentarios ({track.comments.length})</span>
              </h3>

              {/* Add comment form */}
              <form onSubmit={handleSendComment} className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder={
                    currentUser
                      ? 'Escribe tu comentario sobre este beat...'
                      : 'Inicia sesión para comentar'
                  }
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={!currentUser}
                  className="flex-1 bg-[#191b26] border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!currentUser || !commentText.trim()}
                  className="bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar</span>
                </button>
              </form>

              {/* Comments List */}
              <div className="space-y-3">
                {track.comments.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic py-2">
                    Aún no hay comentarios en este beat. ¡Sé el primero en opinar!
                  </p>
                ) : (
                  track.comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="bg-[#191b26] p-3.5 rounded-xl border border-zinc-800 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={comm.userAvatar}
                          alt={comm.username}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">@{comm.username}</span>
                            <span className="text-[10px] text-zinc-500">{comm.createdAt}</span>
                          </div>
                          <p className="text-xs text-zinc-300 mt-1">{comm.content}</p>
                        </div>
                      </div>

                      {/* Delete button if user is owner of comment */}
                      {currentUser?.id === comm.userId && (
                        <button
                          onClick={() => deleteComment(track.id, comm.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                          title="Eliminar mi comentario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Producer Mini Card */}
          <div>
            <div className="bg-[#191b26] p-6 rounded-2xl border border-zinc-800 sticky top-4">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block mb-4">
                Sobre el Productor
              </span>

              <div className="flex items-center gap-3 mb-4">
                <img
                  src={producer?.avatarUrl || track.producerAvatar}
                  alt={track.producerName}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-400/40"
                />
                <div>
                  <h4 className="font-bold text-white text-base leading-tight">
                    {track.producerName}
                  </h4>
                  <p className="text-xs text-zinc-400">@{track.producerUsername}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                    Productor Verificado
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                {producer?.bio ||
                  'Productor independiente especializado en géneros urbanos y alternativos.'}
              </p>

              <button
                onClick={() => {
                  onClose();
                  onOpenProducerProfile(track.producerId);
                }}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors border border-zinc-700 text-center block"
              >
                Ver Catálogo Completo del Productor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
