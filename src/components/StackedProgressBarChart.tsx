import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { BuildingData, DEFAULT_PROCESSES } from '../types';

interface Props {
  buildings: BuildingData[];
  processes: string[];
}

const StackedProgressBarChart: React.FC<Props> = ({ buildings, processes }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || buildings.length === 0) return;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const containerWidth = containerRef.current.clientWidth;
    const margin = { top: 40, right: 30, bottom: 60, left: 100 };
    const width = containerWidth - margin.left - margin.right;
    const height = (buildings.length * 40) + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data
    // Each building bar will be composed of segments representing each process
    // We normalize so that the total bar length represents average progress (0-100)
    const n = processes.length;
    const stackData = buildings.map(b => {
      const entry: any = { buildingName: b.name };
      let last = 0;
      processes.forEach(p => {
        const progress = b.processes[p] || 0;
        const normalized = progress / n;
        entry[p] = normalized;
        last += normalized;
      });
      entry.total = last;
      return entry;
    });

    // Scales
    const y = d3.scaleBand()
      .domain(buildings.map(d => d.name))
      .range([0, height - margin.top - margin.bottom])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    // Color scale for processes
    const color = d3.scaleOrdinal<string>()
      .domain(processes)
      .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), processes.length));

    // Stack the data
    const stack = d3.stack()
      .keys(processes);

    const series = stack(stackData as any);

    // X Axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => `${d}%`))
      .selectAll("text")
      .style("font-size", "10px")
      .style("font-family", "Inter");

    // Y Axis
    svg.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("font-family", "Inter");

    // Add bars
    const groups = svg.selectAll("g.series")
      .data(series)
      .enter()
      .append("g")
      .attr("class", "series")
      .attr("fill", d => color(d.key) as string);

    groups.selectAll("rect")
      .data(d => (d as any).map((item: any) => {
        item.processKey = (d as any).key;
        return item;
      }))
      .enter()
      .append("rect")
      .attr("y", (d: any) => y(d.data.buildingName)!)
      .attr("x", d => x(d[0]))
      .attr("width", d => x(d[1]) - x(d[0]))
      .attr("height", y.bandwidth())
      .append("title") // Tooltip
      .text((d: any) => {
        const processName = d.processKey;
        return `${d.data.buildingName} - ${processName}: ${Math.round(d.data[processName] * n)}%`;
      });

    // Add total progress labels
    svg.selectAll(".total-label")
      .data(stackData)
      .enter()
      .append("text")
      .attr("class", "total-label")
      .attr("x", d => x(d.total) + 5)
      .attr("y", d => y(d.buildingName)! + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", "#64748b")
      .text(d => `${Math.round(d.total)}%`);

    // Add Title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "900")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.05em")
      .text("동별 공정별 누적 진행 현황 (Average Progress)");

  }, [buildings, processes, svgRef]);

  return (
    <div ref={containerRef} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <svg ref={svgRef} className="w-full h-auto"></svg>
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {processes.map((p, idx) => (
          <div key={p} className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), processes.length)[idx] }}
            />
            <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{p.replace(/^\d+\.\s*/, '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StackedProgressBarChart;
