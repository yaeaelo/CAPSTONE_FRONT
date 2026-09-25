import React from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, Volume2, VolumeX, Heart, ShoppingCart, Info } from 'lucide-react';

interface GlobalAudioPlayerProps {
  onOpenTrackDetail: (trackId: string) => void;
}

export const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ onOpenTrackDetail }) => {
  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    seekAudio,
    setAudioVolume,
    toggleLike,
    addToCart,
    currentUser,
  } = useApp();

  if (!activeTrack) {
    return null;
  }

  const isLiked = currentUser?.likedTrackIds.includes(activeTrack.id);
  const isPurchased = currentUser?.purchasedTrackIds.includes(activeTrack.id);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#121318]/95 backdrop-blur-xl border-t border-amber-400/20 shadow-2xl px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-full sm:w-1/4 min-w-[200px]">
          <div
            onClick={() => onOpenTrackDetail(activeTrack.id)}
            className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group shadow-md"
          >
            <img
              src={activeTrack.coverUrl}
              alt={activeTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Info className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => onOpenTrackDetail(activeTrack.id)}
              className="text-sm font-bold text-white hover:text-amber-400 truncate block text-left w-full transition-colors"
            >
              {activeTrack.title}
            </button>
            <p className="text-xs text-zinc-400 truncate">{activeTrack.producerName}</p>
          </div>
          <button
            onClick={() => toggleLike(activeTrack.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLiked ? 'text-rose-500 hover:text-rose-400' : 'text-zinc-400 hover:text-white'
            }`}
            title="Me gusta"
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center Controls & Interactive Waveform/Progress */}
        <div className="flex-1 w-full max-w-2xl flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center transition-transform hover:scale-105 shadow-md shadow-amber-400/20"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Live Waveform Equalizer Bars */}
            <div className="hidden md:flex items-center gap-1 h-6 px-3 bg-zinc-900/80 rounded-full border border-zinc-800">
              {Array.from({ length: 16 }).map((_, i) => {
                const height = isPlaying
                  ? Math.max(15, Math.sin((currentTime * 4) + i * 0.8) * 45 + 50)
                  : 20;
                return (
                  <div
                    key={i}
                    className="w-1 bg-amber-400/80 rounded-full transition-all duration-100"
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Time Scrubber */}
          <div className="w-full flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <div className="relative flex-1 group py-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekAudio(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400 group-hover:h-2 transition-all"
              />
              <div
                className="absolute left-0 top-1 h-1.5 bg-amber-400 rounded-lg pointer-events-none group-hover:h-2 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Actions: Volume & Quick Buy */}
        <div className="flex items-center justify-end gap-3 w-full sm:w-1/4">
          {/* Volume Control */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => setAudioVolume(volume > 0 ? 0 : 0.8)}
              className="text-zinc-400 hover:text-white"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setAudioVolume(Number(e.target.value))}
              className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Price & Buy Button */}
          {!isPurchased ? (
            <button
              onClick={() => addToCart(activeTrack)}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-amber-400/30 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>${activeTrack.price.toLocaleString('es-CL')}</span>
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
              ✓ Comprado
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
