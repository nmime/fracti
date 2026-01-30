import { DefaultCurrency } from '@libs/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d';
import { useTheme } from '@/providers';
import type { DebtGraph as DebtGraphType } from '@/services';
import { formatAmount } from '@/utils';

// Theme-aware color palettes
const colors = {
  light: {
    positive: { node: '#22c55e', bg: '#dcfce7' },
    negative: { node: '#ef4444', bg: '#fee2e2' },
    text: '#1f2937',
    link: '#94a3b8',
    linkText: '#64748b',
  },
  dark: {
    positive: { node: '#4ade80', bg: '#166534' },
    negative: { node: '#f87171', bg: '#991b1b' },
    text: '#f9fafb',
    link: '#64748b',
    linkText: '#94a3b8',
  },
};

interface GraphNode {
  id: string;
  name: string;
  balance: number;
  wallet?: string;
  // Force graph adds these at runtime
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  amount: number;
}

// Helper to get node from link source/target (can be string or object after simulation)
function getNodeCoords(nodeOrId: string | GraphNode): { x: number; y: number } | null {
  if (typeof nodeOrId === 'string') return null;
  if (nodeOrId.x === undefined || nodeOrId.y === undefined) return null;

  return { x: nodeOrId.x, y: nodeOrId.y };
}

interface DebtGraphProps {
  data: DebtGraphType;
  currency?: string;
  onNodeClick?: (node: GraphNode) => void;
  width?: number;
  height?: number;
}

export function DebtGraph({ data, currency = DefaultCurrency, onNodeClick, width = 350, height = 300 }: DebtGraphProps) {
  const graphRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>>>(undefined);
  const [dimensions, setDimensions] = useState({ width, height });
  const { resolvedTheme } = useTheme();
  const themeColors = colors[resolvedTheme];

  // Memoize graph data to prevent unnecessary re-renders of the force graph
  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        balance: node.balance,
        wallet: node.wallet,
      })),
      links: data.edges.map((edge) => ({
        source: edge.from,
        target: edge.to,
        amount: edge.amount,
      })),
    }),
    [data.nodes, data.edges],
  );

  useEffect(() => {
    const handleResize = () => {
      const container = graphRef.current;
      if (container) {
        setDimensions({
          width: Math.min(window.innerWidth - 32, 500),
          height: 300,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const nodeCanvasObject = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    const nodeRadius = 20;

    // Determine color based on balance (theme-aware)
    const isPositive = node.balance >= 0;
    const colorSet = isPositive ? themeColors.positive : themeColors.negative;

    // Draw node circle - force graph guarantees x/y are set by render time
    ctx.beginPath();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ctx.arc(node.x!, node.y!, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = colorSet.bg;
    ctx.fill();
    ctx.strokeStyle = colorSet.node;
    ctx.lineWidth = 2 / globalScale;
    ctx.stroke();

    // Draw label (theme-aware text color)
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = themeColors.text;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ctx.fillText(label, node.x!, node.y! - 3);

    // Draw balance
    const balanceText = `${node.balance >= 0 ? '+' : ''}${formatAmount(node.balance)}`;
    ctx.font = `bold ${fontSize * 0.8}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillStyle = colorSet.node;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ctx.fillText(balanceText, node.x!, node.y! + 10);
  }, [themeColors]);

  const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = getNodeCoords(link.source);
    const end = getNodeCoords(link.target);

    if (!start || !end) return;

    // Draw link line (theme-aware)
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = themeColors.link;
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowLength = 8 / globalScale;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX - arrowLength * Math.cos(angle - Math.PI / 6), midY - arrowLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(midX - arrowLength * Math.cos(angle + Math.PI / 6), midY - arrowLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = themeColors.link;
    ctx.fill();

    // Draw amount label (theme-aware text color)
    const fontSize = 10 / globalScale;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = themeColors.linkText;
    ctx.fillText(`${formatAmount(link.amount)} ${currency}`, midX, midY - 10 / globalScale);
  }, [currency, themeColors]);

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick?.(node);
    },
    [onNodeClick],
  );

  if (graphData.nodes.length === 0) {
    return <div className="text-muted-foreground flex h-[300px] items-center justify-center">No debts to display</div>;
  }

  return (
    <div className="force-graph-container bg-card rounded-lg border">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        onNodeClick={handleNodeClick}
        nodeRelSize={20}
        linkDirectionalArrowLength={0}
        cooldownTicks={100}
        onEngineStop={() => graphRef.current?.zoomToFit(400)}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
