'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FolderPlus, ArrowLeft, Download, BookOpen } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim()) return;

    setIsLoading(true);
    // Simulate project creation
    setTimeout(() => {
      router.push('/storyboard');
    }, 500);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/10">
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <BookOpen className="w-4 h-4" />
              Learn
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Create New Project</h1>
            <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-sm font-medium text-rose-300">
              Step 1 of 3
            </span>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <label className="text-sm text-gray-400">Project:</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500/50 focus:bg-white/10 transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8">
        <div className="max-w-2xl">
          <div className="space-y-8">
            {/* Project Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 flex items-center justify-center">
                <FolderPlus className="w-10 h-10 text-rose-400" />
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-white">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for your project..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500/50 focus:bg-white/10 transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-6">
                <button
                  onClick={() => router.back()}
                  className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!projectName.trim() || isLoading}
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-violet-500 text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                >
                  {isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
