'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Play, Layers, PenTool, Film, CheckCircle2, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const HeroWhiteboardSection: React.FC = () => {
  return (
    <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden bg-[#0A0B0E] text-white">
      {/* Glow Backdrop Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-r from-violet-600/30 via-indigo-500/20 to-purple-600/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-rose-500/15 blur-[100px] rounded-full pointer-events-none" />

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Top Announcement Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-purple-300 shadow-xl hover:border-purple-500/40 transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span className="font-medium text-white/90">Nouveau Studio v2.0</span>
            <span className="text-white/40">•</span>
            <span className="text-purple-300">Whiteboard IA avec Annotation par Régions</span>
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Transformez vos Croquis en{' '}
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-rose-400 bg-clip-text text-transparent">
              Vidéos Whiteboard IA
            </span>{' '}
            avec Montage Complet
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed font-normal max-w-2xl mx-auto">
            Générez des visuels IA, contrôlez le tracé région par région avec l&apos;éditeur interactif Konva, et produisez des vidéos professionnelles sur notre timeline multi-pistes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-8 py-6 rounded-xl shadow-lg shadow-purple-600/25 transition-all text-base group" asChild>
              <Link href="/storyboard">
                Lancer le Studio Whiteboard
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/15 bg-white/5 hover:bg-white/10 text-gray-200 font-medium px-7 py-6 rounded-xl backdrop-blur-sm text-base" asChild>
              <Link href="#demo">
                <Play className="w-4 h-4 mr-2 fill-purple-400 text-purple-400" />
                Voir la Démo Interactive
              </Link>
            </Button>
          </div>

          {/* Highlights List */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Annotation Konva Drag & Resize</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Timeline Multi-pistes Audio/Vidéo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Export HD 1080p Sans Filigrane</span>
            </div>
          </div>
        </div>

        {/* Studio Product Mockup Showcase */}
        <div id="demo" className="mt-16 relative mx-auto max-w-5xl rounded-2xl border border-white/15 bg-[#121318]/90 backdrop-blur-xl shadow-2xl overflow-hidden p-2 sm:p-3">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#1A1B22] rounded-t-xl border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 text-xs font-mono text-gray-400">Whiteboard Studio IA — scene-premium-bag</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-purple-400 font-medium bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-md">
              <Sparkles className="w-3 h-3" />
              <span>Mode Annotation Actif</span>
            </div>
          </div>

          {/* Mockup Canvas & Sidebar Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 bg-[#0E0F14] min-h-[420px] rounded-b-xl">
            {/* Sidebar Mockup */}
            <div className="lg:col-span-3 bg-[#16171D] border border-white/10 rounded-lg p-3 space-y-3 hidden lg:block">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10 text-xs font-bold text-gray-300">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Régions d&apos;Annotation</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-md bg-blue-500/15 border border-blue-500/40 text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-blue-500 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                    <span>Premium Title</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">420x110</span>
                </div>
                <div className="p-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-red-500 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                    <span>Luxury Handbag</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">380x410</span>
                </div>
                <div className="p-2 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                    <span>Price Tag</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">180x210</span>
                </div>
                <div className="p-2 rounded-md bg-purple-500/15 border border-purple-500/40 text-purple-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-purple-500 text-white font-bold text-[10px] flex items-center justify-center">4</span>
                    <span>Question Symbol</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400">140x260</span>
                </div>
              </div>
            </div>

            {/* Canvas Display Mockup */}
            <div className="lg:col-span-9 bg-white rounded-lg relative overflow-hidden flex items-center justify-center min-h-[360px] border border-gray-300 shadow-inner">
              {/* Whiteboard Background Sketch Content */}
              <div className="relative w-full h-full flex items-center justify-center p-6">
                <div className="relative w-[540px] h-[320px] border border-dashed border-gray-300 rounded bg-white p-4 shadow-sm">
                  {/* Region Box 1 - Blue */}
                  <div className="absolute top-4 left-6 w-[240px] h-[55px] border-2 border-blue-600 bg-blue-500/15 rounded flex items-center px-3 font-semibold text-gray-800 text-lg">
                    <span className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow">1</span>
                    Premium Image
                  </div>

                  {/* Region Box 2 - Red */}
                  <div className="absolute top-16 right-16 w-[180px] h-[200px] border-2 border-red-500 bg-red-500/15 rounded flex flex-col items-center justify-center p-2 text-center text-xs text-gray-700">
                    <span className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded bg-red-500 text-white font-bold text-xs flex items-center justify-center shadow">2</span>
                    <div className="w-20 h-24 border-2 border-gray-700 rounded-md flex items-center justify-center font-bold">
                      👜
                    </div>
                  </div>

                  {/* Region Box 3 - Green */}
                  <div className="absolute bottom-6 left-12 w-[140px] h-[110px] border-2 border-emerald-500 bg-emerald-500/15 rounded flex flex-col items-center justify-center text-xs font-bold text-emerald-800">
                    <span className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded bg-emerald-500 text-white font-bold text-xs flex items-center justify-center shadow">3</span>
                    <span>$1500 → $700</span>
                  </div>

                  {/* Animated Drawing Hand */}
                  <div className="absolute top-14 left-44 z-30 pointer-events-none transition-all duration-300 animate-bounce">
                    <img src="/images/hand1-720p.png" alt="Drawing Hand" className="w-24 h-24 object-contain drop-shadow-xl" />
                  </div>
                </div>
              </div>

              {/* Bottom Playbar Overlay */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full flex items-center gap-3 text-xs border border-gray-700 shadow-xl">
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                  <Play className="w-3 h-3 fill-white ml-0.5" />
                </div>
                <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="w-3/5 h-full bg-purple-500" />
                </div>
                <span className="font-mono text-[11px] text-gray-300">60%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
