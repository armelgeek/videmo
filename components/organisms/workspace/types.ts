export type ProjectStep = "prompt" | "storyboard" | "whiteboard";

export interface ProjectListItem {
  id: string;
  title: string;
  status: string;
  step: ProjectStep;
  aspectRatio: "16:9" | "9:16" | "1:1";
  updatedAt: string;
  previewUrl: string | null;
  sceneCount: number;
  createdBy: { id: string; name: string } | null;
  lock: {
    state: "free" | "held-by-me" | "held-by-other";
    byId: string | null;
    by: { id: string; name: string } | null;
  };
}

export interface ProjectListResponse {
  data: ProjectListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  organization: { id: string; name: string; isPersonal: boolean } | null;
  viewer: {
    role: string;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}
