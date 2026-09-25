import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserType } from '../types';
import { Users, Search, Sliders, Mic2, Disc, ArrowRight } from 'lucide-react';

interface UsersCatalogPageProps {
  onSelectUser: (userId: string, role: UserType) => void;
}

export const UsersCatalogPage: React.FC<UsersCatalogPageProps> = ({ onSelectUser }) => {
  const { users, tracks } = useApp();
  const [filterRole, setFilterRole] = useState<'todos' | UserType>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesRole = filterRole === 'todos' || u.role === filterRole;
    const matchesSearch =
      u.artistName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.bio.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="py-8 pb-32">
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#171822] via-[#20222f] to-[#171822] border border-zinc-800 p-8 sm:p-10 mb-8 shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
          <Users className="w-8 h-8 text-amber-400" />
          <span>Comunidad BeatsCloud</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base max-w-2xl">
          Conecta con productores destacados y artistas emergentes de toda la escena musical independiente.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#14151d] border border-zinc-800 rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-lg">
        {/* Role Toggle Pills */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterRole('todos')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterRole === 'todos'
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setFilterRole('productor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterRole === 'productor'
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Productores</span>
          </button>
          <button
            onClick={() => setFilterRole('artista')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterRole === 'artista'
                ? 'bg-amber-400 text-zinc-950'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Artistas</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o alias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => {
          const userTracks = tracks.filter((t) => t.producerId === user.id);

          return (
            <div
              key={user.id}
              className="bg-[#151722] border border-zinc-800 hover:border-amber-400/40 rounded-3xl overflow-hidden shadow-lg transition-all hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                {/* Banner Header */}
                <div className="h-24 relative overflow-hidden bg-zinc-800">
                  <img
                    src={user.bannerUrl}
                    alt={user.artistName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151722] to-transparent" />
                </div>

                {/* Avatar & Info */}
                <div className="px-6 -mt-10 relative">
                  <img
                    src={user.avatarUrl}
                    alt={user.artistName}
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-[#151722] shadow-xl"
                  />
                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {user.role === 'productor' ? '🎧 Productor' : '🎤 Artista'}
                    </span>
                    <h3 className="text-lg font-black text-white mt-1 leading-tight">
                      {user.artistName || user.username}
                    </h3>
                    <p className="text-xs text-zinc-400">@{user.username}</p>

                    <p className="text-xs text-zinc-300 mt-3 line-clamp-3 leading-relaxed">
                      {user.bio}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-6 pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-medium">
                  {user.role === 'productor' ? (
                    <span className="flex items-center gap-1 text-zinc-300 font-semibold">
                      <Disc className="w-3.5 h-3.5 text-amber-400" />
                      {userTracks.length} beats
                    </span>
                  ) : (
                    <span>{user.purchasedTrackIds.length} compras</span>
                  )}
                </span>

                <button
                  onClick={() => onSelectUser(user.id, user.role)}
                  className="bg-zinc-800 hover:bg-amber-400 hover:text-zinc-950 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5"
                >
                  <span>Ver Perfil</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
