'use client';

import React from 'react';
import { Wand2, MousePointerClick, Edit3, Film, ArrowRight } from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Génération ou Import IA',
    description: 'Importez votre croquis, storyboard ou générez une scène haute fidélité par intelligence artificielle.',
    icon: Wand2,
    color: 'from-purple-500 to-indigo-500',
    badge: 'Image & Prompts',
  },
  {
    step: '02',
    title: 'Annotation par Régions (Konva)',
    description: 'Le moteur détecte et numérote les zones (1, 2, 3...). Ajustez la taille et la position des cadres par simple Drag & Resize.',
    icon: MousePointerClick,
    color: 'from-blue-500 to-cyan-500',
    badge: 'Découpage Numéroté',
  },
  {
    step: '03',
    title: 'Animation Tableau Blanc',
    description: 'Sélectionnez le style de main, le crayon et la vitesse. L\'animation dessine chaque région dans l\'ordre chronologique.',
    icon: Edit3,
    color: 'from-rose-500 to-amber-500',
    badge: 'Hand-Draw Engine',
  },
  {
    step: '04',
    title: 'Montage Vidéo Multi-pistes',
    description: 'Assemblez vos scènes sur la timeline, ajoutez la voix-off, la musique de fond et exportez en 1080p sans filigrane.',
    icon: Film,
    color: 'from-emerald-500 to-teal-500',
    badge: 'Timeline Complete',
  },
];

export const WorkflowSection: React.FC = () => {
  return (
    <section className="py-24 bg-[#0E0F14] text-white relative">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400">
            Flux de Production Intelligente
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white">
            Du Croquis Brut au Montage Vidéo Final en 4 Étapes
          </p>
          <p className="text-gray-400 text-base">
            Une méthodologie éprouvée associant l&apos;IA générative et le contrôle temporel précis.
          </p>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {WORKFLOW_STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-[#16171F] border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 shadow-xl flex flex-col justify-between group"
              >
                {/* Step Number & Badge */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-black text-white/20 group-hover:text-purple-400/40 font-mono transition-colors">
                      {item.step}
                    </span>
                    <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
                      {item.badge}
                    </span>
                  </div>

                  {/* Icon Box */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                {/* Step Connector Arrow */}
                {index < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 text-white/20">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
