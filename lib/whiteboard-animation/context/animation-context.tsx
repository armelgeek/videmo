'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AnimationContextType {
  animStyle: string;
  setAnimStyle: (style: string) => void;
  handStyle: string;
  setHandStyle: (style: string) => void;
  revealSpeed: number;
  setRevealSpeed: (speed: number) => void;
  handSpeed: number;
  setHandSpeed: (speed: number) => void;
  chunks: number;
  setChunks: (chunks: number) => void;
  canvasBg: string;
  setCanvasBg: (bg: string) => void;
  useAnnotation: boolean;
  setUseAnnotation: (use: boolean) => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(
  undefined,
);

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [animStyle, setAnimStyle] = useState('chunkjump');
  const [handStyle, setHandStyle] = useState('custom1');
  const [revealSpeed, setRevealSpeed] = useState(40);
  const [handSpeed, setHandSpeed] = useState(6);
  const [chunks, setChunks] = useState(30);
  const [canvasBg, setCanvasBg] = useState('white');
  const [useAnnotation, setUseAnnotation] = useState(true);

  return (
    <AnimationContext.Provider
      value={{
        animStyle,
        setAnimStyle,
        handStyle,
        setHandStyle,
        revealSpeed,
        setRevealSpeed,
        handSpeed,
        setHandSpeed,
        chunks,
        setChunks,
        canvasBg,
        setCanvasBg,
        useAnnotation,
        setUseAnnotation,
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimationContext() {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error(
      'useAnimationContext must be used within AnimationProvider',
    );
  }
  return context;
}
