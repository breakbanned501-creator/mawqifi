'use client';

import { type FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { storage, Post } from '@/lib/storage';

interface CreatePostFormProps {
  onPostCreated: (post: Post) => void;
}

export default function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!location.trim() || !description.trim()) return;

    const newPost = storage.addPost({
      location: location.trim(),
      description: description.trim(),
      duration: parseInt(duration),
    });

    onPostCreated(newPost);
    
    // Reset form
    setLocation('');
    setDescription('');
    setDuration('30');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        <Plus size={20} />
        <span>إضافة موقف جديد</span>
      </button>
    );
  }

  return (
    <div className="card border-cyan-400/20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-extrabold text-lg text-white">إضافة موقف جديد</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-white/75 mb-2">
            الموقع
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="مثال: شارع الملك فهد، الرياض"
            className="input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white/75 mb-2">
            الوصف
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: موقف سيارات مجاني لمدة ساعة"
            className="input min-h-[80px] resize-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-white/75 mb-2">
            المدة المتاحة (بالدقائق)
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="input"
          >
            <option value="15">15 دقيقة</option>
            <option value="30">30 دقيقة</option>
            <option value="60">ساعة واحدة</option>
            <option value="120">ساعتان</option>
            <option value="180">3 ساعات</option>
            <option value="360">6 ساعات</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
        >
          نشر الموقف
        </button>
      </form>
    </div>
  );
}
