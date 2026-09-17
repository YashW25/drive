import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { Plus, QrCode, RefreshCw, Trash2, Eye, Loader2, Play, Square, X, Search, Filter, Skull, Smartphone } from 'lucide-react';
import { sessionApi, type Session } from '../services/api';
import { queryKeys } from '../hooks/queries';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { useWebSocket } from '../hooks/useWebSocket';
import { useRole } from '../hooks/useRole';
import { PageHeader } from '../components/PageHeader';
import './Sessions.css';

export function Sessions() {
  const { t } = useTranslation();
  useDocumentTitle(t('sessions.title'));
  const toast = useToast();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrData, setQrData] = useState<{ sessionId: string; sessionName: string; qrCode: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [killConfirmId, setKillConfirmId] = useState<string | null>(null);

  // Pairing Code state (Link via Phone Number instead of QR)
  const [pairingModalSessionId, setPairingModalSessionId] = useState<string | null>(null);
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [requestingPairing, setRequestingPairing] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (): Promise<Session[]> => {
    try {
      setLoading(true);
      const data = await sessionApi.list();
      setSessions(data);
      // Keep the shared React Query cache (read by the Dashboard via useSessionsQuery /
      // useSessionStatsQuery) in sync after this page's mutations reload local state — otherwise the
      // Dashboard shows stale session counts/status. This runs on every reload (mount / WS-failed /
      // mutation), which is harmless: the Sessions page holds no active observer on a ['sessions', …]
      // query, so invalidation only marks the shared cache stale (no refetch here, no loop) and the
      // Dashboard/other views refetch lazily on next mount. Prefix-matches every session-scoped key
      // (sessions, sessionStats, per-session groups/chats/templates).
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sessions.create.errorDefault'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [t, queryClient]);

  const { isConnected, subscribe } = useWebSocket({
    onSessionStatus: useCallback(
      (event: { sessionId: string; status: string }) => {
        setSessions(prev =>
          prev.map(s => (s.id === event.sessionId ? { ...s, status: event.status as Session['status'] } : s)),
        );
        if (event.status === 'ready') {
          toast.success(t('sessions.toasts.readyTitle'), t('sessions.toasts.readyDesc'));
        } else if (event.status === 'disconnected') {
          toast.warning(t('sessions.toasts.disconnectedTitle'), t('sessions.toasts.disconnectedDesc'));
        } else if (event.status === 'failed') {
          // Refresh so the card picks up the lastError reason from the API.
          void fetchSessions();
          toast.error(t('sessions.toasts.failedTitle'), t('sessions.toasts.failedDesc'));
        }
      },
      [toast, t, fetchSessions],
    ),
  });

  // The gateway delivers events only to subscribed rooms; join the wildcard
  // session.status room so status changes for every session are received live.
  useEffect(() => {
    if (isConnected) {
      subscribe('*', ['session.status', 'session.qr']);
    }
  }, [isConnected, subscribe]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const qrRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionName = useRef<string>('');

  const fetchQR = useCallback(async (sessionId: string) => {
    // Guard: if session is already connected, stop polling immediately.
    const currentSession = sessions.find(s => s.id === sessionId);
    if (currentSession?.status === 'ready') {
      setQrData(null);
      currentSessionName.current = '';
      return;
    }
    try {
      const qr = await sessionApi.getQR(sessionId);
      setQrData({ sessionId, sessionName: currentSessionName.current, qrCode: qr.qrCode });
      if (qr.status === 'ready') {
        setQrData(null);
        currentSessionName.current = '';
        fetchSessions();
      }
    } catch {
      // Keep qrData alive so the polling interval keeps retrying until the QR
      // is ready. Only stop polling if the session itself has failed.
      const updated = await sessionApi.get(sessionId).catch(() => null);
      const stillInitializing = updated &&
        ['initializing', 'connecting', 'qr_ready'].includes(updated.status);
      if (!stillInitializing) {
        setQrData(null);
        currentSessionName.current = '';
        fetchSessions();
      }
    }
  }, [sessions]);

  useEffect(() => {
    if (qrData) {
      currentSessionName.current = qrData.sessionName;
      qrRefreshInterval.current = setInterval(() => {
        fetchQR(qrData.sessionId);
      }, 5000);
    }
    return () => {
      if (qrRefreshInterval.current) clearInterval(qrRefreshInterval.current);
    };
  }, [qrData, fetchQR]);

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingModalSessionId || !pairingPhoneInput.trim()) return;
    setRequestingPairing(true);
    setPairingError(null);
    try {
      const cleanPhone = pairingPhoneInput.replace(/[^0-9]/g, '');
      const res = await sessionApi.requestPairingCode(pairingModalSessionId, cleanPhone);
      setPairingCodeResult(res.pairingCode);
      toast.success('Pairing Code Generated!', 'Enter this 8-character code in WhatsApp under "Link with phone number instead".');
    } catch (err: any) {
      setPairingError(err.message || 'Failed to request pairing code');
      toast.error('Pairing Code Error', err.message || 'Failed to request pairing code');
    } finally {
      setRequestingPairing(false);
    }
  };

  const handleCreate = async () => {
    if (!newSessionName.trim()) return;
    try {
      setCreating(true);
      const newSession = await sessionApi.create(newSessionName);
      setSessions([...sessions, newSession]);
      setNewSessionName('');
      setShowCreateModal(false);
      toast.success(t('sessions.create.successTitle'), t('sessions.create.successDesc', { name: newSession.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.create.errorDefault');
      setError(msg);
      toast.error(t('sessions.create.errorTitle'), msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try {
      await sessionApi.delete(id);
      setSessions(sessions.filter(s => s.id !== id));
      toast.success(
        t('sessions.delete.successTitle'),
        session ? t('sessions.delete.successDescNamed', { name: session.name }) : t('sessions.delete.successDescGeneric'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.delete.errorDefault');
      console.error('Failed to delete:', err);
      toast.error(t('sessions.delete.errorTitle'), msg);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStart = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session && ['initializing', 'connecting', 'qr_ready'].includes(session.status)) {
      handleShowQR(id);
      return;
    }

    try {
      await sessionApi.start(id);
      setSessions(sessions.map(s => (s.id === id ? { ...s, status: 'connecting' } : s)));
      await fetchSessions();
      handleShowQR(id);
    } catch (err) {
      console.error('Failed to start:', err);
      const fresh = await fetchSessions();
      const current = fresh.find(s => s.id === id);
      if (current?.status !== 'ready') handleShowQR(id);
    }
  };

  const handleShowQR = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    // Nothing to show for an already-connected session.
    if (session?.status === 'ready') return;
    const sessionName = session?.name || '';
    // Show loading state immediately so the modal opens and polling starts
    // even before Chromium has finished initializing.
    setQrData({ sessionId: id, sessionName, qrCode: '' });
    currentSessionName.current = sessionName;
    try {
      const qr = await sessionApi.getQR(id);
      setQrData({ sessionId: id, sessionName, qrCode: qr.qrCode });
    } catch (err) {
      console.error('Failed to get QR:', err);
      // Do not clear qrData here — keep the loading modal open so the
      // polling interval (every 5 s) retries until the QR becomes available.
    }
  };

  const handleStop = async (id: string) => {
    try {
      await sessionApi.stop(id);
      setSessions(sessions.map(s => (s.id === id ? { ...s, status: 'disconnected' } : s)));
      if (qrData?.sessionId === id) setQrData(null);
    } catch (err) {
      console.error('Failed to stop:', err);
      fetchSessions();
    }
  };

  const handleForceKill = async (id: string) => {
    try {
      await sessionApi.forceKill(id);
      setSessions(sessions.map(s => (s.id === id ? { ...s, status: 'disconnected' } : s)));
      toast.success(t('sessions.forceKill.successTitle'), t('sessions.forceKill.success'));
    } catch (err) {
      console.error('Failed to force-kill:', err);
      toast.error(t('sessions.forceKill.failedTitle'), t('sessions.forceKill.failed'));
      fetchSessions();
    } finally {
      setKillConfirmId(null);
    }
  };

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const filteredSessions = sessions.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'ready') ||
      (statusFilter === 'inactive' && ['created', 'idle', 'disconnected'].includes(s.status)) ||
      (statusFilter === 'connecting' && ['initializing', 'connecting', 'qr_ready'].includes(s.status));
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div
        className="sessions-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="sessions-page">
      <PageHeader
        title={t('sessions.title')}
        subtitle={t('sessions.subtitle')}
        actions={
          canWrite && (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              {t('sessions.newSession')}
            </button>
          )
        }
      />

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('sessions.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{t('sessions.filter.all')}</option>
            <option value="active">{t('sessions.filter.active')}</option>
            <option value="inactive">{t('sessions.filter.inactive')}</option>
            <option value="connecting">{t('sessions.filter.connecting')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            padding: '1rem',
            borderRadius: '8px',
            color: '#DC2626',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.create.title')}</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>{t('sessions.create.label')}</label>
              <input
                type="text"
                placeholder={t('sessions.create.placeholder')}
                value={newSessionName}
                onChange={e => {
                  const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
                  setNewSessionName(value);
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <p className="input-hint">
                <Trans i18nKey="sessions.create.hint" components={{ code: <code /> }} />
              </p>
              {newSessionName && !/^[a-z0-9-]+$/.test(newSessionName) && (
                <p className="input-error">{t('sessions.create.invalidChars')}</p>
              )}
              {newSessionName && newSessionName.length > 50 && (
                <p className="input-error">{t('sessions.create.tooLong', { length: newSessionName.length })}</p>
              )}
              {newSessionName &&
                /^[a-z0-9-]+$/.test(newSessionName) &&
                newSessionName.length <= 50 &&
                sessions.some(s => s.name === newSessionName) && (
                  <p className="input-error">{t('sessions.create.duplicate')}</p>
                )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={
                  creating ||
                  !newSessionName.trim() ||
                  !/^[a-z0-9-]+$/.test(newSessionName) ||
                  newSessionName.length > 50 ||
                  sessions.some(s => s.name === newSessionName)
                }
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrData && (
        <div className="modal-overlay" onClick={() => setQrData(null)}>
          <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>{t('sessions.qr.title')}</h2>
                <span className="session-name">{qrData.sessionName}</span>
              </div>
              <button className="btn-close" onClick={() => setQrData(null)} aria-label={t('common.close')}>
                <X size={20} color="#64748b" />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {qrData.qrCode ? (
                <>
                  <img src={qrData.qrCode} alt="QR" style={{ maxWidth: '280px', borderRadius: '12px' }} />
                  <div className="qr-instructions">
                    <p className="qr-step"><Trans i18nKey="sessions.qr.step1" components={{ strong: <strong /> }} /></p>
                    <p className="qr-step"><Trans i18nKey="sessions.qr.step2" components={{ strong: <strong /> }} /></p>
                    <p className="qr-step"><Trans i18nKey="sessions.qr.step3" components={{ strong: <strong /> }} /></p>
                  </div>
                  <p className="qr-auto-refresh">
                    <RefreshCw size={14} className="spin-slow" /> {t('sessions.qr.autoRefresh')}
                  </p>
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPairingModalSessionId(qrData.sessionId);
                        setPairingPhoneInput('+919561485909');
                        setPairingCodeResult(null);
                        setPairingError(null);
                        setQrData(null);
                      }}
                      style={{ fontSize: '13px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Smartphone size={16} /> Link with Phone Number (Pairing Code OTP) instead
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem' }}>
                  <Loader2 className="animate-spin" size={48} />
                  <p>{t('sessions.qr.generating')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.details.title')}</h2>
              <button className="btn-icon" onClick={() => setSelectedSession(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.name')}</span>
                  <span className="detail-value">{selectedSession.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.status')}</span>
                  <span className={`status-badge ${selectedSession.status}`}>{formatStatus(selectedSession.status)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.sessionId')}</span>
                  <span className="detail-value mono">{selectedSession.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.phone')}</span>
                  <span className="detail-value">{selectedSession.phone || t('sessions.details.phoneNone')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.created')}</span>
                  <span className="detail-value">{new Date(selectedSession.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.lastActive')}</span>
                  <span className="detail-value">
                    {selectedSession.lastActive ? new Date(selectedSession.lastActive).toLocaleString() : t('common.never')}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSession(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.delete.title')}</h2>
              <button className="btn-icon" onClick={() => setDeleteConfirmId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <Trans
                  i18nKey="sessions.delete.message"
                  values={{ name: sessions.find(s => s.id === deleteConfirmId)?.name }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <p className="text-muted">{t('sessions.delete.warning')}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {killConfirmId && (
        <div className="modal-overlay" onClick={() => setKillConfirmId(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.forceKill.title')}</h2>
              <button className="btn-icon" onClick={() => setKillConfirmId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <Trans
                  i18nKey="sessions.forceKill.message"
                  values={{ name: sessions.find(s => s.id === killConfirmId)?.name }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <p className="text-muted">{t('sessions.forceKill.warning')}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setKillConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => handleForceKill(killConfirmId)}>
                {t('sessions.forceKill.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pairingModalSessionId && (
        <div className="modal-overlay" onClick={() => setPairingModalSessionId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Link via Phone Number (Pairing Code OTP)</h2>
              <button className="btn-icon" onClick={() => setPairingModalSessionId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <Smartphone size={44} style={{ margin: '0 auto 8px auto', color: '#38bdf8' }} />
                <p className="text-muted" style={{ fontSize: '13px' }}>
                  Get an 8-character OTP code to link WhatsApp directly without scanning the QR code.
                </p>
              </div>

              {pairingError && (
                <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
                  {pairingError}
                </div>
              )}

              {pairingCodeResult ? (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>WhatsApp Pairing Code:</p>
                  <div style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '6px', color: '#38bdf8', fontFamily: 'monospace', margin: '8px 0' }}>
                    {pairingCodeResult}
                  </div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '16px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '10px', lineHeight: '1.6' }}>
                    <p style={{ marginBottom: '4px' }}>📱 <strong>How to enter in WhatsApp:</strong></p>
                    <p>1. Open WhatsApp on your phone.</p>
                    <p>2. Tap <strong>Menu (⋮) / Settings → Linked Devices</strong>.</p>
                    <p>3. Tap <strong>Link a Device</strong>.</p>
                    <p>4. At bottom, tap <strong>"Link with phone number instead"</strong>.</p>
                    <p>5. Enter this code: <strong style={{ color: '#38bdf8', fontSize: '14px' }}>{pairingCodeResult}</strong>.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode}>
                  <div className="input-group">
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px', display: 'block' }}>
                      WhatsApp Phone Number (with Country Code)
                    </label>
                    <input
                      type="text"
                      value={pairingPhoneInput}
                      onChange={e => setPairingPhoneInput(e.target.value)}
                      placeholder="+919561485909"
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={requestingPairing || !pairingPhoneInput.trim()}
                    style={{ width: '100%', marginTop: '16px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
                  >
                    {requestingPairing ? <Loader2 className="animate-spin" size={18} /> : 'Get 8-Digit Pairing Code'}
                  </button>
                </form>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPairingModalSessionId(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sessions-grid">
        {filteredSessions.length === 0 ? (
          <div className="empty-state">
            <QrCode size={48} />
            <h3>{t('sessions.empty.title')}</h3>
            <p>{t('sessions.empty.description')}</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <div key={session.id} className="session-card">
              <div className="card-header">
                <h3 title={session.name}>{session.name}</h3>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
              </div>

              {session.status === 'initializing' || session.status === 'connecting' || session.status === 'qr_ready' ? (
                <div className="qr-placeholder">
                  <QrCode size={80} className="qr-icon" />
                  <p>{session.status === 'qr_ready' ? t('sessions.qr.scanToConnect') : t('sessions.qr.preparing')}</p>
                  <button
                    className="btn-sm"
                    onClick={() => handleShowQR(session.id)}
                    disabled={session.status !== 'qr_ready'}
                  >
                    {session.status === 'qr_ready' ? t('sessions.qr.showQr') : t('sessions.qr.loading')}
                  </button>
                </div>
              ) : (
                <div className="session-info">
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.phone')}</span>
                    <span className="info-value">{session.phone || '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.sessionId')}</span>
                    <span className="info-value mono">{session.id.substring(0, 12)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.lastActive')}</span>
                    <span className="info-value">{formatLastActive(session.lastActive)}</span>
                  </div>
                  {session.status === 'failed' && session.lastError ? (
                    <div className="info-row session-error">
                      <span className="info-label">{t('sessions.card.error')}</span>
                      <span className="info-value error-text" title={session.lastError}>
                        {session.lastError}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="card-actions">
                <button className="btn-action" onClick={() => setSelectedSession(session)}>
                  <Eye size={16} />
                  {t('sessions.actions.view')}
                </button>
                {canWrite &&
                (session.status === 'created' || session.status === 'idle' || session.status === 'disconnected') ? (
                  <button className="btn-action" onClick={() => handleStart(session.id)}>
                    <Play size={16} />
                    {t('sessions.actions.start')}
                  </button>
                ) : canWrite && ['ready', 'initializing', 'connecting', 'qr_ready'].includes(session.status) ? (
                  <button className="btn-action" onClick={() => handleStop(session.id)}>
                    <Square size={16} />
                    {t('sessions.actions.stop')}
                  </button>
                ) : canWrite ? (
                  <button className="btn-action" onClick={() => handleStart(session.id)}>
                    <RefreshCw size={16} />
                    {t('sessions.actions.reconnect')}
                  </button>
                ) : null}
                {canWrite && (
                  <button className="btn-action danger" onClick={() => setDeleteConfirmId(session.id)}>
                    <Trash2 size={16} />
                    {t('sessions.actions.delete')}
                  </button>
                )}
                {canWrite && session.status === 'failed' && (
                  <button className="btn-action danger" onClick={() => setKillConfirmId(session.id)}>
                    <Skull size={16} />
                    {t('sessions.actions.killStuck')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
