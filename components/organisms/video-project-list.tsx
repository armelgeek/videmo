"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { VideoProjectDialog } from "@/components/molecules/forms/video-project-dialog";

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  aspectRatio: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  lock: { state: "free" | "held-by-me" | "held-by-other"; byId: string | null };
}

interface ListResponse {
  data: ProjectRow[];
  total: number;
}

export function VideoProjectList({ canDelete }: { canDelete: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<ListResponse>("/api/video-projects");
      if (!res.ok) throw new Error(res.error);
      setRows(res.data.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (project: ProjectRow) => {
    if (!confirm(`Supprimer « ${project.title} » ?`)) return;
    try {
      const res = await api.delete(`/api/video-projects/${project.id}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Projet supprimé");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Nouveau projet</Button>
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg bg-card p-12 text-center">
          <p className="font-medium">Aucun projet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Créez-en un pour commencer une vidéo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((project) => (
            <div key={project.id} className="border rounded-lg bg-card p-6 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight">{project.title}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/storyboard?project=${project.id}`)}
                    >
                      Ouvrir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenaming(project)}>
                      Renommer
                    </DropdownMenuItem>
                    {canDelete && (
                      <DropdownMenuItem onClick={() => handleDelete(project)}>
                        Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{project.status}</Badge>
                <Badge variant="outline">{project.aspectRatio}</Badge>
                {project.lock.state === "held-by-other" && (
                  <Badge variant="destructive">En cours d'édition</Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {project.createdBy?.name ?? "Auteur inconnu"} —{" "}
                {new Date(project.updatedAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          ))}
        </div>
      )}

      <VideoProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onDone={load}
      />
      {renaming && (
        <VideoProjectDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          projectId={renaming.id}
          initialTitle={renaming.title}
          onDone={load}
        />
      )}
    </div>
  );
}
