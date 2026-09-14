"use client";

import { useState } from "react";
import { appConfig } from "@/lib/config";
import { TEAM_PLAN } from "./pricing";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

type SliderProps = {
  id: string;
  label: string;
  hint: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
};

function Slider({ id, label, hint, value, display, min, max, step = 1, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="calc-field">
      <div className="calc-field-top">
        <label htmlFor={id}>
          {label}
          <small>{hint}</small>
        </label>
        <output htmlFor={id} className="calc-chip">{display}</output>
      </div>
      <input
        id={id}
        className="calc-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ ["--pct" as string]: `${pct}%` }}
      />
      <div className="calc-scale sk-mono" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function SavingsCalculator() {
  const [videos, setVideos] = useState(4);
  const [cost, setCost] = useState(1500);
  const [hours, setHours] = useState(6);

  const spend = videos * cost * 12;
  const planYearly = TEAM_PLAN.monthly * 12;
  const kept = spend - planYearly;
  const teamHours = videos * hours * 12;

  return (
    <div className="calc">
      <form className="calc-sheet" onSubmit={(e) => e.preventDefault()}>
        <span className="shot-tape" aria-hidden="true" />
        <p className="sk-eyebrow">Your numbers today</p>
        <Slider id="calc-videos" label="Videos per month" hint="explainers, teasers, tutorials" value={videos} display={`${videos}`} min={1} max={30} onChange={setVideos} />
        <Slider id="calc-cost" label="Cost per video" hint="freelancer or agency quote" value={cost} display={`$${fmt(cost)}`} min={200} max={5000} step={100} onChange={setCost} />
        <Slider id="calc-hours" label="Internal hours per video" hint="briefs, reviews, feedback rounds" value={hours} display={`${hours} h`} min={1} max={20} onChange={setHours} />
      </form>

      <div className="calc-result" aria-live="polite">
        <div className="calc-line">
          <span className="sk-eyebrow">What you spend per year</span>
          <span className={`calc-big sk-display ${kept > 0 ? "is-struck" : ""}`}>${fmt(spend)}</span>
          <span className="calc-sub">plus {fmt(teamHours)} team hours of back-and-forth</span>
        </div>

        <div className="calc-line calc-line-plan">
          <span className="sk-eyebrow">{appConfig.name} {TEAM_PLAN.name}, per year</span>
          <span className="calc-mid sk-display">${fmt(planYearly)}</span>
          <span className="calc-sub">unlimited projects, whole team included</span>
        </div>

        {kept > 0 ? (
          <p className="calc-kept">
            <span className="sk-hand calc-kept-note">you keep</span>
            <span className="calc-kept-value sk-display">${fmt(kept)}</span>
            <span className="calc-sub">every year, before counting the hours.</span>
          </p>
        ) : (
          <p className="calc-kept">
            <span className="calc-sub">At this volume the subscription costs about the same — the win is speed and every format from one project.</span>
          </p>
        )}
      </div>
    </div>
  );
}
