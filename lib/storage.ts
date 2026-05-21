export interface Post {
  id: string;
  location: string;
  description: string;
  duration: number; // in minutes
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'mawqifi_posts';

export const storage = {
  getPosts: (): Post[] => {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePosts: (posts: Post[]): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (error) {
      console.error('Failed to save posts:', error);
    }
  },

  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'expiresAt'>): Post => {
    const posts = storage.getPosts();
    const newPost: Post = {
      ...post,
      id: Date.now().toString(),
      createdAt: Date.now(),
      expiresAt: Date.now() + post.duration * 60 * 1000,
    };
    posts.unshift(newPost);
    storage.savePosts(posts);
    return newPost;
  },

  deletePost: (id: string): void => {
    const posts = storage.getPosts();
    const filtered = posts.filter(post => post.id !== id);
    storage.savePosts(filtered);
  },

  cleanupExpiredPosts: (): void => {
    const posts = storage.getPosts();
    const now = Date.now();
    const active = posts.filter(post => post.expiresAt > now);
    if (active.length !== posts.length) {
      storage.savePosts(active);
    }
  },
};
