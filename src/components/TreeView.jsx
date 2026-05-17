import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function TreeView({ parseTree, ast, showAST }) {
  const svgRef = useRef(null);
  const tree = showAST ? ast : parseTree;

  useEffect(() => {
    if (!tree || !svgRef.current) return;
    renderTree(svgRef.current, tree);
  }, [tree, showAST]);

  if (!tree) {
    return <div className="empty-state"><div className="icon">🌳</div><h3>No Parse Tree</h3><p>Successfully parse a string to see its derivation tree.</p></div>;
  }

  return (
    <div className="tree-container">
      <svg ref={svgRef} />
    </div>
  );
}

function renderTree(svgEl, data) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  // Convert our tree format to d3 hierarchy
  const root = d3.hierarchy(data, d => d.children);
  const treeLayout = d3.tree().nodeSize([50, 80]);
  treeLayout(root);

  // Compute bounds
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  root.each(d => {
    if (d.x < x0) x0 = d.x;
    if (d.x > x1) x1 = d.x;
    if (d.y < y0) y0 = d.y;
    if (d.y > y1) y1 = d.y;
  });

  const width = x1 - x0 + 120;
  const height = y1 - y0 + 120;
  svg.attr('width', width).attr('height', height).attr('viewBox', `${x0 - 60} ${y0 - 60} ${width} ${height}`);

  const g = svg.append('g');

  // Draw links
  g.selectAll('.link')
    .data(root.links())
    .join('path')
    .attr('class', 'link')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr('fill', 'none')
    .attr('stroke', '#2a3150')
    .attr('stroke-width', 1.5);

  // Draw nodes
  const nodes = g.selectAll('.node')
    .data(root.descendants())
    .join('g')
    .attr('class', d => `node ${d.data.terminal ? 'terminal' : ''}`)
    .attr('transform', d => `translate(${d.x},${d.y})`);

  nodes.append('circle')
    .attr('r', 18)
    .attr('fill', d => d.data.terminal ? '#6366f1' : '#1a1f35')
    .attr('stroke', d => d.data.terminal ? '#818cf8' : '#6366f1')
    .attr('stroke-width', 2);

  nodes.append('text')
    .attr('dy', '.35em')
    .attr('text-anchor', 'middle')
    .attr('fill', d => d.data.terminal ? '#fff' : '#e2e8f0')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-size', '11px')
    .attr('font-weight', d => d.data.terminal ? '700' : '400')
    .text(d => d.data.symbol);
}
