"use client";

import React from "react";
import { Timeline } from "@/lib/editor/components/timeline";
import { useAnnotationTimeline } from "./use-annotation-timeline";

/**
 * The whiteboard editor's timeline: every clip is an annotation, chained in
 * sequence. Positions are derived, never stored — see ./adapter docs.
 */
export const AnnotationTimeline: React.FC = () => {
  const timeline = useAnnotationTimeline();

  return (
    <div className="shrink-0 border-t border-border">
      <Timeline {...timeline} />
    </div>
  );
};
