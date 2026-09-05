export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ProjectForbiddenError";
  }
}

export class ProjectLockedError extends Error {
  constructor(
    readonly lockedById: string | null,
    readonly lockExpiresAt: Date | null,
  ) {
    super("Project is locked by another member");
    this.name = "ProjectLockedError";
  }
}

export class DataUrlRejectedError extends Error {
  constructor(readonly path: string) {
    super(`A data: URL is not accepted (at ${path})`);
    this.name = "DataUrlRejectedError";
  }
}
