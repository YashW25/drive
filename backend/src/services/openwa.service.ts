export class OpenWAService {
  private static get config() {
    const apiUrl = process.env.OPENWA_API_URL || 'https://drive-2gz4.onrender.com';
    const sessionId = process.env.OPENWA_SESSION_ID || 'default';
    const apiKey = process.env.OPENWA_API_KEY || 'zentro_openwa_master_key_2026_secret';
    return { apiUrl, sessionId, apiKey };
  }

  /**
   * Send WhatsApp OTP message via OpenWA
   */
  static async sendOtp(phoneNumber: string, code: string): Promise<boolean> {
    const { apiUrl, sessionId, apiKey } = this.config;
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;
    const message = `Your Zentro Drive verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;

    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, '')}/sessions/${sessionId}/messages/send-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            chatId,
            text: message,
          }),
        }
      );

      if (response.ok) {
        console.log(`[OpenWAService] OTP sent successfully to ${chatId}.`);
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
    const { apiUrl, sessionId, apiKey } = this.config;
    try {
      const response = await fetch(
        `${apiUrl.replace(/\/$/, '')}/sessions/${sessionId}/status`,
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        }
      );
      if (!response.ok) {
        return { connected: false, status: 'DISCONNECTED' };
      }
      const data: any = await response.json();
      return {
        connected: data?.connected || data?.status === 'CONNECTED',
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
