'use client';

import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

const COMPARISON_ITEMS = [
  {
    feature: 'Contrôle Région par Région (Boîtes numérotées 1, 2, 3...)',
    us: true,
    others: false,
    detail: 'Découpage séquentiel précis du tracé',
  },
  {
    feature: 'Éditeur Konva (Drag & Resize interactif des boîtes)',
    us: true,
    others: false,
    detail: 'Ajustement visuel immédiat sur le canvas',
  },
  {
    feature: 'Animation Main & Crayon Réaliste (Choix des styles)',
    us: true,
    others: false,
    detail: 'Styles Ghost, Mains réelles et Crayon avec vitesse variable',
  },
  {
    feature: 'Timeline Vidéo & Audio Multi-pistes',
    us: true,
    others: false,
    detail: 'Synchronisation audio, voix-off et scrubbing fluide',
  },
  {
    feature: 'Génération & Ingestion d\'images IA',
    us: true,
    others: true,
    detail: 'Génération de décors et sujets par prompts IA',
  },
  {
    feature: 'Droits commerciaux & Export 1080p',
    us: true,
    others: true,
    detail: 'Export haute fidélité pour présentations et démos client',
  },
];

export const ComparisonSection: React.FC = () => {
  return (
    <section className="py-24 bg-[#0A0B0E] text-white relative border-t border-white/10">
      <div className="container max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400">
            Pourquoi Choisir Notre Studio ?
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white">
            Un Véritable Studio de Montage vs Les Générateurs IA 2D Basiques
          </p>
          <p className="text-gray-400 text-base">
            Découvrez la différence entre une simple animation vidéo générique et notre plateforme de contrôle créatif total.
          </p>
        </div>

        {/* Comparison Table Card */}
        <div className="bg-[#12131A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-[#1A1B24] p-4 sm:p-6 border-b border-white/10 text-sm font-bold items-center">
            <div className="col-span-6 sm:col-span-6 text-gray-300">Fonctionnalités Produit</div>
            <div className="col-span-3 sm:col-span-3 text-center text-purple-400 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Notre Studio IA</span>
            </div>
            <div className="col-span-3 sm:col-span-3 text-center text-gray-400">SketchToVideoAI & Outils 2D</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/5">
            {COMPARISON_ITEMS.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-12 p-4 sm:p-5 items-center hover:bg-white/[0.02] transition-colors text-xs sm:text-sm"
              >
                <div className="col-span-6 sm:col-span-6 space-y-0.5">
                  <span className="font-semibold text-white block">{item.feature}</span>
                  <span className="text-[11px] text-gray-400 font-normal">{item.detail}</span>
                </div>

                <div className="col-span-3 sm:col-span-3 flex items-center justify-center">
                  {item.us ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center">
                      <X className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </div>

                <div className="col-span-3 sm:col-span-3 flex items-center justify-center">
                  {item.others ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/70 flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[2]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-gray-500 flex items-center justify-center">
                      <X className="w-4 h-4 stroke-[2]" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
