const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('teledrive_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return data as T;
}

export function getFileRawUrl(fileId: string): string {
  const token = localStorage.getItem('teledrive_token');
  return `${API_BASE}/files/${fileId}/raw?token=${token || ''}`;
}

export async function uploadFileVersion(fileId: string, contentBlob: Blob, filename: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', contentBlob, filename);
  return apiRequest(`/files/${fileId}/version`, {
    method: 'POST',
    body: formData,
  });
}
