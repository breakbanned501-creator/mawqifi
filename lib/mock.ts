import type { ChatMessage, Conversation, ParkingPost, Profile } from './types';

export const currentMockProfile: Profile = {
  id: 'local-user',
  username: 'طالب جامعة الكويت',
  avatar_url: null,
  active_post_count: 1,
};

export const mockPosts: ParkingPost[] = [
  {
    id: 'demo-education-gate-5',
    user_id: 'demo-owner-1',
    college: 'كلية التربية',
    zone: 'A',
    gate: 'Gate 5',
    car_desc: 'جيب أسود',
    departure_minutes: 10,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: 'active',
    username: 'نورة',
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-engineering-gate-7',
    user_id: 'demo-owner-2',
    college: 'كلية الهندسة والبترول',
    zone: 'B',
    gate: 'Gate 7',
    car_desc: 'سيدان أبيض',
    departure_minutes: 15,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: 'active',
    username: 'عبدالله',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

export const mockConversations: Conversation[] = [
  {
    id: 'demo-chat-1',
    post_id: 'demo-education-gate-5',
    owner_id: 'demo-owner-1',
    requester_id: 'local-user',
    closed: false,
    unread_count: 2,
    last_message: 'أنا عند البوابة ٥',
    updated_at: new Date().toISOString(),
    post: mockPosts[0],
  },
];

export const mockMessages: ChatMessage[] = [
  {
    id: 'm1',
    conversation_id: 'demo-education-gate-5',
    sender_id: 'demo-owner-1',
    type: 'text',
    text: 'أنا عند البوابة ٥',
    image_url: null,
    latitude: null,
    longitude: null,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2',
    conversation_id: 'demo-education-gate-5',
    sender_id: 'local-user',
    type: 'text',
    text: 'تمام، وصلت قريب',
    image_url: null,
    latitude: null,
    longitude: null,
    created_at: new Date(Date.now() - 60 * 1000).toISOString(),
  },
];
