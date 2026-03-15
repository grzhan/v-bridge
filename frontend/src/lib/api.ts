import axios from 'axios';

import type { ApiResponse } from './types';

function resolveBaseURL() {
  const explicitBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (explicitBase) {
    return explicitBase.replace(/\/+$/, '');
  }

  const apiPort = import.meta.env.VITE_API_PORT?.trim();
  if (typeof window !== 'undefined') {
    const port = apiPort || '8000';
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return 'http://localhost:8000';
}

const baseURL = resolveBaseURL();

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export async function getData<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url);
  return data.data;
}

export async function postData<T>(url: string, payload?: unknown): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, payload);
  return data.data;
}

export async function patchData<T>(url: string, payload?: unknown): Promise<T> {
  const { data } = await api.patch<ApiResponse<T>>(url, payload);
  return data.data;
}

export async function deleteData<T>(url: string): Promise<T> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data.data;
}
