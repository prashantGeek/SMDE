export const apiRoutes = {
  sessions: {
    list: "/api/sessions",
    byId: (id: string) => `/api/sessions/${id}`,
    validate: (id: string) => `/api/sessions/${id}/validate`,
    remove: (id: string) => `/api/sessions/${id}`,
  },
  jobs: {
    byId: (jobId: string) => `/api/jobs/${jobId}`,
  },
  extract: {
    upload: (mode: string) => `/api/extract?mode=${mode}`,
  },
} as const;
