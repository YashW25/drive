export class OpenWAService {
  private static get config() {
    let apiUrl = process.env.OPENWA_API_URL || 'http://localhost:2785';
    apiUrl = apiUrl.replace(/\/$/, '');
    if (!apiUrl.endsWith('/api')) {
      apiUrl = `${apiUrl}/api`;
    }
    const sessionId = process.env.OPENWA_SESSION_ID || 'default';
    const apiKey = process.env.OPENWA_API_KEY || 'zentro_openwa_master_key_2026_secret';
    return { apiUrl, sessionId, apiKey };
  }

  /**
   * Dynamically discover active connected session ID if default fails
   */
  private static async getActiveSessionId(): Promise<string> {
    const { apiUrl, sessionId, apiKey } = this.config;
    try {
      const res = await fetch(`${apiUrl}/sessions`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (res.ok) {
        const sessions: any = await res.json();
        if (Array.isArray(sessions)) {
          const match = sessions.find((s: any) => (s.name === sessionId || s.id === sessionId) && s.status === 'ready') ||
                        sessions.find((s: any) => s.status === 'ready') ||
                        sessions.find((s: any) => s.name === sessionId || s.id === sessionId) ||
                        sessions[0];
          if (match?.id) return match.id;
        }
      }
    } catch (_) {}

    return sessionId;
  }

  /**
   * Send WhatsApp OTP message via OpenWA
   */
  static async sendOtp(phoneNumber: string, code: string): Promise<boolean> {
    const { apiUrl, apiKey } = this.config;
    const activeSessionId = await this.getActiveSessionId();
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;
    const message = `Your Zentro Drive verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;

    try {
      const response = await fetch(
        `${apiUrl}/sessions/${activeSessionId}/messages/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            chatId,
            text: message,
          }),
        }
      );

      if (response.ok) {
        console.log(`[OpenWAService] OTP sent successfully to ${chatId} via session ${activeSessionId}.`);
        return true;
      } else {
        const text = await response.text();
        console.warn(`[OpenWAService] OpenWA response status ${response.status}: ${text}`);
        return false;
      }
    } catch (err: any) {
      console.warn(`[OpenWAService] Failed to send OTP via OpenWA: ${err.message}`);
      return false;
    }
  }

  /**
   * Get OpenWA Session Connection Status
   */
  static async getStatus(): Promise<{ connected: boolean; status: string; qrCode?: string }> {
    const { apiUrl, apiKey } = this.config;
    const activeSessionId = await this.getActiveSessionId();
    try {
      const response = await fetch(
        `${apiUrl}/sessions/${activeSessionId}/status`,
        {
          headers: {
            'X-API-Key': apiKey,
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        }
      );
      if (!response.ok) {
        return { connected: false, status: 'DISCONNECTED' };
      }
      const data: any = await response.json();
      return {
        connected: data?.connected || data?.status === 'ready' || data?.status === 'CONNECTED',
        status: data?.status || 'DISCONNECTED',
        qrCode: data?.qrCode,
      };
    } catch (err: any) {
      return {
        connected: false,
        status: 'DISCONNECTED',
      };
    }
  }
}
