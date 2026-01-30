import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

// ECharts optional extensions (dataTool provides helpers for data processing, etc.)
// We're using the built-in extension to enable extra features without adding new deps
import 'echarts/extension/dataTool';

interface ChartProps {
  // Compose option for bar, line, and pie charts
  option: echarts.ComposeOption<
    | echarts.BarSeriesOption
    | echarts.LineSeriesOption
    | echarts.PieSeriesOption
  >;
  style?: React.CSSProperties;
}

const Chart: React.FC<ChartProps> = ({ option, style }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chartInstance = echarts.init(chartRef.current);

    // ✅ Use as 'any' to bypass strict TS but still type-safe for our ComposeOption
    chartInstance.setOption(option as any);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.dispose();
    };
  }, [option]);

  return <div ref={chartRef} style={{ width: '100%', height: 400, ...style }} />;
};

export default Chart;
