// fileStorage.js
// An IndexedDB helper to persist uploaded files (Images, PDFs, Documents)

const DB_NAME = "wipFileStore";
const STORE_NAME = "files";
const DB_VERSION = 1;

let dbInstance = null;

function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

export async function storeFile(id, file) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const data = {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      data: file, // Store the File/Blob directly
      updatedAt: Date.now(),
    };
    const req = store.put(data);
    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

export async function getFile(id) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result.data); // Returns the Blob
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// Utility to resolve all stored file URLs in a site object
export async function resolveSiteFileUrls(site) {
  if (!site) return site;
  const resolved = { ...site };

  // 1. Resolve referenceFiles
  if (resolved.referenceFiles && resolved.referenceFiles.length > 0) {
    resolved.referenceFiles = await Promise.all(
      resolved.referenceFiles.map(async (file) => {
        if (file.id && file.id.startsWith("file-")) {
          const blob = await getFile(file.id);
          if (blob) {
            const freshUrl = URL.createObjectURL(blob);
            const updatedVersions = file.versions ? await Promise.all(file.versions.map(async (v) => {
              return { ...v, url: freshUrl };
            })) : [];
            return { ...file, url: freshUrl, versions: updatedVersions };
          }
        }
        return file;
      })
    );
  }

  // 2. Resolve revisions attachments
  if (resolved.revisions && resolved.revisions.length > 0) {
    resolved.revisions = await Promise.all(
      resolved.revisions.map(async (rev) => {
        const attachedFiles = rev.attachedFiles && rev.attachedFiles.length > 0
          ? await Promise.all(
              rev.attachedFiles.map(async (file) => {
                if (file.id && file.id.startsWith("file-")) {
                  const blob = await getFile(file.id);
                  if (blob) {
                    const freshUrl = URL.createObjectURL(blob);
                    const updatedVersions = file.versions ? await Promise.all(file.versions.map(async (v) => {
                      return { ...v, url: freshUrl };
                    })) : [];
                    return { ...file, url: freshUrl, versions: updatedVersions };
                  }
                }
                return file;
              })
            )
          : [];
        return { ...rev, attachedFiles };
      })
    );
  }

  // 3. Resolve drawings and their versions
  if (resolved.drawings && resolved.drawings.length > 0) {
    resolved.drawings = await Promise.all(
      resolved.drawings.map(async (draw) => {
        let freshFileUrl = draw.fileUrl;
        if (draw.id && draw.id.startsWith("file-")) {
          const blob = await getFile(draw.id);
          if (blob) {
            freshFileUrl = URL.createObjectURL(blob);
          }
        }
        const versions = draw.versions && draw.versions.length > 0
          ? await Promise.all(
              draw.versions.map(async (v) => {
                let vUrl = v.url;
                if (draw.id && draw.id.startsWith("file-")) {
                  vUrl = freshFileUrl;
                }
                return { ...v, url: vUrl };
              })
            )
          : [];
        return { ...draw, fileUrl: freshFileUrl, versions };
      })
    );
  }

  // 4. Resolve discussionHistory attachments
  if (resolved.discussionHistory && resolved.discussionHistory.length > 0) {
    resolved.discussionHistory = await Promise.all(
      resolved.discussionHistory.map(async (msg) => {
        const attachments = msg.attachments && msg.attachments.length > 0
          ? await Promise.all(
              msg.attachments.map(async (file) => {
                if (file.id && file.id.startsWith("file-")) {
                  const blob = await getFile(file.id);
                  if (blob) {
                    const freshUrl = URL.createObjectURL(blob);
                    return { ...file, url: freshUrl };
                  }
                }
                return file;
              })
            )
          : [];
        return { ...msg, attachments };
      })
    );
  }

  return resolved;
}
