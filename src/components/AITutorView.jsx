import React, { useState } from 'react';
import { getAIConfig, saveAIConfig, explainParseError, analyzeConflicts, suggestLL1Transformations } from '../engines/aiTutor.js';

export function AISettingsModal({ onClose }) {
  const [config, setConfig] = useState(getAIConfig());

  const handleSave = () => { saveAIConfig(config); onClose(); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>🤖 AI Tutor Settings</h2>
        <label>Provider</label>
        <select value={config.provider} onChange={e => setConfig({ ...config, provider: e.target.value })}>
          <option value="openai">OpenAI (GPT-4o Mini)</option>
          <option value="gemini">Google Gemini</option>
          <option value="claude">Anthropic Claude</option>
        </select>
        <label>API Key</label>
        <input type="password" value={config.apiKey} onChange={e => setConfig({ ...config, apiKey: e.target.value })} placeholder="Paste your API key here..." />
        <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Your API key is stored locally in your browser's localStorage. It is never sent to any server other than the selected AI provider.</p>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={handleSave}>💾 Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AITutorView({ grammar, simulationResult, conflicts, parserMethod, lrMethod }) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = getAIConfig();
  const hasKey = config.apiKey && config.apiKey.length > 0;

  const handleRequest = async (fn) => {
    setLoading(true); setError(''); setResponse('');
    try { const r = await fn(); setResponse(r); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!hasKey) {
    return (
      <div className="empty-state">
        <div className="icon">🤖</div>
        <h3>AI Tutor — Setup Required</h3>
        <p>Add your API key in Settings (⚙️) to enable intelligent grammar analysis, error explanations, and transformation suggestions.</p>
      </div>
    );
  }

  const hasSimError = simulationResult && !simulationResult.accepted && simulationResult.error;
  const hasConflicts = conflicts && conflicts.length > 0;

  return (
    <div>
      <h3 style={{ fontSize: '.95rem', color: 'var(--accent-hover)', marginBottom: '.75rem' }}>🤖 AI Tutor — {config.provider.charAt(0).toUpperCase() + config.provider.slice(1)}</h3>
      <div className="btn-group" style={{ marginBottom: '1rem' }}>
        {hasSimError && (
          <button className="btn btn-secondary" disabled={loading} onClick={() => handleRequest(() => explainParseError(grammar, '', simulationResult.steps, simulationResult.error))}>
            🔍 Explain Parse Error
          </button>
        )}
        {hasConflicts && (
          <button className="btn btn-secondary" disabled={loading} onClick={() => handleRequest(() => analyzeConflicts(grammar, conflicts, parserMethod === 'lr' ? lrMethod : 'LL(1)'))}>
            🔧 Analyze Conflicts
          </button>
        )}
        <button className="btn btn-secondary" disabled={loading || !grammar} onClick={() => handleRequest(() => suggestLL1Transformations(grammar))}>
          🔄 Suggest LL(1) Transformations
        </button>
      </div>
      {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--text-secondary)' }}><div className="loading-spinner" /> Thinking...</div>}
      {error && <div className="conflict-banner"><h4>Error</h4><p>{error}</p></div>}
      {response && <div className="ai-response">{response}</div>}
    </div>
  );
}
