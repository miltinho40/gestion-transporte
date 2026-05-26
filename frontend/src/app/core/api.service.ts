import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from './api.config';

type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, QueryValue>) {
    return this.http.get<T>(`${API_BASE_URL}${path}`, { params: this.buildParams(params) });
  }

  post<T>(path: string, body: unknown, params?: Record<string, QueryValue>) {
    return this.http.post<T>(`${API_BASE_URL}${path}`, body, { params: this.buildParams(params) });
  }

  put<T>(path: string, body: unknown, params?: Record<string, QueryValue>) {
    return this.http.put<T>(`${API_BASE_URL}${path}`, body, { params: this.buildParams(params) });
  }

  delete<T>(path: string, params?: Record<string, QueryValue>) {
    return this.http.delete<T>(`${API_BASE_URL}${path}`, { params: this.buildParams(params) });
  }

  download(path: string, params?: Record<string, QueryValue>) {
    return this.http.get(`${API_BASE_URL}${path}`, {
      params: this.buildParams(params),
      observe: 'response',
      responseType: 'blob'
    });
  }

  saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  filenameFromDisposition(disposition: string | null, fallback: string) {
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? fallback;
  }

  private buildParams(params?: Record<string, QueryValue>) {
    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === null || value === undefined || value === '') continue;
      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }
}
