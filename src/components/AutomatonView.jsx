import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: {
  primaryColor: '#1a1f35', primaryTextColor: '#e2e8f0', primaryBorderColor: '#6366f1',
  lineColor: '#64748b', secondaryColor: '#2a3150', tertiaryColor: '#111827',
  fontSize: '11px',
}});

export default function AutomatonView({ lrData }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!lrData || !lrData.states || lrData.states.length === 0 || !containerRef.current) return;
    renderAutomaton();
  }, [lrData]);

  const renderAutomaton = async () => {
    if (!containerRef.current) return;
    const { states, transitions } = lrData;

    // Build Mermaid flowchart definition
    let def = 'flowchart LR\n';

    // Limit display for very large automata
    const maxStates = 30;
    const limited = states.length > maxStates;
    const displayStates = limited ? states.slice(0, maxStates) : states;

    for (const s of displayStates) {
      const items = s.items.slice(0, 4).join('\\n');
      const extra = s.items.length > 4 ? `\\n... +${s.items.length - 4} more` : '';
      const label = `I${s.index}\\n${items}${extra}`.replace(/"/g, "'");
      def += `  S${s.index}["${label}"]\n`;
    }

    const displayTransitions = transitions.filter(t => t.from < maxStates && t.to < maxStates);
    for (const t of displayTransitions) {
      def += `  S${t.from} -->|"${t.symbol}"| S${t.to}\n`;
    }

    // Style the start state
    def += `  style S0 stroke:#10b981,stroke-width:3px\n`;

    try {
      const id = 'automaton-' + Date.now();
      const { svg } = await mermaid.render(id, def);
      containerRef.current.innerHTML = svg;
    } catch (e) {
      containerRef.current.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Graph Rendering Error</h3><p>${e.message}</p><p style="margin-top:.5rem;font-size:.75rem">The automaton may be too large to render visually. Check the Item Sets in the Tables tab.</p></div>`;
    }
  };

  if (!lrData || !lrData.states || lrData.states.length === 0) {
    return <div className="empty-state"><div className="icon">🔄</div><h3>No Automaton</h3><p>Analyze a grammar with an LR method to generate the state transition graph.</p></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
        <span className="badge badge-info">{lrData.states.length} states</span>
        <span className="badge badge-info">{lrData.transitions.length} transitions</span>
        {lrData.states.length > 30 && <span className="badge badge-warning">Showing first 30 states</span>}
      </div>
      <div className="automaton-container" ref={containerRef} />
    </div>
  );
}
