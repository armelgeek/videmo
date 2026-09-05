"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameWithLock } from "@/lib/video-project/rename";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  initialTitle?: string;
  onDone: () => void;
}

export function VideoProjectDialog({
  open,
  onOpenChange,
  projectId,
  initialTitle = "",
  onDone,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      if (projectId) {
        await renameWithLock(projectId, title, {
          takeLock: (id) => api.post(`/api/video-projects/${id}/lock`, {}),
          patchTitle: (id, value) => api.patch(`/api/video-projects/${id}`, { title: value }),
          releaseLock: (id) => api.delete(`/api/video-projects/${id}/lock`),
        });
      } else {
        const res = await api.post("/api/video-projects", { title });
        if (!res.ok) throw new Error(res.error);
      }

      toast.success(projectId ? "Projet renommé" : "Projet créé");
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {projectId ? "Renommer le projet" : "Nouveau projet"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || title.trim() === ""}>
              {projectId ? "Renommer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
