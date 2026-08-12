import React from 'react';

interface TrendChartProps {
  data: number[];
  width?: number;
  height?: number;
}

export function TrendChart({ data, width = 800, height = 128 }: TrendChartProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  // Generate background grid lines
  const gridLines = [];
  const numLines = 5;
  for (let i = 0; i < numLines; i++) {
    const y = (height / (numLines - 1)) * i;
    gridLines.push(
      <line
        key={i}
        x1="0" y1={y} x2={width} y2={y}
        stroke="currentColor"
        strokeWidth="1"
        className="opacity-10"
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid Lines */}
      {gridLines}

      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
        className="transition-all duration-500"
      />

      <polygon
        fill="url(#chartGradient)"
        points={areaPoints}
      />
    </svg>
  );
}
