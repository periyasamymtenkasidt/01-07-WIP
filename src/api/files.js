// Files API — multipart upload + streamed fetch (FRONTEND_API.md §10).
//
// Upload returns file metadata; store the returned `id` as `fileId` on a
// deliverable/measurement, then render the binary via `fileObjectUrl(id)`.

import { api, API_BASE, tokens } from "./client";

// POST /files (multipart) → { id, name, mime, size, ... }
export function uploadFile(file, { ownerType, ownerId } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  if (ownerType) fd.append("ownerType", ownerType);
  if (ownerId) fd.append("ownerId", ownerId);
  return api("/files", { method: "POST", body: fd });
}

// GET /files/:id?meta=true → JSON metadata (no binary).
export const getFileMeta = (id) => api(`/files/${id}?meta=true`);

// GET /files/:id → streams the binary. Returns an object URL the caller is
// responsible for revoking (URL.revokeObjectURL) when done.
export async function fileObjectUrl(id) {
  const res = await api(`/files/${id}`, { raw: true });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Direct, auth-less URL is NOT usable (endpoint requires the Bearer header), so
// expose the authenticated base for callers that build their own fetches.
export const fileUrl = (id) => `${API_BASE}/files/${id}`;

// DELETE /files/:id — removes binary + metadata.
export const deleteFile = (id) => api(`/files/${id}`, { method: "DELETE" });

// Convenience for components that already hold a token-bearing context.
export const authHeader = () => ({ Authorization: `Bearer ${tokens.access()}` });
