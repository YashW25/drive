import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { Plus, QrCode, RefreshCw, RotateCw, Trash2, Eye, Loader2, Play, Square, X, Search, Filter, Skull, Settings } from 'lucide-react';
import { sessionApi, type Session, type AutoRefreshConfig } from '../services/api';
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

  // Browser & WhatsApp Service Refreshment state
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshingSessionId, setRefreshingSessionId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshConfig, setRefreshConfig] = useState<AutoRefreshConfig | null>(null);
  const [modalRefreshConfig, setModalRefreshConfig] = useState<{ enabled: boolean; intervalHours: number; mode: 'sessions' | 'service' }>({
    enabled: true,
    intervalHours: 12,
    mode: 'sessions',
  });
  const [savingConfig, setSavingConfig] = useState(false);

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

  const fetchRefreshConfig = useCallback(async () => {
    try {
      const cfg = await sessionApi.getRefreshConfig();
      setRefreshConfig(cfg);
      setModalRefreshConfig({
        enabled: cfg.enabled,
        intervalHours: cfg.intervalHours,
        mode: cfg.mode,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchRefreshConfig();
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

  const handleRestart = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try {
      setRefreshingSessionId(id);
      toast.info(`Refreshing WhatsApp session "${session?.name || id}"...`);
      const updated = await sessionApi.restart(id);
      setSessions(prev => prev.map(s => (s.id === id ? updated : s)));
      toast.success(`Session "${session?.name || id}" refreshed! Reconnecting with same session ID.`);
      void fetchSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh session');
    } finally {
      setRefreshingSessionId(null);
    }
  };

  const handleRefreshAll = async (mode: 'sessions' | 'service' = 'sessions') => {
    try {
      setRefreshingAll(true);
      toast.info(
        mode === 'service'
          ? 'Initiating full WhatsApp service restart... Previous sessions will reconnect automatically.'
          : 'Refreshing all active WhatsApp sessions without changing session IDs...',
      );
      const res = await sessionApi.refreshAll(mode);
      toast.success(res.message);
      if (mode === 'service') {
        setTimeout(() => {
          window.location.reload();
        }, 4000);
      } else {
        await fetchSessions();
        await fetchRefreshConfig();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refreshment failed');
    } finally {
      setRefreshingAll(false);
      setShowRefreshModal(false);
    }
  };

  const handleSaveRefreshConfig = async () => {
    try {
      setSavingConfig(true);
      const updated = await sessionApi.updateRefreshConfig(modalRefreshConfig);
      setRefreshConfig(updated);
      toast.success('Auto-refresh schedule updated successfully!');
      setShowRefreshModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
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
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {canWrite && (
              <button
                className="btn-secondary"
                onClick={() => setShowRefreshModal(true)}
                title="Browser & WhatsApp Service Refreshment"
              >
                <RotateCw size={16} />
                <span>Refreshment</span>
              </button>
            )}
            {canWrite && (
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={18} />
                {t('sessions.newSession')}
              </button>
            )}
          </div>
        }
      />

      {refreshConfig && (
        <div className="refresh-status-banner">
          <div className="banner-info">
            <div className={`pulse-dot-indicator ${refreshConfig.enabled ? 'active' : 'inactive'}`}></div>
            <div>
              <div className="banner-title">
                WhatsApp Refreshment: <strong>{refreshConfig.enabled ? `Auto-Refresh Active (Every ${refreshConfig.intervalHours}h)` : 'Manual Refresh Mode'}</strong>
              </div>
              <div className="banner-meta">
                {refreshConfig.nextRefreshAt
                  ? `Next cycle: ${new Date(refreshConfig.nextRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Automatic schedule off'}
                {refreshConfig.lastRefreshAt && ` • Last refreshed: ${new Date(refreshConfig.lastRefreshAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                {refreshConfig.totalRefreshesDone > 0 && ` • ${refreshConfig.totalRefreshesDone} cycle(s) done`}
              </div>
            </div>
          </div>
          <div className="banner-actions">
            <button
              className="btn-refresh-pill"
              onClick={() => handleRefreshAll('sessions')}
              disabled={refreshingAll}
              title="Cleanly restarts WhatsApp connections in memory without changing session IDs or logging out"
            >
              {refreshingAll ? <Loader2 className="animate-spin" size={13} /> : <RotateCw size={13} />}
              <span>Refresh Active Sessions</span>
            </button>
            <button
              className="btn-refresh-pill secondary"
              onClick={() => setShowRefreshModal(true)}
              title="Configure schedule & refreshment mode"
            >
              <Settings size={13} />
              <span>Schedule</span>
            </button>
          </div>
        </div>
      )}

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

      {/* WhatsApp Browser & Service Refreshment Modal */}
      {showRefreshModal && (
        <div className="modal-overlay" onClick={() => setShowRefreshModal(false)}>
          <div className="modal modal-refresh" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>WhatsApp Browser & Service Refreshment</h2>
              <button className="btn-icon" onClick={() => setShowRefreshModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="refresh-modal-desc">
                When WhatsApp is used continuously for a long period, memory leaks and socket degradation
                can cause lags, stuck messages, or slow response times.
                <br /><br />
                Refreshment safely restarts the WhatsApp engine, clears socket/browser lag, and automatically
                reconnects all previously authenticated sessions with the <strong>exact same session ID and credentials</strong> (no QR scan needed).
              </p>

              <div className="refresh-action-box">
                <span className="box-title">Immediate Refreshment</span>
                <div className="refresh-buttons-row">
                  <button
                    className="btn-refresh-action"
                    onClick={() => handleRefreshAll('sessions')}
                    disabled={refreshingAll}
                  >
                    {refreshingAll ? <Loader2 className="animate-spin" size={16} /> : <RotateCw size={16} />}
                    <div className="btn-action-text">
                      <strong>Refresh Active Sessions</strong>
                      <span>Restores all active connections in memory without HTTP downtime</span>
                    </div>
                  </button>

                  <button
                    className="btn-refresh-action danger"
                    onClick={() => handleRefreshAll('service')}
                    disabled={refreshingAll}
                  >
                    {refreshingAll ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    <div className="btn-action-text">
                      <strong>Full Service Restart</strong>
                      <span>Reboots service process, clears OS & browser RAM, auto-reconnects sessions</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="refresh-action-box">
                <span className="box-title">Automatic Scheduled Refreshment</span>
                <div className="toggle-setting-row">
                  <div>
                    <strong>Periodic Maintenance Cycle</strong>
                    <p className="setting-hint">Automatically cycles WhatsApp connections at set intervals</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={modalRefreshConfig.enabled}
                      onChange={e => setModalRefreshConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                {modalRefreshConfig.enabled && (
                  <div className="schedule-form-fields">
                    <div className="form-field">
                      <label>Refresh Interval</label>
                      <select
                        value={modalRefreshConfig.intervalHours}
                        onChange={e => setModalRefreshConfig(prev => ({ ...prev, intervalHours: Number(e.target.value) }))}
                      >
                        <option value={4}>Every 4 Hours</option>
                        <option value={6}>Every 6 Hours</option>
                        <option value={12}>Every 12 Hours (Recommended)</option>
                        <option value={24}>Every 24 Hours (Daily)</option>
                        <option value={48}>Every 2 Days</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Refreshment Mode</label>
                      <select
                        value={modalRefreshConfig.mode}
                        onChange={e => setModalRefreshConfig(prev => ({ ...prev, mode: e.target.value as 'sessions' | 'service' }))}
                      >
                        <option value="sessions">Session Engine Refresh (Zero HTTP downtime)</option>
                        <option value="service">Full Service Restart (Clears all OS/RAM buffers)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRefreshModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveRefreshConfig}
                disabled={savingConfig}
              >
                {savingConfig ? <Loader2 className="animate-spin" size={16} /> : 'Save Schedule'}
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
                  <>
                    {session.status === 'ready' && (
                      <button
                        className="btn-action"
                        onClick={() => handleRestart(session.id)}
                        disabled={refreshingSessionId === session.id}
                        title="Refresh WhatsApp connection (clears lag without changing session ID)"
                      >
                        {refreshingSessionId === session.id ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <RotateCw size={16} />
                        )}
                        Refresh
                      </button>
                    )}
                    <button className="btn-action" onClick={() => handleStop(session.id)}>
                      <Square size={16} />
                      {t('sessions.actions.stop')}
                    </button>
                  </>
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
