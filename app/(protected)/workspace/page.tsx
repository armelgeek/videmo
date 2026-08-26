'use client';

import { useRouter } from 'next/navigation';
import { Folder, ArrowRight } from 'lucide-react';

const PROJECTS = [
  { id: 1, name: 'Summer Campaign', updated: '1m', status: 'Created', progress: 100 },
  { id: 2, name: 'Product Launch', updated: '2h', status: 'In Progress', progress: 65 },
  { id: 3, name: 'Brand Refresh', updated: '5h', status: 'In Review', progress: 40 },
];

export default function WorkspacePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Workspace</h1>
          <p className="text-gray-400">Manage and access your video projects</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8">
        <div className="max-w-6xl">
          {/* Projects Grid */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white mb-6">Recent Projects</h2>

            <div className="grid gap-4">
              {PROJECTS.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/storyboard?project=${project.id}`)}
                  className="group cursor-pointer p-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-violet-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                        <Folder className="w-5 h-5 text-rose-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-rose-400 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">{project.updated} · {project.status}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors flex-shrink-0" />
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{project.progress}% complete</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
