import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import { HomePage } from './components/HomePage';
import { CatalogPage } from './components/CatalogPage';
import { CartPage } from './components/CartPage';
import { UsersCatalogPage } from './components/UsersCatalogPage';
import { ProducerProfilePage } from './components/ProducerProfilePage';
import { ArtistProfilePage } from './components/ArtistProfilePage';
import { AboutPage } from './components/AboutPage';
import { TrackDetailModal } from './components/TrackDetailModal';
import { UploadTrackModal } from './components/UploadTrackModal';
import { AuthModal } from './components/AuthModal';
import { Track, UserType } from './types';
import { Music2 } from 'lucide-react';

export const App: React.FC = () => {
  const { currentUser } = useApp();

  const [currentTab, setCurrentTab] = useState<string>('inicio');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Profile view state
  const [viewedProfileId, setViewedProfileId] = useState<string | null>(null);
  const [viewedProfileRole, setViewedProfileRole] = useState<UserType>('productor');

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [trackToEdit, setTrackToEdit] = useState<Track | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handleOpenUpload = () => {
    setTrackToEdit(null);
    setUploadModalOpen(true);
  };

  const handleEditTrack = (track: Track) => {
    setTrackToEdit(track);
    setUploadModalOpen(true);
  };

  const handleOpenProducerProfile = (producerId: string) => {
    setViewedProfileId(producerId);
    setViewedProfileRole('productor');
    setCurrentTab('perfil_externo');
  };

  const handleSelectCommunityUser = (userId: string, role: UserType) => {
    setViewedProfileId(userId);
    setViewedProfileRole(role);
    setCurrentTab('perfil_externo');
  };

  return (
    <div className="min-h-screen bg-[#0d0e13] text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setViewedProfileId(null);
          setCurrentTab(tab);
        }}
        onOpenAuth={handleOpenAuth}
        onOpenUpload={handleOpenUpload}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-4">
        {currentTab === 'inicio' && (
          <HomePage
            onNavigateCatalog={() => setCurrentTab('catalogo')}
            onOpenTrackDetail={(id) => setSelectedTrackId(id)}
            onOpenAuth={handleOpenAuth}
            onOpenProducerProfile={handleOpenProducerProfile}
          />
        )}

        {currentTab === 'catalogo' && (
          <CatalogPage
            onOpenTrackDetail={(id) => setSelectedTrackId(id)}
            onOpenProducerProfile={handleOpenProducerProfile}
          />
        )}

        {currentTab === 'carrito' && (
          <CartPage
            onNavigateCatalog={() => setCurrentTab('catalogo')}
            onOpenTrackDetail={(id) => setSelectedTrackId(id)}
            onNavigateProfile={() => setCurrentTab('perfil')}
          />
        )}

        {currentTab === 'usuarios' && (
          <UsersCatalogPage onSelectUser={handleSelectCommunityUser} />
        )}

        {currentTab === 'sobre_nosotros' && <AboutPage />}

        {/* Current Logged-in User Profile */}
        {currentTab === 'perfil' && (
          currentUser?.role === 'productor' ? (
            <ProducerProfilePage
              onOpenTrackDetail={(id) => setSelectedTrackId(id)}
              onOpenUploadModal={handleOpenUpload}
              onEditTrack={handleEditTrack}
            />
          ) : (
            <ArtistProfilePage
              onOpenTrackDetail={(id) => setSelectedTrackId(id)}
              onNavigateCatalog={() => setCurrentTab('catalogo')}
            />
          )
        )}

        {/* External Viewed Profile */}
        {currentTab === 'perfil_externo' && viewedProfileId && (
          viewedProfileRole === 'productor' ? (
            <ProducerProfilePage
              producerId={viewedProfileId}
              onOpenTrackDetail={(id) => setSelectedTrackId(id)}
              onOpenUploadModal={handleOpenUpload}
              onEditTrack={handleEditTrack}
            />
          ) : (
            <ArtistProfilePage
              artistId={viewedProfileId}
              onOpenTrackDetail={(id) => setSelectedTrackId(id)}
              onNavigateCatalog={() => setCurrentTab('catalogo')}
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#0f1015] py-10 mb-20 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center font-black">
              <Music2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-zinc-300">
              Beats<span className="text-amber-400">Cloud</span>
            </span>
            <span>— Plataforma de música para artistas y productores</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('sobre_nosotros')}
              className="hover:text-zinc-300 transition-colors"
            >
              Sobre Nosotros
            </button>
            <button
              onClick={() => setCurrentTab('catalogo')}
              className="hover:text-zinc-300 transition-colors"
            >
              Catálogo
            </button>
            <span>© {new Date().getFullYear()} BeatsCloud. Todos los derechos reservados.</span>
          </div>
        </div>
      </footer>

      {/* Track Detail Modal */}
      <TrackDetailModal
        trackId={selectedTrackId}
        onClose={() => setSelectedTrackId(null)}
        onOpenProducerProfile={handleOpenProducerProfile}
      />

      {/* Upload Track Modal */}
      <UploadTrackModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        trackToEdit={trackToEdit}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        mode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSwitchMode={(mode) => setAuthMode(mode)}
      />

      {/* Global Persistent Audio Player */}
      <GlobalAudioPlayer onOpenTrackDetail={(id) => setSelectedTrackId(id)} />
    </div>
  );
};
