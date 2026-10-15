import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  Track,
  CartItem,
  ProducerSubscription,
  SaleRecord,
  PurchaseRecord,
  UserType,
  ResourceType,
  MusicGenre,
  MoodType,
  LicenseContract,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_TRACKS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
} from '../data/mockData';
import { audioEngine } from '../utils/audioEngine';
import DjangoApi from '../api/django.service';
import { mapTrack, mapUser, djangoId } from '../api/mappers';

/**
 * MODO DE INTEGRACIÓN — "punto medio" para el Sprint 1 (ver docs/INTEGRACION_BACKEND.md):
 *   mock   → todo localStorage (demo sin backend, plan de respaldo si falla la red)
 *   hybrid → DATOS REALES del backend Django (catálogo, sesión, carrito con IVA
 *            server-side, likes, comentarios, Webpay create→redirect) sobre la UI
 *            existente. Las mutaciones que aún no tienen endpoint (registro con
 *            correo, subida con FFmpeg) siguen en local y se marcan en la UI.
 * Se selecciona con VITE_API_MODE (default: 'hybrid'). Si el backend no responde
 * al arrancar, el provider CAE automáticamente a 'mock' para no romper la demo.
 */
export type ApiMode = 'mock' | 'hybrid';
const CONFIGURED_MODE: ApiMode =
  ((import.meta.env.VITE_API_MODE as string | undefined) || 'hybrid') === 'mock' ? 'mock' : 'hybrid';

// Extensión interna del Track para URLs de audio real (la inyecta mappers.mapTrack)
type TrackWithSrc = Track & { previewSrc?: string; fullSrc?: string; downloadSrc?: string };

interface AppContextType {
  currentUser: User | null;
  users: User[];
  tracks: Track[];
  cart: CartItem[];
  subscriptions: ProducerSubscription[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  activeTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  activeResourceFilter: ResourceType | 'all';
  setActiveResourceFilter: (filter: ResourceType | 'all') => void;
  playTrack: (track: Track) => void;
  togglePlay: () => void;
  seekAudio: (seconds: number) => void;
  setAudioVolume: (volume: number) => void;
  toggleLike: (trackId: string) => void;
  addToCart: (track: Track) => boolean;
  removeFromCart: (trackId: string) => void;
  clearCart: () => void;
  // buyOrderOpcional: en modo real el buy_order lo emite el servidor al crear la
  // WebpayTransaction (create) y el SPA lo reenvía al confirmar (commit). En mock
  // se genera aquí si no se informa, imitando ese orden.
  checkoutCart: (buyOrderOpcional?: string) => { success: boolean; buyOrder: string; amount: number };
  uploadTrack: (data: {
    title: string;
    resourceType: ResourceType;
    genre: MusicGenre;
    subgenre?: string;
    price: number;
    description: string;
    coverUrl?: string;
    bpm: number;
    scaleKey: string;
    mood: MoodType;
    audioBeatType: Track['audioBeatType'];
    hasStems: boolean;
    hasWav: boolean;
    hasMidi: boolean;
    isFree?: boolean;
    allowFreeDownload?: boolean;
    hasWatermark?: boolean;
    duration?: number; // Segundos detectados del archivo subido (opcional)
  }) => Track;
  updateTrack: (trackId: string, data: Partial<Track>) => void;
  deleteTrack: (trackId: string) => void;
  claimFreeTrack: (trackId: string) => boolean;
  downloadAuditionDemo: (track: Track) => void;
  getContractForPurchase: (purchase: PurchaseRecord) => LicenseContract;
  getContractForSale: (sale: SaleRecord) => LicenseContract;
  generateLicenseForTrack: (track: Track) => LicenseContract;
  addComment: (trackId: string, content: string) => void;
  deleteComment: (trackId: string, commentId: string) => void;
  switchUser: (userId: string) => void;
  login: (username: string, password?: string) => boolean;
  logout: () => void;
  registerUser: (username: string, email: string, artistName: string, role: UserType) => User;
  updateProfile: (data: Partial<User>) => void;
  subscribeToProducer: (sub: ProducerSubscription) => boolean;
  // ---- Integración backend (Sprint 1, modo hybrid) ----
  apiMode: ApiMode;            // modo efectivo tras el bootstrap (hybrid o mock si cayó)
  backendStatus: 'idle' | 'checking' | 'online' | 'offline';
  isSyncing: boolean;          // hay una petición al backend en curso
  refreshFromBackend: () => Promise<void>;
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
    if (!saved) return INITIAL_TRACKS;
    try {
      const parsed = JSON.parse(saved);
      // Ensure all tracks have resourceType and mood if from old cache
      return parsed.map((t: any) => ({
        ...t,
        resourceType: t.resourceType || 'instrumental',
        mood: t.mood || 'Oscuro',
        hasStems: t.hasStems !== undefined ? t.hasStems : true,
        hasWav: t.hasWav !== undefined ? t.hasWav : true,
        hasMidi: t.hasMidi !== undefined ? t.hasMidi : false,
      }));
    } catch {
      return INITIAL_TRACKS;
    }
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

  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => {
    const saved = localStorage.getItem('bc_purchases');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem('bc_current_user_id');
    return saved || 'user_art_1'; // Default as artist MC Flow
  });

  // Global search & Resource filter
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [activeResourceFilter, setActiveResourceFilter] = useState<ResourceType | 'all'>('all');

  // Audio Player State
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180);
  const [volume, setVolume] = useState<number>(0.8);

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  // ==== Estado de integración con el backend Django (modo hybrid) ====
  const [apiMode, setApiMode] = useState<ApiMode>(CONFIGURED_MODE);
  const [backendStatus, setBackendStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const modeRef = React.useRef<ApiMode>(CONFIGURED_MODE);
  modeRef.current = apiMode;
  // Carrito real: mapa trackId UI -> ventaId de Django (DELETE /api/carrito/<venta_id>/)
  const cartVentaIds = React.useRef<Record<string, number>>({});

  /** Marca "syncing" alrededor de una llamada al backend. */
  const withSync = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setIsSyncing(true);
    try {
      return await fn();
    } finally {
      setIsSyncing(false);
    }
  };

  /** Hidrata catálogo + sesión + carrito desde Django. Si falla en el bootstrap, cae a mock. */
  const loadFromBackend = async (bootstrap: boolean) => {
    try {
      const [page, session] = await Promise.all([DjangoApi.catalogo({ page: 1 }), DjangoApi.getSession()]);
      const comprados = new Set(page.tracks_comprados.map((n) => `dj-${n}`));
      const mapped = page.tracks.map((dt) =>
        mapTrack(dt, { isPurchased: comprados.has(`dj-${dt.id_track}`), isOwner: !!session && dt.usuario.username === session.username }),
      ) as TrackWithSrc[];

      setTracks(mapped);

      if (session) {
        const uiUser = mapUser(session);
        uiUser.purchasedTrackIds = Array.from(comprados);
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === uiUser.id);
          return exists ? prev.map((u) => (u.id === uiUser.id ? { ...uiUser, likedTrackIds: u.likedTrackIds } : u)) : [...prev, uiUser];
        });
        setCurrentUserId(uiUser.id);
        localStorage.setItem('bc_session_user_id', uiUser.id);
      } else {
        localStorage.removeItem('bc_session_user_id');
      }

      // Carrito persistente del servidor (Venta.completada=False, IVA server-side)
      const cartRes = await DjangoApi.carrito();
      const byId = new Map(mapped.map((t) => [t.id, t]));
      const items = cartRes.items
        .map((v) => {
          const t = byId.get(`dj-${v.track}`);
          cartVentaIds.current[t!.id] = v.id;
          return t ? { track: t, addedAt: v.fecha } : null;
        })
        .filter((x): x is CartItem => x !== null);
      setCart(items);

      setBackendStatus('online');
      setApiMode('hybrid');
      audioEngine.setPlaybackMode('file');
    } catch (e) {
      if (bootstrap) {
        // El backend no está disponible: seguimos la demo en modo mock sin romper nada.
        // eslint-disable-next-line no-console
        console.warn('[BeatsCloud] Backend no disponible, fallback a modo mock:', e);
        setApiMode('mock');
        setBackendStatus('offline');
        audioEngine.setPlaybackMode('synth');
      } else {
        setBackendStatus('offline');
        throw e;
      }
    }
  };

  // Bootstrap: intentamos conectar una vez al montar (solo si el modo configurado es hybrid)
  useEffect(() => {
    if (CONFIGURED_MODE === 'hybrid') {
      setBackendStatus('checking');
      loadFromBackend(true);
    } else {
      audioEngine.setPlaybackMode('synth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al pagar en Webpay, Django redirige de vuelta con ?pago=exito|fracaso|cancelado:
  // re-hidratamos para que HistorialCompra/Venta ya reflejen la compra autorizada.
  useEffect(() => {
    if (modeRef.current !== 'hybrid') return;
    const params = new URLSearchParams(window.location.search);
    const pago = params.get('pago');
    if (pago) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
      loadFromBackend(false).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFromBackend = () => withSync(() => loadFromBackend(false));

  // Regla de seguridad central: una pista está protegida (preview amortiguada,
  // sin descarga de master) si tiene marca de agua y el usuario no la adquirió.
  const isTrackProtected = (track: Track | null): boolean => {
    if (!track) return false;
    const owned = currentUser?.purchasedTrackIds.includes(track.id) ?? false;
    if (owned) return false;
    if (track.isFree || track.price === 0) return false; // Beats gratis: demo libre sin protección
    return track.hasWatermark ?? true;
  };

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
    localStorage.setItem('bc_purchases', JSON.stringify(purchases));
  }, [purchases]);

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
    // Seguridad de preescucha: amortiguar la preview si la pista no fue adquirida.
    audioEngine.setPreviewSecurityMode(isTrackProtected(track));

    // En modo real, el <audio> apunta al archivo auténtico de Django:
    // reproducir completo solo si es gratis/dueño/comprado (la guarda vive
    // server-side en /api/track/<id>/reproducir/); si no, suena el preview 30s.
    if (modeRef.current === 'hybrid') {
      const t = track as TrackWithSrc;
      const src = !isTrackProtected(track) && t.fullSrc ? t.fullSrc : t.previewSrc ?? t.fullSrc ?? null;
      audioEngine.setAudioSource(src);
    }

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
    audioEngine.setPreviewSecurityMode(isTrackProtected(activeTrack));
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

    const updatedUserLiked = isLiked
      ? currentUser.likedTrackIds.filter((id) => id !== trackId)
      : [...currentUser.likedTrackIds, trackId];

    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, likedTrackIds: updatedUserLiked } : u))
    );

    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? { ...t, likesCount: isLiked ? Math.max(0, t.likesCount - 1) : t.likesCount + 1 }
          : t
      )
    );

    // Modo real: espejar en /api/like/<id>/ (optimista arriba, revert si falla)
    if (modeRef.current === 'hybrid' && trackId.startsWith('dj-')) {
      withSync(() => DjangoApi.toggleLike(djangoId(trackId)))
        .then((res) => {
          if (res.liked !== !isLiked) {
            // El servidor dice lo contrario: revertir UI
            toggleLikeServerRollback(trackId, isLiked);
          }
        })
        .catch(() => toggleLikeServerRollback(trackId, isLiked));
    }
  };

  const toggleLikeServerRollback = (trackId: string, wasLiked: boolean) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser?.id
          ? {
              ...u,
              likedTrackIds: wasLiked
                ? [...new Set([...u.likedTrackIds, trackId])]
                : u.likedTrackIds.filter((id) => id !== trackId),
            }
          : u
      )
    );
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, likesCount: wasLiked ? t.likesCount + 1 : Math.max(0, t.likesCount - 1) } : t))
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

    if (modeRef.current === 'hybrid' && track.id.startsWith('dj-')) {
      // Fuente de verdad: Venta server-side con IVA calculado por Django.
      withSync(() => DjangoApi.addToCart(djangoId(track.id)))
        .then((venta) => {
          cartVentaIds.current[track.id] = venta.id;
          setCart((prev) =>
            prev.some((i) => i.track.id === track.id) ? prev : [...prev, { track, addedAt: venta.fecha }]
          );
        })
        .catch((e) => {
          // 409 duplicado/recompra, 401 sin sesión: no agregamos nada.
          console.warn('[BeatsCloud] No se pudo agregar al carrito:', e);
        });
      return true;
    }

    setCart((prev) => [...prev, { track, addedAt: new Date().toISOString() }]);
    return true;
  };

  const removeFromCart = (trackId: string) => {
    const ventaId = cartVentaIds.current[trackId];
    setCart((prev) => prev.filter((item) => item.track.id !== trackId));
    delete cartVentaIds.current[trackId];
    if (modeRef.current === 'hybrid' && ventaId != null) {
      withSync(() => DjangoApi.removeFromCart(ventaId)).catch((e) =>
        console.warn('[BeatsCloud] No se pudo quitar del carrito (server):', e),
      );
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const checkoutCart = (buyOrderOpcional?: string) => {
    if (!currentUser || cart.length === 0) {
      return { success: false, buyOrder: '', amount: 0 };
    }

    // ==== Modo real (Sprint 1): iniciar Webpay PLUS contra Django ====
    // El SPA SOLO inicia la transacción; el commit y toda la validación
    // (response_code==0, AUTHORIZED, buy_order, monto, session_id) viven en la
    // vista exito_carrito() de Felipe. Aquí redirigimos el navegador a url_webpay.
    if (modeRef.current === 'hybrid') {
      withSync(() => DjangoApi.initPago())
        .then((pago) => {
          window.location.href = pago.url_webpay;
        })
        .catch((e) => {
          console.warn('[BeatsCloud] No se pudo iniciar el pago Webpay:', e);
          alert(`No fue posible iniciar el pago: ${(e as Error).message}`);
        });
      // Transacción pendiente en servidor; al volver del retorno se re-hidrata todo.
      return { success: true, buyOrder: 'WEBPAY-PENDING', amount: 0 };
    }

    const subtotal = cart.reduce((acc, item) => acc + item.track.price, 0);
    const iva = Math.round(subtotal * 0.19);
    const totalAmount = subtotal + iva;
    // Espejo del flujo real: el buy_order nace con la transacción Webpay (create)
    // y se reutiliza idéntico en compras, ventas y recibo (commit).
    const buyOrder = buyOrderOpcional || 'BC-' + Math.floor(100000 + Math.random() * 900000);
    const today = new Date().toISOString().split('T')[0];

    const purchasedIds = cart.map((item) => item.track.id);

    // Alineado con HistorialVenta de Django: precio neto del track (sin IVA),
    // igual que views.py -> HistorialVenta.objects.create(precio=venta.track.precio)
    const newSales: SaleRecord[] = cart.map((item) => {
      const code = 'LIC-' + buyOrder;
      const hash = 'SHA256:' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      return {
        id: 'sale_' + Math.random().toString(36).substr(2, 9),
        buyerId: currentUser.id,
        buyerName: currentUser.artistName || currentUser.username,
        trackId: item.track.id,
        trackTitle: item.track.title,
        amount: item.track.price,
        date: today,
        status: 'AUTHORIZED',
        buyOrder,
        licenseCode: code,
        verificationHash: hash,
        licenseType: 'comercial_wav_stems',
      };
    });

    // Alineado con HistorialCompra de Django: precio neto del track (sin IVA).
    // El monto TOTAL cobrado a Webpay (subtotal + IVA) se reporta aparte en
    // WebpayTransaction.amount y queda disponible como webpayAmount en el recibo.
    const newPurchases: PurchaseRecord[] = cart.map((item) => {
      const code = 'LIC-' + buyOrder;
      const hash = 'SHA256:' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      return {
        id: 'pur_' + Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        trackId: item.track.id,
        trackTitle: item.track.title,
        producerName: item.track.producerName,
        amount: item.track.price,
        buyOrder,
        date: today,
        licenseCode: code,
        verificationHash: hash,
        licenseType: 'comercial_wav_stems',
        webpayAmount: totalAmount, // lo que efectivamente autorizó Transbank
      };
    });

    setSales((prev) => [...newSales, ...prev]);
    setPurchases((prev) => [...newPurchases, ...prev]);

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
    resourceType: ResourceType;
    genre: MusicGenre;
    subgenre?: string;
    price: number;
    description: string;
    coverUrl?: string;
    bpm: number;
    scaleKey: string;
    mood: MoodType;
    audioBeatType: Track['audioBeatType'];
    hasStems: boolean;
    hasWav: boolean;
    hasMidi: boolean;
    isFree?: boolean;
    allowFreeDownload?: boolean;
    hasWatermark?: boolean;
    duration?: number; // Segundos. Si no se informa, se usa la maqueta por defecto (180s)
  }): Track => {
    const id = 'track_' + Date.now();
    const isFree = data.isFree ?? (data.price === 0);
    const newTrack: Track = {
      id,
      title: data.title,
      producerId: currentUser?.id || 'user_prod_1',
      producerName: currentUser?.artistName || currentUser?.username || 'Productor',
      producerUsername: currentUser?.username || 'productor',
      producerAvatar: currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      resourceType: data.resourceType,
      genre: data.genre,
      subgenre: data.subgenre || '',
      price: isFree ? 0 : data.price,
      coverUrl: data.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
      description: data.description,
      bpm: data.bpm || 130,
      scaleKey: data.scaleKey || 'C Minor',
      mood: data.mood || 'Oscuro',
      duration: data.duration && data.duration > 0 ? data.duration : 180,
      likesCount: 0,
      tags: [data.genre, data.resourceType, `${data.bpm} BPM`, data.mood, ...(isFree ? ['Free', 'Gratis'] : [])],
      audioBeatType: data.audioBeatType || 'trap',
      hasStems: data.hasStems,
      hasWav: data.hasWav,
      hasMidi: data.hasMidi,
      isFree,
      allowFreeDownload: data.allowFreeDownload ?? isFree,
      hasWatermark: data.hasWatermark ?? !isFree,
      comments: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTracks((prev) => [newTrack, ...prev]);
    return newTrack;
  };

  const claimFreeTrack = (trackId: string): boolean => {
    if (!currentUser) return false;
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return false;
    if (currentUser.purchasedTrackIds.includes(trackId)) return true;

    const buyOrder = 'FREE-' + Math.floor(100000 + Math.random() * 900000);
    const today = new Date().toISOString().split('T')[0];

    const freeCode = 'LIC-FREE-' + Math.floor(100000 + Math.random() * 900000);
    const freeHash = 'SHA256:' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    const freePurchase: PurchaseRecord = {
      id: 'pur_free_' + Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      trackId: track.id,
      trackTitle: track.title,
      producerName: track.producerName,
      amount: 0,
      buyOrder,
      date: today,
      licenseCode: freeCode,
      verificationHash: freeHash,
      licenseType: 'maqueta_ensayo',
    };

    setPurchases((prev) => [freePurchase, ...prev]);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? { ...u, purchasedTrackIds: Array.from(new Set([...u.purchasedTrackIds, trackId])) }
          : u
      )
    );
    return true;
  };

  const updateTrack = (trackId: string, data: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...data } : t)));
    if (activeTrack?.id === trackId) {
      setActiveTrack((prev) => (prev ? { ...prev, ...data } : null));
    }
    // Modo real: PATCH /api/track/<id>/ — Django solo acepta nombre/precio/descripción.
    if (modeRef.current === 'hybrid' && trackId.startsWith('dj-')) {
      const body: Record<string, unknown> = {};
      if (data.title !== undefined) body.nombre_track = data.title;
      if (data.price !== undefined) body.precio = data.price;
      if (data.description !== undefined) body.descripcion = data.description;
      if (Object.keys(body).length > 0) {
        withSync(() => DjangoApi.updateTrack(djangoId(trackId), body as never)).catch((e) =>
          console.warn('[BeatsCloud] No se pudo actualizar el track en el servidor:', e),
        );
      }
    }
  };

  const deleteTrack = (trackId: string) => {
    // Modo real: POST /api/track/<id>/delete/ — el servidor responde 409 si ya tiene ventas.
    if (modeRef.current === 'hybrid' && trackId.startsWith('dj-')) {
      withSync(() => DjangoApi.deleteTrack(djangoId(trackId)))
        .then(() => {
          setTracks((prev) => prev.filter((t) => t.id !== trackId));
          if (activeTrack?.id === trackId) {
            audioEngine.pause();
            setActiveTrack(null);
          }
          setCart((prev) => prev.filter((item) => item.track.id !== trackId));
        })
        .catch((e) => alert((e as Error).message || 'No se pudo eliminar el track.'));
      return;
    }

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

    // Modo real: persistir en Comentario de Django y re-sincronizar los comentarios
    // del track para reflejar los que ya existían en el servidor.
    if (modeRef.current === 'hybrid' && trackId.startsWith('dj-')) {
      withSync(async () => {
        await DjangoApi.addComment(djangoId(trackId), content.trim());
        const list = await DjangoApi.comentarios(djangoId(trackId));
        const mapped = list.map((c) => ({
          id: `cm-${c.id}`,
          userId: String(c.usuario.id),
          username: c.usuario.username,
          userAvatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${c.usuario.username}`,
          content: c.contenido,
          createdAt: c.fecha_creacion,
        }));
        setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, comments: mapped } : t)));
        setActiveTrack((prev) => (prev && prev.id === trackId ? { ...prev, comments: mapped } : prev));
      }).catch((e) => console.warn('[BeatsCloud] No se pudo guardar el comentario:', e));
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
    // En modo real la sesión la manda Django: no se puede "saltar" de usuario.
    if (modeRef.current === 'hybrid') return;
    setCurrentUserId(userId);
  };

  /**
   * Login: en modo hybrid usa la sesión de Django (POST /api/auth/login/ con CSRF).
   * Devuelve el mensaje de error del servidor ('' si ok, null = credenciales locales inválidas).
   */
  const login = (username: string, password?: string): boolean => {
    if (modeRef.current === 'hybrid') {
      if (!password) return false; // la UI debe pedir clave cuando hay backend
      withSync(() => DjangoApi.login(username, password))
        .then(async (dUser) => {
          const uiUser = mapUser(dUser);
          setUsers((prev) => (prev.some((u) => u.id === uiUser.id) ? prev.map((u) => (u.id === uiUser.id ? uiUser : u)) : [...prev, uiUser]));
          setCurrentUserId(uiUser.id);
          await loadFromBackend(false); // re-hidratar catálogo/carrito con la sesión nueva
        })
        .catch((e) => alert((e as Error).message || 'No fue posible iniciar sesión.'));
      return true;
    }
    const user = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
    );
    if (user) {
      setCurrentUserId(user.id);
      return true;
    }
    return false;
  };

  const logout = () => {
    if (modeRef.current === 'hybrid') {
      withSync(() => DjangoApi.logout())
        .then(() => loadFromBackend(false))
        .catch(() => {});
      return;
    }
    localStorage.removeItem('bc_current_user_id');
    setCurrentUserId('');
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

  const downloadAuditionDemo = (track: Track) => {
    const textContent = `================================================================================
       BEATSCLOUD CHILE · LICENCIA DE COMPOSICIÓN Y ENSAYO (DEMO GRATIS)
================================================================================

Pista: "${track.title}"
Productor: ${track.producerName} (@${track.producerUsername})
Tempo: ${track.bpm} BPM | Escala: ${track.scaleKey}
Descargado por: ${currentUser?.artistName || currentUser?.username || 'Artista'}
Fecha de Descarga: ${new Date().toISOString().split('T')[0]}

CONDICIONES DEL PUNTO MEDIO (ENSAYO & COMPOSICIÓN VOCAL):
1. Esta maqueta MP3 está destinada exclusivamente para que puedas grabar tu voz,
   escribir tu letra y comprobar en tu DAW/estudio si tu flow y melodía encajan.
2. No está permitido subir esta grabación con propósitos comerciales a Spotify,
   Apple Music ni monetizar en YouTube sin la Licencia Comercial.
3. Una vez que tu tema esté compuesto y listo para ser masterizado, adquiere la
   Licencia Comercial en BeatsCloud para recibir:
   - El máster original en WAV 24-bit sin pérdida ni marcas.
   - Los Stems multitrack por pistas separadas (batería, bajo, sintetizadores).
   - El Certificado de Licencia Oficial con Código Único para inscripción en SCD
     y autorización ante distribuidoras (DistroKid, Altafonte).

BeatsCloud Chile SpA · Regularizando la música en Chile y Latinoamérica.
================================================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Maqueta_Ensayo_${track.title.replace(/[\s/]/g, '_')}_BeatsCloud.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getContractForPurchase = (purchase: PurchaseRecord): LicenseContract => {
    const track = tracks.find((t) => t.id === purchase.trackId);
    const buyerUser = users.find((u) => u.id === purchase.userId) || currentUser;
    const producerUser = users.find((u) => u.id === track?.producerId);

    const isFree = purchase.amount === 0;

    return {
      licenseCode: purchase.licenseCode || `LIC-${purchase.buyOrder}`,
      verificationHash:
        purchase.verificationHash ||
        'SHA256:7e9b2a1c0d4e8f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      issueDate: purchase.date || '2026-03-12',
      trackId: purchase.trackId,
      trackTitle: purchase.trackTitle,
      trackGenre: track?.genre || 'Trap',
      trackBpm: track?.bpm || 135,
      trackKey: track?.scaleKey || 'A Menor',
      producerId: producerUser?.id || track?.producerId || 'user_prod_1',
      producerName: purchase.producerName || track?.producerName || 'Metro Santiago',
      producerUsername: producerUser?.username || track?.producerUsername || 'metrosantiago',
      producerRut: '18.421.902-3 (Verificado)',
      buyerId: buyerUser?.id || purchase.userId,
      buyerName: buyerUser?.artistName || buyerUser?.username || 'MC Flow Valparaíso',
      buyerUsername: buyerUser?.username || 'mcflow',
      buyerRut: '19.824.110-K (Verificado)',
      amountClp: purchase.amount,
      buyOrder: purchase.buyOrder,
      licenseType: isFree ? 'maqueta_ensayo' : 'comercial_wav_stems',
      musicRightsSplit: {
        producerPercent: 50,
        artistPercent: 50,
        scdRegistered: true,
      },
      distributionTerms: {
        streamsLimit: isFree ? 'Solo Maqueta No Comercial' : 'Ilimitado (Streaming comercial)',
        musicVideoMonetized: !isFree,
        radioBroadcasting: !isFree,
        livePerformancesForProfit: !isFree,
        contentIdProtected: true,
      },
    };
  };

  const getContractForSale = (sale: SaleRecord): LicenseContract => {
    const track = tracks.find((t) => t.id === sale.trackId);
    const buyerUser = users.find((u) => u.id === sale.buyerId);
    const producerUser = users.find((u) => u.id === track?.producerId) || currentUser;

    return {
      licenseCode: sale.licenseCode || `LIC-${sale.buyOrder}`,
      verificationHash:
        sale.verificationHash ||
        'SHA256:7e9b2a1c0d4e8f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      issueDate: sale.date || '2026-03-12',
      trackId: sale.trackId,
      trackTitle: sale.trackTitle,
      trackGenre: track?.genre || 'Trap',
      trackBpm: track?.bpm || 135,
      trackKey: track?.scaleKey || 'A Menor',
      producerId: producerUser?.id || 'user_prod_1',
      producerName: producerUser?.artistName || producerUser?.username || 'Metro Santiago',
      producerUsername: producerUser?.username || 'metrosantiago',
      producerRut: '18.421.902-3 (Verificado)',
      buyerId: sale.buyerId,
      buyerName: sale.buyerName,
      buyerUsername: buyerUser?.username || 'mcflow',
      buyerRut: '19.824.110-K (Verificado)',
      amountClp: sale.amount,
      buyOrder: sale.buyOrder,
      licenseType: 'comercial_wav_stems',
      musicRightsSplit: {
        producerPercent: 50,
        artistPercent: 50,
        scdRegistered: true,
      },
      distributionTerms: {
        streamsLimit: 'Ilimitado (Streaming comercial)',
        musicVideoMonetized: true,
        radioBroadcasting: true,
        livePerformancesForProfit: true,
        contentIdProtected: true,
      },
    };
  };

  const generateLicenseForTrack = (track: Track): LicenseContract => {
    const buyer = currentUser || users[1];
    const buyOrder = 'BC-' + Math.floor(100000 + Math.random() * 900000);
    return {
      licenseCode: 'LIC-' + buyOrder,
      verificationHash: 'SHA256:' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
      issueDate: new Date().toISOString().split('T')[0],
      trackId: track.id,
      trackTitle: track.title,
      trackGenre: track.genre,
      trackBpm: track.bpm,
      trackKey: track.scaleKey,
      producerId: track.producerId,
      producerName: track.producerName,
      producerUsername: track.producerUsername,
      producerRut: '18.421.902-3 (Verificado)',
      buyerId: buyer.id,
      buyerName: buyer.artistName || buyer.username,
      buyerUsername: buyer.username,
      buyerRut: '19.824.110-K (Verificado)',
      amountClp: track.price,
      buyOrder,
      licenseType: track.price === 0 ? 'maqueta_ensayo' : 'comercial_wav_stems',
      musicRightsSplit: {
        producerPercent: 50,
        artistPercent: 50,
        scdRegistered: true,
      },
      distributionTerms: {
        streamsLimit: track.price === 0 ? 'Solo Maqueta No Comercial' : 'Ilimitado (Streaming comercial)',
        musicVideoMonetized: track.price > 0,
        radioBroadcasting: track.price > 0,
        livePerformancesForProfit: track.price > 0,
        contentIdProtected: true,
      },
    };
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
        purchases,
        activeTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        globalSearchQuery,
        setGlobalSearchQuery,
        activeResourceFilter,
        setActiveResourceFilter,
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
        claimFreeTrack,
        downloadAuditionDemo,
        getContractForPurchase,
        getContractForSale,
        generateLicenseForTrack,
        addComment,
        deleteComment,
        switchUser,
        login,
        logout,
        registerUser,
        updateProfile,
        subscribeToProducer,
        apiMode,
        backendStatus,
        isSyncing,
        refreshFromBackend,
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
