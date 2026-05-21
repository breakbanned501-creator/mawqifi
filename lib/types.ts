export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  active_post_count?: number;
};

export type ParkingPost = {
  id: string;
  user_id: string;
  college: string;
  zone: 'A' | 'B';
  gate: string;
  car_desc: string | null;
  departure_minutes: number;
  expires_at: string;
  status: 'active' | 'closed' | 'expired';
  username: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  post_id: string;
  owner_id: string;
  requester_id: string;
  closed: boolean;
  unread_count?: number;
  last_message?: string | null;
  updated_at: string;
  post?: ParkingPost;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: 'text' | 'image' | 'location';
  text: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};
