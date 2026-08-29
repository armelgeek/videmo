'use client';

import React from 'react';
import Link from 'next/link';
import {
  MousePointerClick,
  Layers,
  Wand2,
  Music,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: MousePointerClick,
    color: 'from-violet-500 to-purple-500',
    glow: 'shadow-violet-500/20',
    title: 'Éditeur Konva Interactif',
    description:
      'Dessinez, déplacez et redimensionnez chaque boîte de région directement sur le canvas via drag & drop. La synchronisation avec le moteur d\'animation est instantanée.',
  },
  {
    icon: Layers,
    color: 'from-blue-500 to-cyan-500',
    glow: 'shadow-blue-500/20',
    title: 'Timeline Multi-pistes',
    description:
      'Assemblez vos scènes, ajoutez des pistes audio, voix-off, sous-titres et effets sur une timeline professionnelle avec scrubbing frame-accurate.',
  },
  {
    icon: Wand2,
    color: 'from-rose-500 to-pink-500',
    glow: 'shadow-rose-500/20',
    title: 'Génération IA Intégrée',
    description:
      'Générez des scènes illustratives par prompt IA. Le moteur d\'annotation découpe automatiquement l\'image en zones numérotées prêtes à animer.',
  },
  {
    icon: Music,
    color: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/20',
    title: 'Sync Audio & Voix-off',
    description:
      'Importez de la musique de fond ou une voix-off. La timeline synchronise précisément l\'audio avec l\'animation région par région.',
  },
  {
    icon: Zap,
    color: 'from-emerald-500 to-teal-500',
    glow: 'shadow-emerald-500/20',
    title: 'Styles Main & Vitesse Variable',
    description:
      'Choisissez parmi plusieurs styles de main réalistes (Ghost, Crayon, Rotring) et ajustez la vitesse de tracé pour chaque séquence.',
  },
  {
    icon: Shield,
    color: 'from-indigo-500 to-blue-500',
    glow: 'shadow-indigo-500/20',
    title: 'Export 1080p & Droits Commerciaux',
    description:
      'Exportez chaque production en Full HD sans filigrane. Tous les droits commerciaux sont inclus pour vos pitchs clients et campagnes marketing.',
  },
];

const STATS = [
  { value: '5×', label: 'Plus rapide que la vidéo traditionnelle' },
  { value: '1080p', label: 'Export Full HD sans filigrane' },
  { value: '∞', label: 'Régions d\'annotation par scène' },
  { value: '100%', label: 'Droits commerciaux inclus' },
];

export const WhiteboardFeaturesSection: React.FC = () => {
  return (
    <>
      {/* Stats Bar */}
      <section className="py-12 bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border-y border-white/10">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="text-3xl md:text-4xl font-black bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-400 font-medium leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="py-24 bg-[#0A0B0E] text-white">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400">
              Fonctionnalités du Studio
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">
              Tout ce dont vous avez besoin pour créer des vidéos Whiteboard Professionnelles
            </p>
            <p className="text-gray-400 text-base">
              Un outil pensé pour les créateurs de contenu, les marketeurs et les studios de production.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group bg-[#13141C] border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-5 shadow-lg ${feature.glow} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-purple-200 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA Block */}
          <div className="mt-20 relative rounded-3xl overflow-hidden border border-white/10">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-indigo-900/40 to-rose-900/30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-purple-500/20 blur-[80px] rounded-full" />

            <div className="relative z-10 py-16 px-8 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-purple-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Studio disponible maintenant — Accès gratuit
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-white max-w-2xl mx-auto">
                Prêt à créer votre première vidéo Whiteboard IA ?
              </h2>

              <p className="text-gray-300 max-w-xl mx-auto text-base">
                Rejoignez des milliers de créateurs qui produisent des animations tableau blanc professionnelles 5× plus vite grâce à notre studio.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Link
                  href="/storyboard"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all text-sm group"
                >
                  Lancer le Studio Gratuitement
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 border border-white/20 bg-white/5 hover:bg-white/10 text-gray-200 font-medium px-7 py-3.5 rounded-xl backdrop-blur text-sm transition-all"
                >
                  Créer un compte gratuit
                </Link>
              </div>

              <p className="text-xs text-gray-500 pt-2">
                Aucune carte bancaire requise · Export 1080p inclus · Droits commerciaux 100%
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
