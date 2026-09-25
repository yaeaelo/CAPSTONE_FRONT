export type UserType = 'artista' | 'productor';

export interface User {
  id: string;
  username: string;
  artistName: string;
  email: string;
  role: UserType;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  spotify?: string;
  youtube?: string;
  instagram?: string;
  subscriptions?: string[]; // IDs of subscribed producers or plans
  purchasedTrackIds: string[];
  likedTrackIds: string[];
}

export type MusicGenre =
  | 'Hip-Hop'
  | 'Reggaeton'
  | 'Electronica'
  | 'R&B'
  | 'Pop'
  | 'Rock'
  | 'Jazz'
  | 'Metal'
  | 'Soul';

export interface TrackComment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface Track {
  id: string;
  title: string;
  producerId: string;
  producerName: string;
  producerUsername: string;
  producerAvatar: string;
  genre: MusicGenre;
  price: number; // In CLP (e.g. 15000)
  coverUrl: string;
  description: string;
  bpm: number;
  scaleKey: string;
  duration: number; // in seconds
  likesCount: number;
  tags: string[];
  audioBeatType: 'trap' | 'boom_bap' | 'reggaeton' | 'synthwave' | 'rnb' | 'lofi';
  comments: TrackComment[];
  createdAt: string;
}

export interface ProducerSubscription {
  id: string;
  producerId: string;
  title: string;
  price: number;
  period: 'mensual' | 'anual';
  benefits: string[];
}

export interface CartItem {
  track: Track;
  addedAt: string;
}

export interface SaleRecord {
  id: string;
  buyerId: string;
  buyerName: string;
  trackId: string;
  trackTitle: string;
  amount: number;
  date: string;
  status: 'AUTHORIZED' | 'PENDING' | 'CANCELLED';
}
