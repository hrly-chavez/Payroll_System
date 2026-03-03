import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts/extension/dataTool";

interface ChartProps {
  option: echarts.ComposeOption<
    echarts.BarSeriesOption | echarts.LineSeriesOption | echarts.PieSeriesOption
  >;
  style?: React.CSSProperties;
}

const Chart: React.FC<ChartProps> = ({ option, style }) => {
  const chartElRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const rafIdRef = useRef<number | null>(null);
  const resizingRef = useRef(false);

  const scheduleResize = () => {
    if (!chartInstanceRef.current) return;

    // debounce resize calls into the next animation frame
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      if (!chartInstanceRef.current) return;

      // guard against ResizeObserver feedback loops
      if (resizingRef.current) return;
      resizingRef.current = true;

      try {
        chartInstanceRef.current.resize();
      } finally {
        resizingRef.current = false;
      }
    });
  };

  useEffect(() => {
    if (!chartElRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartElRef.current);
    }

    const chart = chartInstanceRef.current;

    // Update option (do NOT force resize here; RO will handle sizing)
    chart.setOption(option as any, { notMerge: true, lazyUpdate: true });

    // Still schedule one resize after option update (safe + debounced)
    scheduleResize();
  }, [option]);

  useEffect(() => {
    if (!chartElRef.current || !chartInstanceRef.current) return;

    const ro = new ResizeObserver(() => {
      scheduleResize();
    });

    ro.observe(chartElRef.current);

    return () => {
      ro.disconnect();

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;

      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  return (
    <div
      ref={chartElRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 260,
        ...style,
      }}
    />
  );
};

export default Chart;