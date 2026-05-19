import React, { useRef } from 'react';
import { presetGrammars } from '../presets/grammars.js';

export default function GrammarPanel({ grammarText, setGrammarText, inputStr, setInputStr, grammarInfo, onAnalyze, onSimulate, parserMethod, setParserMethod, lrMethod, setLrMethod, onOpenSettings }) {
  const textareaRef = useRef(null);

  const insertSymbol = (sym) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = grammarText.slice(0, start) + sym + grammarText.slice(end);
    setGrammarText(newText);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + sym.length; }, 0);
  };

  const loadPreset = (preset) => {
    setGrammarText(preset.grammar);
    setInputStr(preset.testInput);
  };

  return (
    <div className="panel-left">
      <div className="panel-section">
        <h3><span className="icon">📐</span> Grammar G = (V, Σ, R, S)</h3>
        <div className="preset-chips">
          {presetGrammars.map((p, i) => (
            <button key={i} className="preset-chip" onClick={() => loadPreset(p)} title={p.description}>{p.name}</button>
          ))}
        </div>
        <textarea ref={textareaRef} className="grammar-input" value={grammarText} onChange={e => setGrammarText(e.target.value)} placeholder={"E → T E'\nE' → + T E' | ε\nT → F T'\nT' → * F T' | ε\nF → ( E ) | i"} spellCheck={false} />
        <div className="vkb">
          {['→', 'ε', '|', "'", '$', '(', ')', '+', '*'].map(s => (
            <button key={s} onClick={() => insertSymbol(s)}>{s}</button>
          ))}
        </div>
        {grammarInfo && (
          <div className="grammar-info">
            <div className="info-chip"><strong>S:</strong> {grammarInfo.startSymbol}</div>
            <div className="info-chip"><strong>V:</strong> {grammarInfo.nonTerminals.join(', ')}</div>
            <div className="info-chip"><strong>Σ:</strong> {grammarInfo.terminals.join(', ')}</div>
            <div className="info-chip"><strong>|R|:</strong> {grammarInfo.productions.length}</div>
          </div>
        )}
      </div>

      <div className="panel-section">
        <h3><span className="icon">⚙️</span> Parser Method</h3>
        <select className="method-select" value={parserMethod} onChange={e => setParserMethod(e.target.value)}>
          <optgroup label="Top-Down">
            <option value="rd">Recursive Descent</option>
            <option value="ll1">LL(1) Predictive</option>
          </optgroup>
          <optgroup label="Bottom-Up (LR Family)">
            <option value="lr">LR Parser</option>
          </optgroup>
        </select>
        {parserMethod === 'lr' && (
          <select className="method-select" style={{ marginTop: '.5rem' }} value={lrMethod} onChange={e => setLrMethod(e.target.value)}>
            <option value="lr0">LR(0)</option>
            <option value="slr1">SLR(1)</option>
            <option value="lalr1">LALR(1)</option>
            <option value="lr1">LR(1)</option>
          </select>
        )}
        <div className="btn-group">
          <button className="btn btn-primary" onClick={onAnalyze}>🔬 Analyze Grammar</button>
          <button className="btn btn-secondary" onClick={onOpenSettings}>⚙️ AI Settings</button>
        </div>
      </div>

      <div className="panel-section">
        <h3><span className="icon">🔤</span> Input String</h3>
        <input type="text" className="string-input" value={inputStr} onChange={e => setInputStr(e.target.value)} placeholder="e.g. i + i * i" />
        <div className="btn-group">
          <button className="btn btn-success" onClick={onSimulate}>▶ Parse String</button>
        </div>
      </div>
    </div>
  );
}
