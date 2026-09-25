import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Track, MusicGenre } from '../types';
import { X, Upload, Music, Sparkles } from 'lucide-react';

interface UploadTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToEdit?: Track | null;
}

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
];

export const UploadTrackModal: React.FC<UploadTrackModalProps> = ({
  isOpen,
  onClose,
  trackToEdit,
}) => {
  const { uploadTrack, updateTrack } = useApp();

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState<MusicGenre>('Hip-Hop');
  const [price, setPrice] = useState<number>(18000);
  const [description, setDescription] = useState('');
  const [bpm, setBpm] = useState<number>(130);
  const [scaleKey, setScaleKey] = useState('C Minor');
  const [audioBeatType, setAudioBeatType] = useState<Track['audioBeatType']>('trap');
  const [coverUrl, setCoverUrl] = useState(PRESET_COVERS[0]);

  useEffect(() => {
    if (trackToEdit) {
      setTitle(trackToEdit.title);
      setGenre(trackToEdit.genre);
      setPrice(trackToEdit.price);
      setDescription(trackToEdit.description);
      setBpm(trackToEdit.bpm);
      setScaleKey(trackToEdit.scaleKey);
      setAudioBeatType(trackToEdit.audioBeatType);
      setCoverUrl(trackToEdit.coverUrl);
    } else {
      setTitle('');
      setGenre('Hip-Hop');
      setPrice(18000);
      setDescription('');
      setBpm(130);
      setScaleKey('C Minor');
      setAudioBeatType('trap');
      setCoverUrl(PRESET_COVERS[0]);
    }
  }, [trackToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (trackToEdit) {
      updateTrack(trackToEdit.id, {
        title,
        genre,
        price,
        description,
        bpm,
        scaleKey,
        audioBeatType,
        coverUrl,
      });
    } else {
      uploadTrack({
        title,
        genre,
        price,
        description,
        bpm,
        scaleKey,
        audioBeatType,
        coverUrl,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#14151e] border border-zinc-700 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 font-black flex items-center justify-center shadow-lg shadow-amber-400/20">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {trackToEdit ? 'Editar Instrumental' : 'Publicar Nuevo Beat'}
            </h2>
            <p className="text-xs text-zinc-400">
              Configura los detalles de tu producción y fija tu precio en pesos chilenos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5">
              Título de la Instrumental *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Código Postal (Hard Drill Beat)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                Género Musical *
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as MusicGenre)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="Hip-Hop">Hip-Hop</option>
                <option value="Reggaeton">Reggaetón</option>
                <option value="Electronica">Electrónica</option>
                <option value="R&B">R&B</option>
                <option value="Pop">Pop</option>
                <option value="Rock">Rock</option>
                <option value="Jazz">Jazz</option>
                <option value="Metal">Metal</option>
                <option value="Soul">Soul</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                Precio de Licencia ($ CLP) *
              </label>
              <input
                type="number"
                min={1000}
                step={500}
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">BPM (Tempo)</label>
              <input
                type="number"
                min={60}
                max={200}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">Tonalidad</label>
              <input
                type="text"
                placeholder="Ej: F# Minor, C Major"
                value={scaleKey}
                onChange={(e) => setScaleKey(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                Patrón de Audio
              </label>
              <select
                value={audioBeatType}
                onChange={(e) => setAudioBeatType(e.target.value as Track['audioBeatType'])}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="trap">Trap / 808s</option>
                <option value="reggaeton">Reggaetón Dembow</option>
                <option value="boom_bap">Boom Bap 90s</option>
                <option value="synthwave">Synthwave Retro</option>
                <option value="rnb">R&B / Soul</option>
                <option value="lofi">Lo-Fi Study</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5">
              Portada del Beat (Selecciona un arte o ingresa URL)
            </label>
            <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
              {PRESET_COVERS.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Preset"
                  onClick={() => setCoverUrl(url)}
                  className={`w-14 h-14 rounded-lg object-cover cursor-pointer transition-all ${
                    coverUrl === url ? 'ring-2 ring-amber-400 scale-105' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
            <input
              type="url"
              placeholder="O pega una URL directa de imagen..."
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-1.5">
              Descripción y detalles de los Stems
            </label>
            <textarea
              rows={3}
              placeholder="Describe el ambiente, los instrumentos empleados y las condiciones de la licencia..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-3 rounded-xl text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black py-3 rounded-xl text-xs transition-all shadow-md shadow-amber-400/20"
            >
              {trackToEdit ? 'Guardar Cambios' : 'Publicar en Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
