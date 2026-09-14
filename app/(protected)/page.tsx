'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Plus } from 'lucide-react';

const menuItems = [
  {
    title: 'New Project',
    description: 'Start a new video project',
    icon: Plus,
    href: '/storyboard',
    highlighted: true,
  },
  {
    title: 'Workspace',
    description: 'Access your workspace',
    icon: LayoutGrid,
    href: '/storyboard',
  },
];

export default function Dashboard() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl space-y-12">
          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">Welcome to Studio</h1>
            <p className="text-muted-foreground text-lg">Choose an action to get started</p>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`group relative p-6 rounded-xl transition-all ${
                    item.highlighted
                      ? 'bg-gradient-to-br from-highlight/25 to-highlight/10 border border-ink hover:border-ink'
                      : 'bg-card border border-border hover:bg-accent hover:border-ink'
                  }`}
                >
                  {/* Glow effect for highlighted */}
                  {item.highlighted && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-highlight/25 to-highlight/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}

                  <div className="relative space-y-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                        item.highlighted
                          ? 'bg-highlight text-highlight-foreground border-2 border-ink'
                          : 'bg-accent group-hover:bg-white/20'
                      }`}
                    >
                      <Icon className="w-6 h-6 text-foreground" />
                    </div>

                    <div className="space-y-2 text-left">
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>

                    {item.highlighted && (
                      <div className="inline-flex items-center text-xs font-medium text-foreground pt-2">
                        Get Started →
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
