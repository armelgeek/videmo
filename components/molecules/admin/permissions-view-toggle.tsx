"use client";

import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, Grid } from "lucide-react";

interface PermissionsViewToggleProps {
  onViewChange: (view: "list" | "matrix") => void;
}

export function PermissionsViewToggle({ onViewChange }: PermissionsViewToggleProps) {
  const [view, setView] = useState<"list" | "matrix">("matrix");

  const handleViewChange = (newView: "list" | "matrix") => {
    setView(newView);
    onViewChange(newView);
  };

  return (
    <ToggleGroup type="single" value={view} onValueChange={(v) => v && handleViewChange(v as "list" | "matrix")}>
      <ToggleGroupItem value="matrix" aria-label="Matrix view">
        <Grid className="h-4 w-4 mr-2" />
        Matrix View
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List className="h-4 w-4 mr-2" />
        List View
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
