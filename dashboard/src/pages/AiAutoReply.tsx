import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Send,
  Zap,
  MessageSquare,
  Clock,
  Sliders,
  X,
  Inbox,
  RefreshCw,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import {
  aiApi,
  type AiAutoReplyRule,
  type AiTriggerType,
  type CreateAiRuleInput,
  type TestAiResult,
  type UnrepliedChatInfo,
  type ScanAndReplyResult,
} from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  useAiRulesQuery,
  useCreateAiRuleMutation,
  useUpdateAiRuleMutation,
  useDeleteAiRuleMutation,
  useSessionsQuery,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import './AiAutoReply.css';

const DEFAULT_AI_ENDPOINT = 'https://ai.innovaradynamics.in/v1/chat';
const DEFAULT_AI_KEY = 'inv_EKnXYFij82V2noa9udqJ3zA6pjqXIxvI8md_AoER838';
const DEFAULT_SYSTEM_PROMPT =
  'You are an intelligent and professional WhatsApp assistant for Innovara Dynamics / Jai Industrial Infrastructure. Reply concisely, helpfully, and politely within 1-3 sentences.';

export function AiAutoReply() {
  useDocumentTitle('AI Assistant & Auto-Reply');

  const { data: rules = [], isLoading: loadingRules } = useAiRulesQuery();
  const { data: sessions = [] } = useSessionsQuery();

  const createMutation = useCreateAiRuleMutation();
  const updateMutation = useUpdateAiRuleMutation();
  const deleteMutation = useDeleteAiRuleMutation();

  // Modals & form state
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AiAutoReplyRule | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AiAutoReplyRule | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formSessionId, setFormSessionId] = useState('*');
  const [formTriggerType, setFormTriggerType] = useState<AiTriggerType>('all');
  const [formSpecificNumbers, setFormSpecificNumbers] = useState('');
  const [formCustomKeywords, setFormCustomKeywords] = useState('');
  const [formEndpoint, setFormEndpoint] = useState(DEFAULT_AI_ENDPOINT);
  const [formApiKey, setFormApiKey] = useState(DEFAULT_AI_KEY);
  const [formSystemPrompt, setFormSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [formCooldown, setFormCooldown] = useState(10);
  const [formMaxTokens, setFormMaxTokens] = useState(150);
  const [formEnabled, setFormEnabled] = useState(true);

  // Playground state
  const [testPrompt, setTestPrompt] = useState('Hello! Can you tell me what services you offer?');
  const [testSystemPrompt, setTestSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<TestAiResult | null>(null);

  // Unreplied chats state
  const [unrepliedChats, setUnrepliedChats] = useState<UnrepliedChatInfo[]>([]);
  const [loadingUnreplied, setLoadingUnreplied] = useState(false);
  const [scanningAndReplying, setScanningAndReplying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanAndReplyResult | null>(null);
  const [selectedScanSession, setSelectedScanSession] = useState<string>('*');

  const fetchUnrepliedChats = useCallback(async () => {
    setLoadingUnreplied(true);
    try {
      const data = await aiApi.getUnrepliedChats(
        selectedScanSession === '*' ? undefined : selectedScanSession,
        48,
      );
      setUnrepliedChats(data);
    } catch (err) {
      console.error('Failed to load unreplied chats:', err);
    } finally {
      setLoadingUnreplied(false);
    }
  }, [selectedScanSession]);

  useEffect(() => {
    void fetchUnrepliedChats();
  }, [fetchUnrepliedChats]);

  const handleScanAndReply = async (dryRun = false) => {
    setScanningAndReplying(true);
    setScanResult(null);
    try {
      const res = await aiApi.scanAndReply({
        sessionId: selectedScanSession === '*' ? undefined : selectedScanSession,
        maxAgeHours: 48,
        dryRun,
      });
      setScanResult(res);
      await fetchUnrepliedChats();
    } catch (err: any) {
      console.error('Failed to scan and reply unreplied chats:', err);
    } finally {
      setScanningAndReplying(false);
    }
  };

  // Stats calculation
  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.enabled).length;
  const totalRepliesSent = rules.reduce((acc, r) => acc + (r.totalRepliesSent || 0), 0);

  const openCreateModal = () => {
    setEditingRule(null);
    setFormName('Customer Auto-Assistant');
    setFormSessionId('*');
    setFormTriggerType('all');
    setFormSpecificNumbers('');
    setFormCustomKeywords('');
    setFormEndpoint(DEFAULT_AI_ENDPOINT);
    setFormApiKey(DEFAULT_AI_KEY);
    setFormSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setFormCooldown(10);
    setFormMaxTokens(150);
    setFormEnabled(true);
    setShowModal(true);
  };

  const openEditModal = (rule: AiAutoReplyRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormSessionId(rule.sessionId || '*');
    setFormTriggerType(rule.triggerType);
    setFormSpecificNumbers(rule.specificNumbers ? rule.specificNumbers.join(', ') : '');
    setFormCustomKeywords(rule.customKeywords ? rule.customKeywords.join(', ') : '');
    setFormEndpoint(rule.aiEndpoint || DEFAULT_AI_ENDPOINT);
    setFormApiKey(rule.aiApiKey || DEFAULT_AI_KEY);
    setFormSystemPrompt(rule.systemPrompt || DEFAULT_SYSTEM_PROMPT);
    setFormCooldown(rule.cooldownSeconds ?? 10);
    setFormMaxTokens(rule.maxTokens ?? 80);
    setFormEnabled(rule.enabled);
    setShowModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const specificNumsArray = formSpecificNumbers
      .split(',')
      .map((n) => n.trim().replace(/[^0-9]/g, ''))
      .filter(Boolean);

    const keywordsArray = formCustomKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const payload: CreateAiRuleInput = {
      name: formName.trim(),
      enabled: formEnabled,
      sessionId: formSessionId,
      sessionName:
        formSessionId === '*'
          ? 'All Sessions'
          : sessions.find((s) => s.id === formSessionId)?.name || formSessionId,
      triggerType: formTriggerType,
      specificNumbers: specificNumsArray,
      customKeywords: keywordsArray,
      aiEndpoint: formEndpoint.trim() || DEFAULT_AI_ENDPOINT,
      aiApiKey: formApiKey.trim() || DEFAULT_AI_KEY,
      systemPrompt: formSystemPrompt.trim(),
      cooldownSeconds: Number(formCooldown) || 10,
      maxTokens: Number(formMaxTokens) || 80,
    };

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save AI rule:', err);
    }
  };

  const handleToggleRule = async (rule: AiAutoReplyRule) => {
    try {
      await updateMutation.mutateAsync({
        id: rule.id,
        data: { enabled: !rule.enabled },
      });
    } catch (err) {
      console.error('Failed to toggle AI rule:', err);
    }
  };

  const handleDeleteRule = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const runAiTest = async () => {
    if (!testPrompt.trim() || testingAi) return;
    setTestingAi(true);
    setTestResult(null);

    try {
      const res = await aiApi.testAi({
        endpoint: formEndpoint || DEFAULT_AI_ENDPOINT,
        apiKey: formApiKey || DEFAULT_AI_KEY,
        message: testPrompt.trim(),
        systemPrompt: testSystemPrompt.trim(),
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Failed to reach AI service',
        durationMs: 0,
      });
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <div className="ai-auto-reply-page">
      <PageHeader
        title="AI Assistant & Auto-Reply"
        subtitle="Intelligent automated WhatsApp chat replies powered by Innovara AI (ai.innovaradynamics.in)"
        actions={
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            <span>Create AI Rule</span>
          </button>
        }
      />

      {/* Top Overview Cards */}
      <div className="ai-stats-grid">
        <div className="ai-stat-card">
          <div className="stat-icon-wrapper blue">
            <Bot size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Total AI Rules</span>
            <span className="stat-value">{totalRules}</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon-wrapper green">
            <Zap size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Active Auto-Replies</span>
            <span className="stat-value">{activeRules}</span>
          </div>
        </div>

        <div className="ai-stat-card">
          <div className="stat-icon-wrapper purple">
            <MessageSquare size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Replies Sent</span>
            <span className="stat-value">{totalRepliesSent}</span>
          </div>
        </div>

        <div className="ai-stat-card engine-card">
          <div className="stat-icon-wrapper amber">
            <Sparkles size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-label">AI Engine</span>
            <div className="stat-badge-row">
              <span className="badge-online">Connected</span>
              <span className="engine-name">ai.innovaradynamics.in</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unread & Previous Day Chats Assistant */}
      <div className="unreplied-banner-card">
        <div className="unreplied-banner-header">
          <div className="unreplied-header-title">
            <div className="unreplied-icon-box">
              <Inbox size={22} />
            </div>
            <div>
              <div className="title-row">
                <h3>Unread & Previous Day Chats Assistant</h3>
                <span className={`status-pill ${unrepliedChats.length > 0 ? 'warning' : 'success'}`}>
                  {unrepliedChats.length} Unreplied Chat{unrepliedChats.length === 1 ? '' : 's'}
                </span>
              </div>
              <p>
                Automatically imports chats from previous days, detects messages awaiting your response, and auto-replies with AI.
              </p>
            </div>
          </div>

          <div className="unreplied-header-actions">
            <select
              className="session-filter-select"
              value={selectedScanSession}
              onChange={(e) => setSelectedScanSession(e.target.value)}
            >
              <option value="*">All Active Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || 'Ready'})
                </option>
              ))}
            </select>

            <button
              className="btn-secondary"
              onClick={fetchUnrepliedChats}
              disabled={loadingUnreplied}
              title="Refresh unreplied chats"
            >
              <RefreshCw size={16} className={loadingUnreplied ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              className="btn-primary highlight-btn"
              onClick={() => handleScanAndReply(false)}
              disabled={scanningAndReplying || unrepliedChats.length === 0}
            >
              {scanningAndReplying ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Auto-Replying...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Auto-Reply Unreplied Now ({unrepliedChats.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {scanResult && (
          <div className="scan-result-alert">
            <CheckCircle2 size={18} className="text-green" />
            <div className="result-text">
              <strong>Scan Complete:</strong> Found {scanResult.unrepliedFound} unreplied chat(s), dispatched{' '}
              {scanResult.repliesDispatched} AI reply(ies).
            </div>
            <button className="btn-close-sm" onClick={() => setScanResult(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {unrepliedChats.length > 0 ? (
          <div className="unreplied-chats-list">
            {unrepliedChats.map((c) => (
              <div key={`${c.sessionId}_${c.chatId}`} className="unreplied-chat-item">
                <div className="chat-avatar">
                  <MessageCircle size={20} />
                  {c.unreadCount > 0 && <span className="unread-dot">{c.unreadCount}</span>}
                </div>
                <div className="chat-content">
                  <div className="chat-meta">
                    <strong className="contact-name">{c.contactName}</strong>
                    <span className="phone-tag">+{c.senderPhone}</span>
                    <span className="session-badge">{c.sessionName}</span>
                    {c.unreadCount > 0 && (
                      <span className="unread-badge">{c.unreadCount} unread</span>
                    )}
                  </div>
                  <p className="last-message">"{c.lastMessageText}"</p>
                  <div className="chat-footer-meta">
                    <span className="rule-badge">Rule: {c.ruleName}</span>
                    {c.lastMessageTimestamp > 0 && (
                      <span className="time-badge">
                        <Clock size={12} /> {new Date(c.lastMessageTimestamp * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="unreplied-empty-state">
            <CheckCircle2 size={24} className="text-green" />
            <span>All incoming customer chats are up to date! No unreplied messages found from the previous days.</span>
          </div>
        )}
      </div>

      <div className="ai-content-layout">
        {/* Left Column: Rules List */}
        <div className="ai-rules-container">
          <div className="rules-section-header">
            <div>
              <h2>Auto-Reply Rules</h2>
              <p className="section-desc">Manage message triggers, target numbers, and AI personalities.</p>
            </div>
          </div>

          {loadingRules ? (
            <div className="loading-state">
              <Loader2 className="spinner" size={32} />
              <p>Loading AI rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="empty-rules-state">
              <Bot size={48} className="empty-icon" />
              <h3>No AI Auto-Reply Rules Configured</h3>
              <p>
                Set up an AI assistant to automatically monitor incoming chats and reply with intelligent answers
                generated by Innovara AI.
              </p>
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={18} />
                <span>Create Your First Rule</span>
              </button>
            </div>
          ) : (
            <div className="ai-rules-list">
              {rules.map((rule) => (
                <div key={rule.id} className={`ai-rule-card ${rule.enabled ? 'active' : 'inactive'}`}>
                  <div className="rule-card-header">
                    <div className="rule-title-group">
                      <div className="rule-icon-box">
                        <Bot size={20} />
                      </div>
                      <div>
                        <div className="rule-name-row">
                          <h3 className="rule-name">{rule.name}</h3>
                          <span className={`status-badge ${rule.enabled ? 'enabled' : 'disabled'}`}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <div className="rule-meta">
                          <span className="meta-item">
                            <strong>Session:</strong>{' '}
                            {rule.sessionId === '*' ? 'All Active Sessions (*)' : rule.sessionName || rule.sessionId}
                          </span>
                          <span className="meta-separator">•</span>
                          <span className="meta-item">
                            <strong>Trigger:</strong>{' '}
                            {rule.triggerType === 'all' && 'All incoming chats'}
                            {rule.triggerType === 'unknown_only' && 'Non-contacts / Unknown numbers only'}
                            {rule.triggerType === 'specific' && `Specific (${rule.specificNumbers?.length || 0} numbers)`}
                            {rule.triggerType === 'custom_keyword' && `Keywords (${rule.customKeywords?.length || 0})`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rule-actions">
                      <label className="toggle-switch" title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule)}
                        />
                        <span className="slider"></span>
                      </label>
                      <button
                        className="btn-icon"
                        title="Edit Rule"
                        onClick={() => openEditModal(rule)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon danger"
                        title="Delete Rule"
                        onClick={() => setConfirmDelete(rule)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Rule details badge pills */}
                  <div className="rule-card-body">
                    {rule.triggerType === 'specific' && rule.specificNumbers?.length > 0 && (
                      <div className="filter-chips">
                        <span className="chip-label">Target Numbers:</span>
                        {rule.specificNumbers.map((num, i) => (
                          <span key={i} className="filter-chip">
                            +{num}
                          </span>
                        ))}
                      </div>
                    )}

                    {rule.triggerType === 'custom_keyword' && rule.customKeywords?.length > 0 && (
                      <div className="filter-chips">
                        <span className="chip-label">Trigger Keywords:</span>
                        {rule.customKeywords.map((kw, i) => (
                          <span key={i} className="filter-chip keyword">
                            "{kw}"
                          </span>
                        ))}
                      </div>
                    )}

                    {rule.systemPrompt && (
                      <div className="prompt-preview">
                        <span className="preview-label">Prompt Persona:</span>
                        <p className="preview-text">"{rule.systemPrompt}"</p>
                      </div>
                    )}

                    <div className="rule-card-footer">
                      <div className="footer-details">
                        <span title="Cooldown per sender">
                          <Clock size={13} /> Cooldown: {rule.cooldownSeconds || 10}s
                        </span>
                        <span title="Max generated tokens">
                          <Sliders size={13} /> Max Tokens: {rule.maxTokens || 80}
                        </span>
                      </div>
                      <div className="footer-stats">
                        <span className="replies-count">
                          <strong>{rule.totalRepliesSent || 0}</strong> replies dispatched
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Live AI Tester */}
        <div className="ai-playground-container">
          <div className="playground-card">
            <div className="playground-header">
              <div className="header-title-box">
                <Sparkles size={20} className="sparkle-icon" />
                <div>
                  <h3>Live AI Playground</h3>
                  <p>Test real-time responses from Innovara AI</p>
                </div>
              </div>
              <span className="connection-pill">
                <span className="pulse-dot"></span> Online
              </span>
            </div>

            <div className="playground-body">
              <div className="playground-group">
                <label className="field-label">AI Service Endpoint</label>
                <div className="endpoint-readonly">
                  <code>https://ai.innovaradynamics.in/v1/chat</code>
                </div>
              </div>

              <div className="playground-group">
                <label className="field-label">System Persona / Instructions</label>
                <textarea
                  className="playground-textarea small"
                  rows={2}
                  value={testSystemPrompt}
                  onChange={(e) => setTestSystemPrompt(e.target.value)}
                  placeholder="System instructions for the AI..."
                />
              </div>

              <div className="playground-group">
                <label className="field-label">Incoming User Message</label>
                <textarea
                  className="playground-textarea"
                  rows={3}
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Enter message to simulate WhatsApp chat..."
                />
              </div>

              <button
                className="btn-primary full-width"
                onClick={runAiTest}
                disabled={testingAi || !testPrompt.trim()}
              >
                {testingAi ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>Querying Innovara AI...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Test Query</span>
                  </>
                )}
              </button>

              {testResult && (
                <div className={`test-result-box ${testResult.success ? 'success' : 'error'}`}>
                  <div className="result-header">
                    <span className="result-title">
                      {testResult.success ? (
                        <>
                          <Check size={16} className="text-success" /> Generated Reply
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} className="text-danger" /> Request Failed
                        </>
                      )}
                    </span>
                    {testResult.durationMs > 0 && (
                      <span className="latency-badge">{testResult.durationMs}ms</span>
                    )}
                  </div>

                  {testResult.success ? (
                    <div className="result-content">
                      <p className="response-text">{testResult.response}</p>
                    </div>
                  ) : (
                    <div className="result-error">
                      <p>{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingRule ? 'Edit AI Auto-Reply Rule' : 'Create AI Auto-Reply Rule'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              <div className="modal-body">
                {/* Rule Name */}
                <div className="form-group">
                  <label>Rule Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales & Inquiry Assistant"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                {/* Target Session Selection */}
                <div className="form-group">
                  <label>Monitored WhatsApp Session *</label>
                  <select
                    value={formSessionId}
                    onChange={(e) => setFormSessionId(e.target.value)}
                  >
                    <option value="*">All Active WhatsApp Sessions (*)</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone ? `+${s.phone}` : s.status})
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">
                    Choose which WhatsApp number or session will use this AI reply rule.
                  </span>
                </div>

                {/* Trigger Condition Selection */}
                <div className="form-group">
                  <label>Auto-Reply Filter / Trigger Rules *</label>
                  <div className="trigger-type-grid">
                    <label
                      className={`trigger-option-card ${
                        formTriggerType === 'all' ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value="all"
                        checked={formTriggerType === 'all'}
                        onChange={() => setFormTriggerType('all')}
                      />
                      <div className="option-content">
                        <strong>All Numbers</strong>
                        <span>Reply automatically to any incoming personal message</span>
                      </div>
                    </label>

                    <label
                      className={`trigger-option-card ${
                        formTriggerType === 'unknown_only' ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value="unknown_only"
                        checked={formTriggerType === 'unknown_only'}
                        onChange={() => setFormTriggerType('unknown_only')}
                      />
                      <div className="option-content">
                        <strong>Non-Contacts Only</strong>
                        <span>Only reply to new or unsaved phone numbers</span>
                      </div>
                    </label>

                    <label
                      className={`trigger-option-card ${
                        formTriggerType === 'specific' ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value="specific"
                        checked={formTriggerType === 'specific'}
                        onChange={() => setFormTriggerType('specific')}
                      />
                      <div className="option-content">
                        <strong>Specific Numbers</strong>
                        <span>Only reply to selected phone numbers / whitelist</span>
                      </div>
                    </label>

                    <label
                      className={`trigger-option-card ${
                        formTriggerType === 'custom_keyword' ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="triggerType"
                        value="custom_keyword"
                        checked={formTriggerType === 'custom_keyword'}
                        onChange={() => setFormTriggerType('custom_keyword')}
                      />
                      <div className="option-content">
                        <strong>Keyword Match</strong>
                        <span>Only reply when message contains specific trigger words</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Conditional Specific Numbers */}
                {formTriggerType === 'specific' && (
                  <div className="form-group highlight-box">
                    <label>Specific Numbers (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. 919561485909, 917588688707"
                      value={formSpecificNumbers}
                      onChange={(e) => setFormSpecificNumbers(e.target.value)}
                    />
                    <span className="form-hint">
                      Enter phone numbers with country code, separated by commas.
                    </span>
                  </div>
                )}

                {/* Conditional Keywords */}
                {formTriggerType === 'custom_keyword' && (
                  <div className="form-group highlight-box">
                    <label>Trigger Keywords (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. price, catalog, quotation, help, banana powder"
                      value={formCustomKeywords}
                      onChange={(e) => setFormCustomKeywords(e.target.value)}
                    />
                    <span className="form-hint">
                      The AI will only reply if the incoming message contains at least one of these keywords.
                    </span>
                  </div>
                )}

                {/* AI Configuration Section */}
                <div className="form-section-divider">
                  <span>AI Engine Connection</span>
                </div>

                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>AI API Endpoint</label>
                    <input
                      type="url"
                      required
                      value={formEndpoint}
                      onChange={(e) => setFormEndpoint(e.target.value)}
                      placeholder="https://ai.innovaradynamics.in/v1/chat"
                    />
                  </div>

                  <div className="form-group flex-2">
                    <label>AI API Key</label>
                    <input
                      type="password"
                      value={formApiKey}
                      onChange={(e) => setFormApiKey(e.target.value)}
                      placeholder="inv_..."
                    />
                  </div>
                </div>

                {/* System Prompt / Persona */}
                <div className="form-group">
                  <label>System Persona & Business Context</label>
                  <textarea
                    rows={4}
                    value={formSystemPrompt}
                    onChange={(e) => setFormSystemPrompt(e.target.value)}
                    placeholder="Define how the AI should talk, what company information it has, and constraints..."
                  />
                  <span className="form-hint">
                    Give instructions to the AI regarding tone, business offerings, pricing policy, etc.
                  </span>
                </div>

                {/* Cooldown & Max Tokens */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Cooldown Delay (Seconds)</label>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={formCooldown}
                      onChange={(e) => setFormCooldown(Number(e.target.value))}
                    />
                    <span className="form-hint">
                      Time to wait before auto-replying again to the same contact.
                    </span>
                  </div>

                  <div className="form-group">
                    <label>Max Response Tokens</label>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={formMaxTokens}
                      onChange={(e) => setFormMaxTokens(Number(e.target.value))}
                    />
                    <span className="form-hint">
                      Length limit for the generated WhatsApp reply (~150 tokens = 2-3 sentences).
                    </span>
                  </div>
                </div>

                {/* Enabled Toggle */}
                <div className="form-group toggle-row">
                  <div>
                    <strong>Enable this rule immediately</strong>
                    <p className="form-hint">Rule starts monitoring incoming WhatsApp chats right away.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={formEnabled}
                      onChange={(e) => setFormEnabled(e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingRule ? 'Update Rule' : 'Create Rule'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="btn-icon" onClick={() => setConfirmDelete(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete AI rule <strong>"{confirmDelete.name}"</strong>? This will
                stop auto-replying to matching messages immediately.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteRule}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AiAutoReply;
