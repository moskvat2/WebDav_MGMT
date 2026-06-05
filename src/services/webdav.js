// WebDAV client service for houseos WebDAV server

const BASE_URL = '/api/webdav';

/**
 * Get dynamic auth header from session storage
 */
function getAuthHeader() {
  const token = sessionStorage.getItem('webdav_auth');
  return token ? `Basic ${token}` : '';
}


/**
 * Clean path helper
 */
function cleanPath(path) {
  if (!path) return '/';
  if (!path.startsWith('/')) path = '/' + path;
  if (!path.endsWith('/') && !path.includes('.')) {
    // If it's a directory (usually indicated by not containing a dot, or we enforce it)
    // we let it be. But we will handle both.
  }
  return path;
}

/**
 * Parse XML Multi-Status response from PROPFIND
 */
function parsePropfindResponse(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const responses = xmlDoc.getElementsByTagNameNS('DAV:', 'response');
  const items = [];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    
    // Href
    const hrefEl = resp.getElementsByTagNameNS('DAV:', 'href')[0];
    if (!hrefEl) continue;
    let href = decodeURIComponent(hrefEl.textContent);
    
    // Normalize href to remove base url if present
    if (href.startsWith(BASE_URL)) {
      href = href.substring(BASE_URL.length);
    }
    
    // Propstats
    const propstats = resp.getElementsByTagNameNS('DAV:', 'propstat');
    let prop = null;
    for (let j = 0; j < propstats.length; j++) {
      const statusEl = propstats[j].getElementsByTagNameNS('DAV:', 'status')[0];
      if (statusEl && statusEl.textContent.includes('200')) {
        prop = propstats[j].getElementsByTagNameNS('DAV:', 'prop')[0];
        break;
      }
    }
    
    if (!prop) continue;
    
    // Name / DisplayName
    const dispNameEl = prop.getElementsByTagNameNS('DAV:', 'displayname')[0];
    let name = dispNameEl ? dispNameEl.textContent : href.split('/').filter(Boolean).pop() || '/';
    
    // Resource Type (directory vs file)
    const resTypeEl = prop.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
    const isDir = resTypeEl && resTypeEl.getElementsByTagNameNS('DAV:', 'collection').length > 0;
    
    // Size
    const sizeEl = prop.getElementsByTagNameNS('DAV:', 'getcontentlength')[0];
    const size = sizeEl ? parseInt(sizeEl.textContent, 10) : null;
    
    // Last Modified
    const modEl = prop.getElementsByTagNameNS('DAV:', 'getlastmodified')[0];
    const lastModified = modEl ? modEl.textContent : null;
    
    // Content Type
    const typeEl = prop.getElementsByTagNameNS('DAV:', 'getcontenttype')[0];
    const contentType = typeEl ? typeEl.textContent : (isDir ? 'directory' : 'application/octet-stream');

    items.push({
      name,
      path: href,
      isDir,
      size,
      lastModified,
      contentType
    });
  }
  
  return items;
}

export const webdav = {
  /**
   * Check if credentials exist in session
   */
  hasCredentials() {
    return !!sessionStorage.getItem('webdav_auth');
  },

  /**
   * Clear active credentials (logout)
   */
  clearCredentials() {
    sessionStorage.removeItem('webdav_auth');
    sessionStorage.removeItem('webdav_username');
  },

  /**
   * Get logged in username
   */
  getUsername() {
    return sessionStorage.getItem('webdav_username') || '';
  },

  /**
   * Authenticate by attempting a PROPFIND on the root path
   */
  async authenticate(user, password) {
    const token = btoa(`${user}:${password}`);
    const response = await fetch(`${BASE_URL}/`, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${token}`,
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Usuário ou senha incorretos.');
      }
      throw new Error(`Falha na autenticação: ${response.statusText}`);
    }

    // Save credentials on success
    sessionStorage.setItem('webdav_auth', token);
    sessionStorage.setItem('webdav_username', user);
    return true;
  },

  /**
   * List files in a directory
   */
  async listFiles(path = '/') {
    const targetPath = cleanPath(path);
    const response = await fetch(`${BASE_URL}${targetPath}`, {
      method: 'PROPFIND',
      headers: {
        'Authorization': getAuthHeader(),
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch directory: ${response.statusText}`);
    }
    
    const xmlText = await response.text();
    const allItems = parsePropfindResponse(xmlText);
    
    // Filter out the requested directory itself from the list
    const normalizedTarget = targetPath.endsWith('/') ? targetPath : targetPath + '/';
    return allItems.filter(item => {
      const normalizedItemPath = item.path.endsWith('/') ? item.path : item.path + '/';
      return normalizedItemPath !== normalizedTarget;
    });
  },

  /**
   * Create a new folder
   */
  async createFolder(parentPath, folderName) {
    const fullPath = `${cleanPath(parentPath)}/${folderName}`.replace(/\/+/g, '/');
    const response = await fetch(`${BASE_URL}${fullPath}`, {
      method: 'MKCOL',
      headers: {
        'Authorization': getAuthHeader()
      }
    });
    
    if (!response.ok && response.status !== 201) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }
    return true;
  },

  /**
   * Delete a file or folder
   */
  async deleteItem(path) {
    const response = await fetch(`${BASE_URL}${cleanPath(path)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': getAuthHeader()
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete item: ${response.statusText}`);
    }
    return true;
  },

  /**
   * Rename or move a file/folder
   */
  async renameItem(oldPath, newPath) {
    const response = await fetch(`${BASE_URL}${cleanPath(oldPath)}`, {
      method: 'MOVE',
      headers: {
        'Authorization': getAuthHeader(),
        'Destination': encodeURI(cleanPath(newPath))
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to move/rename item: ${response.statusText}`);
    }
    return true;
  },

  /**
   * Copy a file/folder
   */
  async copyItem(oldPath, newPath) {
    const response = await fetch(`${BASE_URL}${cleanPath(oldPath)}`, {
      method: 'COPY',
      headers: {
        'Authorization': getAuthHeader(),
        'Destination': encodeURI(cleanPath(newPath))
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to copy item: ${response.statusText}`);
    }
    return true;
  },

  /**
   * Upload a file
   */
  uploadFile(parentPath, file, onProgress) {
    return new Promise((resolve, reject) => {
      const fullPath = `${cleanPath(parentPath)}/${file.name}`.replace(/\/+/g, '/');
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${BASE_URL}${fullPath}`);
      xhr.setRequestHeader('Authorization', getAuthHeader());
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => {
        reject(new Error('Upload failed: Network Error'));
      };
      
      xhr.send(file);
    });
  },

  /**
   * Get file URL for download/preview
   */
  getFileUrl(path) {
    return `${BASE_URL}${cleanPath(path)}?auth=${sessionStorage.getItem('webdav_auth')}`; // Pass auth in query or let browser basic auth handle it if native. The browser proxy target will receive it from headers if passed, but for download we can just let window.open try with native basic auth or custom handler. Note: WebDAV download via direct GET usually requires auth.
  }
};

