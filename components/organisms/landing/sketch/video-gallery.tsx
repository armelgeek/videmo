'use client';

import Link from 'next/link';

interface VideoGalleryItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  views: string;
  author: string;
  category: 'education' | 'marketing' | 'tech' | 'explainer' | 'storytelling';
}

const GALLERY_VIDEOS: VideoGalleryItem[] = [
  {
    id: '1',
    title: 'How to Build an MVP',
    description: 'Step-by-step guide to shipping your first product in weeks, not months.',
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    duration: '4:32',
    views: '12.5K',
    author: 'Startup Lab',
    category: 'education',
  },
  {
    id: '2',
    title: 'The Power of AI in Marketing',
    description: 'How AI is transforming the marketing landscape and what it means for brands.',
    thumbnail: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    duration: '3:45',
    views: '28.3K',
    author: 'Marketing Weekly',
    category: 'marketing',
  },
  {
    id: '3',
    title: 'Understanding Blockchain',
    description: 'A simple explanation of blockchain technology and its real-world applications.',
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    duration: '5:12',
    views: '45.7K',
    author: 'Tech Explained',
    category: 'tech',
  },
  {
    id: '4',
    title: 'Customer Success 101',
    description: 'The secrets to keeping customers happy and building lifetime loyalty.',
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    duration: '3:28',
    views: '18.9K',
    author: 'Business Wisdom',
    category: 'explainer',
  },
  {
    id: '5',
    title: 'Digital Transformation Journey',
    description: 'Real stories from companies that transformed their business with digital tools.',
    thumbnail: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    duration: '6:15',
    views: '34.2K',
    author: 'Enterprise Today',
    category: 'storytelling',
  },
  {
    id: '6',
    title: 'The Future of Remote Work',
    description: 'Trends and predictions about how teams will collaborate in the next 5 years.',
    thumbnail: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    duration: '4:41',
    views: '56.1K',
    author: 'HR Insights',
    category: 'education',
  },
];

interface GalleryCardProps {
  video: VideoGalleryItem;
}

function GalleryCard({ video }: GalleryCardProps) {
  const categoryLabels: Record<string, string> = {
    education: '📚 Education',
    marketing: '📢 Marketing',
    tech: '⚙️ Technology',
    explainer: '💡 Explainer',
    storytelling: '📖 Story',
  };

  return (
    <div className="gallery-card">
      <div
        className="gallery-card-thumbnail"
        style={{ background: video.thumbnail }}
        role="img"
        aria-label={`${video.title} thumbnail`}
      >
        <div className="gallery-play-btn" aria-hidden="true">
          ▶
        </div>
      </div>
      <div className="gallery-card-content">
        <span className="gallery-category">{categoryLabels[video.category]}</span>
        <h4 className="gallery-card-title">{video.title}</h4>
        <p className="gallery-card-desc">{video.description}</p>
        <div className="gallery-card-meta">
          <span className="gallery-meta-item">
            <span className="sk-mono">{video.duration}</span>
          </span>
          <span className="gallery-meta-item">
            <span className="sk-mono">{video.views} views</span>
          </span>
        </div>
        <div className="gallery-card-footer">
          <span className="gallery-author">{video.author}</span>
        </div>
      </div>
    </div>
  );
}

export function VideoGallerySection() {
  return (
    <div className="sk-section sk-wrap">
      <div className="sec-head">
        <p className="sk-eyebrow">Created by teams like yours</p>
        <h2>See what&apos;s possible. <span className="sk-hl">These are real videos.</span></h2>
        <p className="sec-lede">Every video below was created by our users in minutes, not weeks. Same tool. Same results.</p>
      </div>

      <div className="gallery-grid">
        {GALLERY_VIDEOS.map((video) => (
          <GalleryCard key={video.id} video={video} />
        ))}
      </div>

      <div className="gallery-cta">
        <Link href="/signup" className="sk-btn sk-btn-main">
          Create your first video →
        </Link>
      </div>
    </div>
  );
}
