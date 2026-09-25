import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Track, CartItem, ProducerSubscription, SaleRecord, UserType } from '../types';
import { INITIAL_USERS, INITIAL_TRACKS, INITIAL_SUBSCRIPTIONS, INITIAL_SALES } from '../data/mockData';
import { audioEngine } from '../utils/audioEngine';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  tracks: Track[];
  cart: CartItem[];
  subscriptions: ProducerSubscription[];
  sales: SaleRecord[];
  activeTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  seekAudio: (seconds: number) => void;
  setAudioVolume: (volume: number) => void;
  toggleLike: (trackId: string) => void;
  addToCart: (track: Track) => boolean;
  removeFromCart: (trackId: string) => void;
  clearCart: () => void;
  checkoutCart: () => { success: boolean; buyOrder: string; amount: number };
  uploadTrack: (data: {
    title: string;
    genre: Track['genre'];
    price: number;
    description: string;
    coverUrl?: string;
    bpm: number;
    scaleKey: string;
    audioBeatType: Track['audioBeatType'];
  }) => Track;
  updateTrack: (trackId: string, data: Partial<Track>) => void;
  deleteTrack: (trackId: string) => void;
  addComment: (trackId: string, content: string) => void;
  deleteComment: (trackId: string, commentId: string) => void;
  switchUser: (userId: string) => void;
  login: (username: string) => boolean;
  registerUser: (username: string, email: string, artistName: string, role: UserType) => User;
  updateProfile: (data: Partial<User>) => void;
  subscribeToProducer: (sub: ProducerSubscription) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load from localStorage or defaults
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('bc_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [tracks, setTracks] = useState<Track[]>(() => {
    const saved = localStorage.getItem('bc_tracks');
    return saved ? JSON.parse(saved) : INITIAL_TRACKS;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('bc_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [subscriptions] = useState<ProducerSubscription[]>(INITIAL_SUBSCRIPTIONS);

  const [sales, setSales] = useState<SaleRecord[]>(() => {
    const saved = localStorage.getItem('bc_sales');
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('bc_current_user_id');
    return saved || 'user_art_1'; // Default as artist MC Flow
  });

  // Audio Player State
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolume] = useState<number>(0.8);

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('bc_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('bc_tracks', JSON.stringify(tracks));
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem('bc_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('bc_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('bc_current_user_id', currentUserId);
  }, [currentUserId]);

  // Audio Engine Hookup
  useEffect(() => {
    audioEngine.setCallbacks(
      (time, dur) => {
        setCurrentTime(time);
        setDuration(dur);
      },
      (playing) => {
        setIsPlaying(playing);
      }
    );
  }, []);

  const playTrack = (track: Track) => {
    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audioEngine.pause();
      } else {
        audioEngine.playTrack(track.id, track.audioBeatType, track.bpm, track.duration);
      }
    } else {
      setActiveTrack(track);
      audioEngine.playTrack(track.id, track.audioBeatType, track.bpm, track.duration);
    }
  };

  const togglePlay = () => {
    if (!activeTrack) {
      if (tracks.length > 0) {
        playTrack(tracks[0]);
      }
      return;
    }
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.playTrack(activeTrack.id, activeTrack.audioBeatType, activeTrack.bpm, activeTrack.duration);
    }
  };

  const seekAudio = (seconds: number) => {
    audioEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  const setAudioVolume = (vol: number) => {
    setVolume(vol);
    audioEngine.setVolume(vol);
  };

  const toggleLike = (trackId: string) => {
    if (!currentUser) return;
    const isLiked = currentUser.likedTrackIds.includes(trackId);

    // Update user's liked tracks
    const updatedUserLiked = isLiked
      ? currentUser.likedTrackIds.filter((id) => id !== trackId)
      : [...currentUser.likedTrackIds, trackId];

    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, likedTrackIds: updatedUserLiked } : u))
    );

    // Update track like count
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, likesCount: isLiked ? Math.max(0, t.likesCount - 1) : t.likesCount + 1 }
          : t
      )
    );
  };

  const addToCart = (track: Track): boolean => {
    if (currentUser?.purchasedTrackIds.includes(track.id)) {
      return false; // Already owned
    }
    const alreadyInCart = cart.some((item) => item.track.id === track.id);
    if (alreadyInCart) {
      return false;
    }
    setCart((prev) => [...prev, { track, addedAt: new Date().toISOString() }]);
    return true;
  };

  const removeFromCart = (trackId: string) => {
    setCart((prev) => prev.filter((item) => item.track.id !== trackId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const checkoutCart = () => {
    if (!currentUser || cart.length === 0) {
      return { success: false, buyOrder: '', amount: 0 };
    }

    const subtotal = cart.reduce((acc, item) => acc + item.track.price, 0);
    const iva = Math.round(subtotal * 0.19);
    const totalAmount = subtotal + iva;
    const buyOrder = 'BC-' + Math.floor(100000 + Math.random() * 900000);

    const purchasedIds = cart.map((item) => item.track.id);

    // Record sales
    const newSales: SaleRecord[] = cart.map((item) => ({
      id: 'sale_' + Math.random().toString(36).substr(2, 9),
      buyerId: currentUser.id,
      buyerName: currentUser.artistName || currentUser.username,
      trackId: item.track.id,
      trackTitle: item.track.title,
      amount: item.track.price,
      date: new Date().toISOString().split('T')[0],
      status: 'AUTHORIZED',
    }));

    setSales((prev) => [...newSales, ...prev]);

    // Update user's purchased tracks
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? { ...u, purchasedTrackIds: Array.from(new Set([...u.purchasedTrackIds, ...purchasedIds])) }
          : u
      )
    );

    // Empty cart
    setCart([]);

    return { success: true, buyOrder, amount: totalAmount };
  };

  const uploadTrack = (data: {
    title: string;
    genre: Track['genre'];
    price: number;
    description: string;
    coverUrl?: string;
    bpm: number;
    scaleKey: string;
    audioBeatType: Track['audioBeatType'];
  }): Track => {
    const id = 'track_' + Date.now();
    const newTrack: Track = {
      id,
      title: data.title,
      producerId: currentUser?.id || 'user_prod_1',
      producerName: currentUser?.artistName || currentUser?.username || 'Productor',
      producerUsername: currentUser?.username || 'productor',
      producerAvatar: currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      genre: data.genre,
      price: data.price,
      coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      description: data.description,
      bpm: data.bpm || 130,
      scaleKey: data.scaleKey || 'C Minor',
      duration: 180,
      likesCount: 0,
      tags: [data.genre, 'Nuevo', `${data.bpm} BPM`],
      audioBeatType: data.audioBeatType || 'trap',
      comments: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTracks((prev) => [newTrack, ...prev]);
    return newTrack;
  };

  const updateTrack = (trackId: string, data: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...data } : t)));
    if (activeTrack?.id === trackId) {
      setActiveTrack((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const deleteTrack = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (activeTrack?.id === trackId) {
      audioEngine.pause();
      setActiveTrack(null);
    }
    setCart((prev) => prev.filter((item) => item.track.id !== trackId));
  };

  const addComment = (trackId: string, content: string) => {
    if (!currentUser || !content.trim()) return;
    const newComment = {
      id: 'comm_' + Date.now(),
      userId: currentUser.id,
      username: currentUser.username,
      userAvatar: currentUser.avatarUrl,
      content: content.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, comments: [...t.comments, newComment] } : t))
    );

    if (activeTrack?.id === trackId) {
      setActiveTrack((prev) => (prev ? { ...prev, comments: [...prev.comments, newComment] } : null));
    }
  };

  const deleteComment = (trackId: string, commentId: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId) } : t
      )
    );
    if (activeTrack?.id === trackId) {
      setActiveTrack((prev) =>
        prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : null
      );
    }
  };

  const switchUser = (userId: string) => {
    setCurrentUserId(userId);
  };

  const login = (username: string): boolean => {
    const user = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
    );
    if (user) {
      setCurrentUserId(user.id);
      return true;
    }
    return false;
  };

  const registerUser = (
    username: string,
    email: string,
    artistName: string,
    role: UserType
  ): User => {
    const newUser: User = {
      id: 'user_' + Date.now(),
      username: username.toLowerCase().replace(/\s+/g, '_'),
      artistName: artistName || username,
      email,
      role,
      bio: role === 'productor' ? 'Nuevo productor musical en BeatsCloud.' : 'Nuevo artista independiente en BeatsCloud.',
      avatarUrl:
        role === 'productor'
          ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
      purchasedTrackIds: [],
      likedTrackIds: [],
      subscriptions: [],
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    return newUser;
  };

  const updateProfile = (data: Partial<User>) => {
    if (!currentUser) return;
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, ...data } : u)));
  };

  const subscribeToProducer = (sub: ProducerSubscription): boolean => {
    if (!currentUser) return false;
    const currentSubs = currentUser.subscriptions || [];
    if (currentSubs.includes(sub.id)) return false;

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id ? { ...u, subscriptions: [...(u.subscriptions || []), sub.id] } : u
      )
    );
    return true;
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        tracks,
        cart,
        subscriptions,
        sales,
        activeTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playTrack,
        togglePlay,
        seekAudio,
        setAudioVolume,
        toggleLike,
        addToCart,
        removeFromCart,
        clearCart,
        checkoutCart,
        uploadTrack,
        updateTrack,
        deleteTrack,
        addComment,
        deleteComment,
        switchUser,
        login,
        registerUser,
        updateProfile,
        subscribeToProducer,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
