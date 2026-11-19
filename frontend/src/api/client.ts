import { MatchesResponse } from '@eventspot/shared';

export interface SearchFilters {
  lat: number;
  lon: number;
  radiusKm: number;
  dateFrom?: string;
  dateTo?: string;
  maxPrice?: number;
  includeUnpriced: boolean;
  sortBy: 'relevance' | 'date' | 'distance' | 'price';
}

export interface SessionInfo {
  authenticated: boolean;
  userHash?: string;
  tokenExpiresAt?: string;
}

const API_BASE = '/v1';

export const apiClient = {
  /**
   * Fetches the current session state
   */
  async getSession(): Promise<SessionInfo> {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, {
        credentials: 'include',
      });
      if (!res.ok) {
        return { authenticated: false };
      }
      return await res.json();
    } catch {
      return { authenticated: false };
    }
  },

  /**
   * One-click mock login for immediate local testing & thesis defense
   */
  async mockLogin(): Promise<{ success: boolean; userHash: string }> {
    const res = await fetch(`${API_BASE}/auth/mock-login`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Mock login failed: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Standard logout
   */
  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  /**
   * GDPR Right to Erasure - permanently deletes session and credentials
   */
  async deleteAccount(): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`GDPR erasure failed: ${res.statusText}`);
    }
  },

  /**
   * Main recommendation search endpoint
   */
  async getMatches(filters: SearchFilters): Promise<MatchesResponse> {
    const params = new URLSearchParams({
      lat: filters.lat.toString(),
      lon: filters.lon.toString(),
      radiusKm: filters.radiusKm.toString(),
      sortBy: filters.sortBy,
      includeUnpriced: String(filters.includeUnpriced),
    });

    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
      params.set('maxPrice', filters.maxPrice.toString());
    }

    const res = await fetch(`${API_BASE}/matches?${params.toString()}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      let errorMsg = `Server error ${res.status}`;
      try {
        const problem = await res.json();
        errorMsg = problem.detail || problem.title || errorMsg;
      } catch {
        // use fallback
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  },
};
