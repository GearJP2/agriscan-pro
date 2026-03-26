import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { networkData, TOXIN_COLORS } from '@/data/mockDashboardData';

// D3 force-directed network graph rendered inside React via useRef + useEffect.
// We let D3 own the SVG DOM entirely to avoid React/D3 conflicts.

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  frequency: number;
  color: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number;
}

export default function CoOccurrenceNetwork() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svgRef.current?.parentElement;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight || 280;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Deep clone data so D3 mutations don't affect source
    const nodes: SimNode[] = networkData.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = networkData.links.map((l) => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }));

    const maxLinkValue = Math.max(...links.map((l) => l.value));
    const linkScale = d3.scaleLinear().domain([0, maxLinkValue]).range([2, 10]);
    const nodeScale = d3.scaleLinear().domain([20, 100]).range([18, 38]);

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => nodeScale(d.frequency) + 5));

    // Links
    const link = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => linkScale(d.value));

    // Node groups
    const node = svg
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Circles
    node
      .append('circle')
      .attr('r', (d) => nodeScale(d.frequency))
      .attr('fill', (d) => d.color)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 2)
      .attr('opacity', 0.85)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fbbf24');
        // Find connected links
        const connected = links.filter(
          (l) =>
            (l.source as SimNode).id === d.id || (l.target as SimNode).id === d.id
        );
        const info = connected
          .map((l) => {
            const other =
              (l.source as SimNode).id === d.id
                ? (l.target as SimNode).id
                : (l.source as SimNode).id;
            return `${d.id}–${other}: ${l.value} samples`;
          })
          .join('\n');
        setTooltip({
          x: event.offsetX,
          y: event.offsetY,
          text: `${d.id} (freq: ${d.frequency}%)\n${info}`,
        });
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.85).attr('stroke', '#1f2937');
        setTooltip(null);
      });

    // Labels
    node
      .append('text')
      .text((d) => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#f9fafb')
      .attr('font-size', 11)
      .attr('font-weight', 600)
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, []);

  return (
    <div className="relative h-full min-h-[280px]">
      <svg ref={svgRef} className="w-full h-full" aria-label="Co-occurrence network graph showing toxin relationships" />
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200 whitespace-pre-line z-50"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
