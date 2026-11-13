import { DEFAULT_SYSTEM_PROMPT, CONVERSATION_SESSION_WINDOW_MS } from './ai.service';
import { toNeutralJid } from '../../engine/identity/wa-id';

describe('AiService logic and knowledge base', () => {
  it('includes comprehensive knowledge of Yash Warulkar and Innovara Dynamics in DEFAULT_SYSTEM_PROMPT', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('Yash Warulkar');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('Co-Founder & Chief Technology Officer (CTO)');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('Innovara Dynamics');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('SAMM');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('OpenWebVerse');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('TilesView AI');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('PeopleOS');
    expect(DEFAULT_SYSTEM_PROMPT).toContain('Marathi');
  });

  it('defines 15-minute conversation session window', () => {
    expect(CONVERSATION_SESSION_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it('correctly maps Baileys dialect to neutral JID for consistent deduplication', () => {
    expect(toNeutralJid('917588688707@s.whatsapp.net')).toBe('917588688707@c.us');
    expect(toNeutralJid('917588688707@c.us')).toBe('917588688707@c.us');
    expect(toNeutralJid('123456789@lid')).toBe('123456789@lid');
  });

  it('determines new session vs active session based on 15-minute window', () => {
    const now = Date.now();
    const activeTime = now - (10 * 60 * 1000); // 10 minutes ago -> active session
    const expiredTime = now - (16 * 60 * 1000); // 16 minutes ago -> new session

    const isActive = (now - activeTime) < CONVERSATION_SESSION_WINDOW_MS;
    const isExpired = (now - expiredTime) >= CONVERSATION_SESSION_WINDOW_MS;

    expect(isActive).toBe(true);
    expect(isExpired).toBe(true);
  });
});
