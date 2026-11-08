'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { cn } from '@/lib/utils';

Chart.register(...registerables);

interface ChartCardProps {
  title: string;
  subtitle?: string;
  chartType: 'line' | 'bar' | 'doughnut' | 'area';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string | string[];
      fill?: boolean;
      tension?: number;
      yAxisID?: string;
      borderWidth?: number;
      borderRadius?: number;
    }>;
  };
  options?: Record<string, any>;
  className?: string;
}

export function ChartCard({ title, subtitle, chartType, data, options, className }: ChartCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: '#9ca3af',
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: '#0a0a0a',
          borderColor: '#1a1a1a',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#d1d5db',
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: { color: '#6b7280', font: { size: 11 } },
          beginAtZero: true,
        },
      },
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
    };

    chartRef.current = new Chart(ctx, {
      type: chartType === 'area' ? 'line' : chartType,
      data: {
        ...data,
        datasets: data.datasets.map((ds) => ({
          ...ds,
          fill: chartType === 'area' ? true : ds.fill ?? false,
          tension: ds.tension ?? 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        })),
      },
      options: { ...defaultOptions, ...options },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [chartType, data, options]);

  return (
    <div className={cn('card', className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="chart-container" style={{ height: '320px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}