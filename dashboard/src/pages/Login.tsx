import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { GithubIcon } from '../components/GithubIcon';
import { languageOptions, resolveSupportedLanguage, type SupportedLanguage } from '../i18n';
import { supabase } from '../services/supabase';
import './Login.css';

interface LoginProps {
  onLogin: (token: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const currentLang = resolveSupportedLanguage(i18n.resolvedLanguage || i18n.language);

  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
  };

  const [authMode, setAuthMode] = useState<'masterKey' | 'email'>('masterKey');
  const [apiKeyInput, setApiKeyInput] = useState('zentro_openwa_master_key_2026_secret');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (authMode === 'masterKey') {
      const keyToTest = apiKeyInput.trim() || password.trim() || email.trim();
      if (!keyToTest) {
        setError(t('login.apiKeyRequired', 'API Key is required.'));
        setIsLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: { 'X-API-Key': keyToTest },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            onLogin(keyToTest);
            setIsLoading(false);
            return;
          }
        }
        setError(t('login.invalidApiKey', 'Invalid API Master Key.'));
      } catch {
        setError(t('login.connectionError', 'Failed to connect to OpenWA server.'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError(t('login.emailPasswordRequired', 'Email and password are required.'));
      setIsLoading(false);
      return;
    }

    try {
      if (supabase) {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          setError(authError.message);
        } else if (data.session) {
          onLogin(data.session.access_token);
        }
      } else {
        setError(t('login.supabaseNotConfigured', 'Supabase is not configured. Use API Master Key login.'));
      }
    } catch {
      setError(t('login.connectionError', 'Failed to connect.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
          <span className="version-info">
            {t('login.version', {
              version: __APP_VERSION__,
              date: new Date(__BUILD_TIME__).toLocaleDateString(),
            })}
          </span>
        </div>

        <div className="login-language">
          <Languages size={18} />
          <select
            value={currentLang}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => changeLanguage(event.target.value as SupportedLanguage)}
            aria-label={t('common.language')}
          >
            {languageOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`connect-btn ${authMode === 'masterKey' ? '' : 'secondary'}`}
            style={{ flex: 1, padding: '6px 12px', fontSize: '12px', opacity: authMode === 'masterKey' ? 1 : 0.6 }}
            onClick={() => setAuthMode('masterKey')}
          >
            API Master Key
          </button>
          <button
            type="button"
            className={`connect-btn ${authMode === 'email' ? '' : 'secondary'}`}
            style={{ flex: 1, padding: '6px 12px', fontSize: '12px', opacity: authMode === 'email' ? 1 : 0.6 }}
            onClick={() => setAuthMode('email')}
          >
            Supabase Email
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {authMode === 'masterKey' ? (
            <div className="input-group">
              <label htmlFor="apiKey">API Master Key</label>
              <div className="input-wrapper">
                <input
                  id="apiKey"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKeyInput(e.target.value)}
                  placeholder="Enter API Master Key"
                  className={error ? 'error' : ''}
                />
              </div>
              {error && <span className="error-message" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{error}</span>}
            </div>
          ) : (
            <>
              <div className="input-group">
                <label htmlFor="email">{t('login.email', 'Email')}</label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder={t('login.emailPlaceholder', 'name@example.com')}
                    className={error ? 'error' : ''}
                  />
                </div>
              </div>
              
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="password">{t('login.password', 'Password')}</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder={t('login.passwordPlaceholder', 'Your password')}
                    className={error ? 'error' : ''}
                  />
                </div>
                {error && <span className="error-message" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{error}</span>}
              </div>
            </>
          )}

          <button type="submit" className="connect-btn" disabled={isLoading} style={{ marginTop: '1.5rem' }}>
            {isLoading ? t('login.connecting') : t('login.connect')}
          </button>
        </form>

        <p className="login-help">
          {t('login.help')}{' '}
          <a
            href="https://github.com/rmyndharis/OpenWA/blob/main/docs/01-project-overview.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('login.viewDocs')}
          </a>
        </p>
      </div>

      <footer className="login-footer">
        <span>{t('login.footer')}</span>
        <a
          href="https://github.com/rmyndharis/OpenWA"
          target="_blank"
          rel="noopener noreferrer"
          className="github-link"
          aria-label="GitHub"
        >
          <GithubIcon size={18} />
        </a>
      </footer>
    </div>
  );
}
