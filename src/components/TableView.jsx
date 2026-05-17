import React from 'react';
import { formatProduction } from '../engines/grammar.js';

export default function TableView({ ll1Data, lrData, parserMethod }) {
  if (parserMethod === 'll1' || parserMethod === 'rd') {
    return <LL1TableView data={ll1Data} />;
  }
  return <LRTableView data={lrData} />;
}

function LL1TableView({ data }) {
  if (!data) {
    return <div className="empty-state"><div className="icon">📋</div><h3>No LL(1) Table</h3><p>Analyze a grammar to build the LL(1) parsing table.</p></div>;
  }

  const { table, conflicts, columnSymbols } = data;
  const nonTerminals = Object.keys(table);

  return (
    <div>
      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <h4>⚠️ LL(1) Conflicts Detected ({conflicts.length})</h4>
          {conflicts.map((c, i) => <p key={i}>{c.message}</p>)}
        </div>
      )}
      <h3 style={{ fontSize: '.9rem', color: 'var(--accent-hover)', marginBottom: '.5rem' }}>LL(1) Parsing Table M[A, a]</h3>
      <div className="parse-table-wrapper">
        <table className="parse-table">
          <thead>
            <tr>
              <th></th>
              {columnSymbols.map(t => <th key={t}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {nonTerminals.map(nt => (
              <tr key={nt}>
                <th>{nt}</th>
                {columnSymbols.map(t => {
                  const entries = table[nt][t];
                  const isConflict = entries && entries.length > 1;
                  const content = entries && entries.length > 0
                    ? entries.map(e => formatProduction(e.production)).join(' / ')
                    : '';
                  return <td key={t} className={isConflict ? 'conflict' : ''}>{content}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LRTableView({ data }) {
  if (!data) {
    return <div className="empty-state"><div className="icon">📋</div><h3>No LR Tables</h3><p>Analyze a grammar with an LR method to build ACTION/GOTO tables.</p></div>;
  }

  const { actionTable, gotoTable, conflicts, augGrammar, states } = data;
  if (!augGrammar) return <div className="empty-state"><div className="icon">❌</div><h3>Error</h3><p>{data.error}</p></div>;

  const terminals = [...augGrammar.terminals, '$'];
  const nonTerminals = augGrammar.nonTerminals.filter(nt => nt !== augGrammar.startSymbol);
  const stateCount = states.length;

  const formatActions = (actions) => {
    if (!actions || actions.length === 0) return '';
    return actions.map(a => {
      if (a.type === 'shift') return `s${a.state}`;
      if (a.type === 'reduce') return `r${a.prodIndex}`;
      if (a.type === 'accept') return 'acc';
      return '?';
    }).join('/');
  };

  return (
    <div>
      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <h4>⚠️ Conflicts Detected ({conflicts.length})</h4>
          {conflicts.map((c, i) => <p key={i}>{c.message}</p>)}
        </div>
      )}

      {/* Productions reference */}
      <h3 style={{ fontSize: '.9rem', color: 'var(--accent-hover)', marginBottom: '.5rem' }}>Numbered Productions</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '1rem' }}>
        {augGrammar.productions.map((p, i) => (
          <span key={i} className="info-chip" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '.25rem .55rem', fontSize: '.72rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--accent-hover)', marginRight: '.3rem' }}>{i}:</strong> {formatProduction(p)}
          </span>
        ))}
      </div>

      <h3 style={{ fontSize: '.9rem', color: 'var(--accent-hover)', marginBottom: '.5rem' }}>ACTION / GOTO Table</h3>
      <div className="parse-table-wrapper">
        <table className="parse-table">
          <thead>
            <tr>
              <th rowSpan={2}>State</th>
              <th colSpan={terminals.length} style={{ borderBottom: 'none' }}>ACTION</th>
              <th colSpan={nonTerminals.length} style={{ borderBottom: 'none' }}>GOTO</th>
            </tr>
            <tr>
              {terminals.map(t => <th key={t}>{t}</th>)}
              {nonTerminals.map(nt => <th key={nt}>{nt}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: stateCount }, (_, i) => (
              <tr key={i}>
                <th>{i}</th>
                {terminals.map(t => {
                  const actions = actionTable[i] && actionTable[i][t];
                  const isConflict = actions && actions.length > 1;
                  return <td key={t} className={isConflict ? 'conflict' : ''}>{formatActions(actions)}</td>;
                })}
                {nonTerminals.map(nt => {
                  const val = gotoTable[i] && gotoTable[i][nt];
                  return <td key={nt}>{val !== null && val !== undefined ? val : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* State items */}
      <h3 style={{ fontSize: '.9rem', color: 'var(--accent-hover)', margin: '1.5rem 0 .5rem' }}>Item Sets (Canonical Collection)</h3>
      {states.map(s => (
        <div key={s.index} className="state-card">
          <h4>I{s.index}</h4>
          {s.items.map((item, j) => <div key={j} className="item">{item}</div>)}
        </div>
      ))}
    </div>
  );
}
