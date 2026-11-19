import crypto from 'crypto';
import { config } from '../config.js';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in seconds
  tokenType: string;
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
}

export class SpotifyPkceService {
  /**
   * Generates a high-entropy cryptographic code_verifier (PKCE)
   */
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generates code_challenge from code_verifier using SHA-256 (S256)
   */
  generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  /**
   * Generates a random cryptographic state string for CSRF mitigation
   */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Builds the official Spotify Authorization URL
   */
  buildAuthorizeUrl(state: string, codeChallenge: string): string {
    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id', config.spotify.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', config.spotify.redirectUri);
    url.searchParams.set('scope', config.spotify.scopes);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', codeChallenge);
    return url.toString();
  }

  /**
   * Exchanges authorization code for Access & Refresh tokens
   */
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
    if (config.mockExternalProviders && code.startsWith('mock_')) {
      return {
        accessToken: `mock_access_token_${crypto.randomBytes(16).toString('hex')}`,
        refreshToken: `mock_refresh_token_${crypto.randomBytes(16).toString('hex')}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
      };
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.spotify.redirectUri,
      client_id: config.spotify.clientId,
      code_verifier: codeVerifier,
    });

    // Basic auth header with client credentials if secret provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (config.spotify.clientSecret) {
      const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Spotify token exchange error ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
    };
  }

  /**
   * Refreshes an expired Spotify access token using refresh_token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (config.mockExternalProviders && refreshToken.startsWith('mock_')) {
      return {
        accessToken: `mock_refreshed_access_${crypto.randomBytes(16).toString('hex')}`,
        expiresIn: 3600,
      };
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.spotify.clientId,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (config.spotify.clientSecret) {
      const basic = Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Spotify token refresh error ${res.status}: ${errorText}`);
    }

    const data = (await res.json()) as any;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  }

  /**
   * Fetches the user profile from Spotify to extract the Spotify user ID
   */
  async fetchUserProfile(accessToken: string): Promise<SpotifyProfile> {
    if (config.mockExternalProviders && accessToken.startsWith('mock_')) {
      return {
        id: 'spotify_mock_student_user',
        displayName: 'Marco (Demo Student)',
      };
    }

    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Spotify /v1/me request failed with status ${res.status}`);
    }

    const data = (await res.json()) as any;
    return {
      id: data.id,
      displayName: data.display_name || data.id,
    };
  }
}

export const spotifyPkceService = new SpotifyPkceService();
