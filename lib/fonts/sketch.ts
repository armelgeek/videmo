import { Bricolage_Grotesque, Figtree, Gochi_Hand } from "next/font/google";

export const sketchHand = Gochi_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sketch-hand",
  display: "swap",
});

export const sketchDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-sketch-display",
  display: "swap",
});

export const sketchBody = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sketch-body",
  display: "swap",
});

export const sketchFontVariables = `${sketchHand.variable} ${sketchDisplay.variable} ${sketchBody.variable}`;
