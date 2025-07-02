'use client'
import React, { useRef, useState } from 'react';
import { Globe, Plus, Sun, Moon } from 'lucide-react';

const MENU_OPTIONS = [
  { label: 'New', action: 'new' },
  { label: 'Save', action: 'save' },
  { label: 'Save As', action: 'saveAs' },
  { label: 'Load', action: 'load' },
  { label: 'Clear', action: 'clear' },
  { label: 'Refresh Page', action: 'refresh' },
];

function DropdownMenu({ onSelect, open, setOpen, anchorRef }: {
  onSelect: (action: string) => void,
  open: boolean,
  setOpen: (v: boolean) => void,
  anchorRef: React.RefObject<HTMLDivElement>
}) {
  React.useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open, setOpen, anchorRef]);
  return open ? (
    <div className="absolute left-0" style={{ minWidth: 160, top: 48, zIndex: 1000 }}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-2 flex flex-col">
        {MENU_OPTIONS.map(opt => (
          <button
            key={opt.action}
            className="px-5 py-2 text-left hover:bg-blue-50 text-gray-700 font-medium transition-colors"
            onClick={() => { setOpen(false); onSelect(opt.action); }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  ) : null;
}

function InfiniteGridWithNodes({ onCursorChange, nodes, editingNodeId, onEditNode, onRenameNode, onMoveNode, connections, onConnectStart, onConnectEnd, connectingFromId, selectedNodeId, onSelectNode, darkMode, setConnections, onAddNodeAt, onSelectMultipleNodes, multiSelectedNodeIds }: {
  onCursorChange: (pos: { x: number, y: number } | null) => void,
  nodes: { x: number, y: number, id: number, name?: string }[],
  editingNodeId: number | null,
  onEditNode: (id: number) => void,
  onRenameNode: (id: number, name: string) => void,
  onMoveNode: (id: number, x: number, y: number) => void,
  connections: { from: number, to: number }[],
  onConnectStart: (id: number) => void,
  onConnectEnd: (id: number) => void,
  connectingFromId: number | null,
  selectedNodeId?: number | null,
  onSelectNode?: (id: number | null) => void,
  darkMode?: boolean,
  setConnections: React.Dispatch<React.SetStateAction<{from: number, to: number}[]>>,
  onAddNodeAt?: (x: number, y: number) => void,
  onSelectMultipleNodes?: (ids: number[]) => void,
  multiSelectedNodeIds?: number[]
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<{ x: number, y: number } | null>(null);
  const [showCrosshair, setShowCrosshair] = useState(false);
  // Mouse/touch event handlers for dragging
  // Extend dragging state to support multi-drag
  type DraggingState =
    | { id: number; offsetX: number; offsetY: number; multi: false }
    | { id: number; offsetX: number; offsetY: number; multi: true; initialPositions: { id: number; x: number; y: number }[] };
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  // Add shakingNodeId state for shake animation
  const [shakingNodeId, setShakingNodeId] = useState<number | null>(null);
  // Rectangle selection state
  const [selectionRect, setSelectionRect] = useState<null | { x1: number, y1: number, x2: number, y2: number }>(null);
  const [selecting, setSelecting] = useState(false);

  // --- Fix: Multi-drag initial positions ref ---
  const multiDragInitialPositionsRef = React.useRef<{ id: number; x: number; y: number }[] | null>(null);

  // Prevent text selection while dragging selection rectangle
  React.useEffect(() => {
    if (selecting) {
      const handle = (e: Event) => {
        e.preventDefault();
      };
      document.addEventListener('selectstart', handle, { passive: false });
      return () => document.removeEventListener('selectstart', handle);
    }
  }, [selecting]);

  React.useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        setContainerSize({
          width: containerRef.current!.offsetWidth,
          height: containerRef.current!.offsetHeight,
        });
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  // Listen for shift key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShowCrosshair(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShowCrosshair(false);
        setCursor(null);
        onCursorChange(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onCursorChange]);

  // Mouse move for crosshair
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!showCrosshair) return;
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const px = Math.round(e.clientX - rect.left - 1);
    const py = Math.round(e.clientY - rect.top - 1);
    // Convert to grid coordinates
    const gridX = Math.max(0, Math.min(cols, Math.round(px / gridSize)));
    const gridY = Math.max(0, Math.min(rows, Math.round(py / gridSize)));
    setCursor({ x: gridX, y: gridY });
    onCursorChange({ x: gridX, y: gridY });
  };

  // Double click to add node at nearest grid position
  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const px = Math.round(e.clientX - rect.left - 1);
    const py = Math.round(e.clientY - rect.top - 1);
    const gridX = Math.max(0, Math.min(cols - 4, Math.round(px / gridSize)));
    const gridY = Math.max(0, Math.min(rows - 3, Math.round(py / gridSize)));
    if (onAddNodeAt) onAddNodeAt(gridX, gridY);
  };

  // Calculate grid size to fit the available space, but center the grid
  const gridSize = 40;
  // Use 96% of the available card size for the grid (was 80%)
  const gridWidth = Math.max(gridSize, Math.floor(containerSize.width * 0.96 / gridSize) * gridSize);
  const gridHeight = Math.max(gridSize, Math.floor(containerSize.height * 0.96 / gridSize) * gridSize);
  const cols = Math.floor(gridWidth / gridSize);
  const rows = Math.floor(gridHeight / gridSize);
  const lines = [];
  for (let i = 0; i <= cols; i++) {
    const x = 1 + i * gridSize;
    lines.push(
      <line key={`v${x}`} x1={x} y1={1} x2={x} y2={1 + rows * gridSize} stroke={darkMode ? "#334155" : "#cbd5e1"} strokeWidth={1.2} />
    );
  }
  for (let j = 0; j <= rows; j++) {
    const y = 1 + j * gridSize;
    lines.push(
      <line key={`h${y}`} x1={1} y1={y} x2={1 + cols * gridSize} y2={y} stroke={darkMode ? "#334155" : "#cbd5e1"} strokeWidth={1.2} />
    );
  }
  lines.unshift(
    <rect
      key="perimeter"
      x={1}
      y={1}
      width={cols * gridSize}
      height={rows * gridSize}
      fill="none"
      stroke={darkMode ? "#64748b" : "#64748b"}
      strokeWidth={2}
      rx={0}
    />
  );

  // Crosshair lines
  if (showCrosshair && cursor) {
    const crossX = 1 + cursor.x * gridSize;
    const crossY = 1 + cursor.y * gridSize;
    lines.push(
      <line key="crosshair-v" x1={crossX} y1={1} x2={crossX} y2={1 + rows * gridSize} stroke="#4f8cff" strokeWidth={1.5} strokeDasharray="4 2" />,
      <line key="crosshair-h" x1={1} y1={crossY} x2={1 + cols * gridSize} y2={crossY} stroke="#4f8cff" strokeWidth={1.5} strokeDasharray="4 2" />
    );
  }

  // Render connections as lines between node centers
  const connectionElements = connections.map((conn, i) => {
    const from = nodes.find(n => n.id === conn.from);
    const to = nodes.find(n => n.id === conn.to);
    if (!from || !to) return null;
    const fromX = 1 + from.x * gridSize + (gridSize * 4) / 2;
    const fromY = 1 + from.y * gridSize + (gridSize * 3) / 2;
    const toX = 1 + to.x * gridSize + (gridSize * 4) / 2;
    const toY = 1 + to.y * gridSize + (gridSize * 3) / 2;
    return (
      <line
        key={i}
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke="#4f8cff"
        strokeWidth={3}
        markerEnd="url(#arrowhead)"
        opacity={0.7}
      />
    );
  });

  // Render nodes
  const nodeElements = nodes.map(node => {
    // Node is 4x3 cells, use node.x, node.y as top-left
    const x = 1 + node.x * gridSize;
    const y = 1 + node.y * gridSize;
    const nodeWidth = gridSize * 4;
    const nodeHeight = gridSize * 3;
    const isEditing = editingNodeId === node.id;
    // Estimate label width (monospace, fontSize=20, 12px per char + 24px padding)
    const label = node.name || node.id.toString();
    const charWidth = 12; // px, rough estimate for monospace
    const labelWidth = Math.max(40, label.length * charWidth + 32);
    const labelHeight = 38;
    const labelX = x + nodeWidth / 2 - labelWidth / 2;
    const labelY = y + nodeHeight / 2 - labelHeight / 2;
    // Highlight if multi-selected
    const isMultiSelected = multiSelectedNodeIds && multiSelectedNodeIds.includes(node.id);
    return (
      <g key={node.id}
        style={{
          cursor: isEditing ? 'text' : 'pointer',
          animation: shakingNodeId === node.id ? 'shake 0.3s' : undefined
        }}
        onPointerDown={e => handleNodePointerDown(e, node)}
        onClick={e => {
          e.stopPropagation();
          // If multi-select is active, do not override selection
          if (multiSelectedNodeIds && multiSelectedNodeIds.length > 0) return;
          const isCtrlOrCmd = e.ctrlKey || e.metaKey;
          const isAltOrOpt = e.altKey;
          if (isAltOrOpt) {
            // Remove preceding connection if exists
            const incoming = connections.filter((c) => c.to === node.id);
            if (incoming.length > 0) {
              // Remove the most recent (last) incoming connection
              const lastConn = incoming[incoming.length - 1];
              setConnections((conns: {from: number, to: number}[]) => conns.filter(c => c !== lastConn));
            } else {
              // Try to reconnect to the node it was most recently connected to
              const outgoing = connections.filter((c) => c.from === node.id);
              if (outgoing.length > 0) {
                const lastOut = outgoing[outgoing.length - 1];
                setConnections((conns: {from: number, to: number}[]) => {
                  const filtered = conns.filter(c => c !== lastOut);
                  return [...filtered, lastOut];
                });
              } else {
                // Shake the node (visual feedback)
                setShakingNodeId(node.id);
                setTimeout(() => setShakingNodeId(null), 500);
              }
            }
            return;
          }
          if (connectingFromId != null && connectingFromId !== node.id && isCtrlOrCmd) {
            if (onConnectEnd) onConnectEnd(node.id);
            if (onSelectNode) onSelectNode(null);
          } else {
            if (onSelectNode) onSelectNode(node.id);
            if (onConnectStart) onConnectStart(node.id);
          }
        }}
      >
        {/* Node background: glassy, subtle, less cartoonish */}
        <rect
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          rx={14}
          fill={isMultiSelected ? (darkMode ? '#2563eb' : '#4f8cff') : (darkMode ? 'url(#nodeGradientDark)' : 'url(#nodeGradientModern)')}
          stroke={isMultiSelected ? (darkMode ? '#bae6fd' : '#2563eb') : (selectedNodeId === node.id
            ? (connectingFromId === node.id ? '#60a5fa' : '#4f8cff')
            : (darkMode ? '#334155' : '#2563eb'))}
          strokeWidth={isMultiSelected ? 4 : (selectedNodeId === node.id
            ? (connectingFromId === node.id ? 4 : 3.5)
            : 2)}
          filter="url(#nodeShadow)"
          opacity={darkMode ? 0.98 : 0.97}
          style={{ transition: 'stroke 0.15s, stroke-width 0.15s', boxShadow: darkMode ? '0 2px 16px #0f172a44' : '0 2px 16px #4f8cff22' }}
        />
        {/* Minimal border highlight */}
        <rect
          x={x + 1.5}
          y={y + 1.5}
          width={nodeWidth - 3}
          height={nodeHeight - 3}
          rx={12}
          fill="none"
          stroke={selectedNodeId === node.id ? (connectingFromId === node.id ? '#60a5fa' : '#4f8cff') : (darkMode ? 'url(#nodeBorderGradientDark)' : 'url(#nodeBorderGradientModern)')}
          strokeWidth={selectedNodeId === node.id ? 2.5 : 1.5}
          opacity={0.7}
          style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
        />
        {/* Remove cartoonish icon, keep it minimal */}
        {/* Capsule label background with subtle shadow */}
        {!isEditing && (
          <rect
            x={labelX}
            y={labelY}
            width={labelWidth}
            height={labelHeight}
            rx={labelHeight / 2}
            fill={darkMode ? '#1e293b' : '#f8fafc'}
            filter="url(#nodeLabelShadow)"
            opacity={darkMode ? 0.98 : 0.98}
          />
        )}
        {isEditing ? (
          <foreignObject
            x={x + nodeWidth / 2 - labelWidth / 2}
            y={y + nodeHeight / 2 - labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            style={{ pointerEvents: 'auto' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <AutoGrowInput
                initialValue={node.name || ''}
                onBlur={value => onRenameNode(node.id, value)}
                nodeWidth={nodeWidth}
              />
            </div>
          </foreignObject>
        ) : (
          <text
            x={x + nodeWidth / 2}
            y={y + nodeHeight / 2 + 8}
            textAnchor="middle"
            fill={darkMode ? '#e0e7ef' : '#2563eb'}
            fontWeight="600"
            fontSize={20}
            fontFamily="'Inter', 'Segoe UI', 'Arial', sans-serif"
            style={{ cursor: 'pointer', userSelect: 'none', letterSpacing: 0.2 }}
            onClick={() => onEditNode(node.id)}
          >
            {label}
          </text>
        )}
      </g>
    );
  });

  // Mouse/touch event handlers for dragging
  const handleNodePointerDown = (e: React.PointerEvent, node: { x: number, y: number, id: number }) => {
    if (editingNodeId === node.id) return;
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left - 1;
    const py = e.clientY - rect.top - 1;
    const nodeX = 1 + node.x * gridSize;
    const nodeY = 1 + node.y * gridSize;
    
    if (multiSelectedNodeIds && multiSelectedNodeIds.length > 1 && multiSelectedNodeIds.includes(node.id)) {
      // Store ALL initial positions of selected nodes
      const initialPositions = nodes
        .filter(n => multiSelectedNodeIds.includes(n.id))
        .map(n => ({ id: n.id, x: n.x, y: n.y }));
      
      multiDragInitialPositionsRef.current = initialPositions;
      
      setDragging({
        id: node.id,
        offsetX: px - nodeX,
        offsetY: py - nodeY,
        multi: true,
        initialPositions // kept for type compatibility
      });
    } else {
      setDragging({
        id: node.id,
        offsetX: px - nodeX,
        offsetY: py - nodeY,
        multi: false
      });
      multiDragInitialPositionsRef.current = null;
    }
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left - 1;
    const py = e.clientY - rect.top - 1;
    
    if (dragging.multi && multiDragInitialPositionsRef.current) {
      // Calculate the desired position of the primary node being dragged
      const primaryNodeStartPos = multiDragInitialPositionsRef.current.find(p => p.id === dragging.id);
      if (!primaryNodeStartPos) return;
      
      // Calculate mouse position in grid coordinates
      const mouseGridX = Math.round((px - dragging.offsetX) / gridSize);
      const mouseGridY = Math.round((py - dragging.offsetY) / gridSize);
      
      // Calculate total delta from starting position
      const deltaX = mouseGridX - primaryNodeStartPos.x;
      const deltaY = mouseGridY - primaryNodeStartPos.y;
      
      // Update all nodes in the selection
      multiDragInitialPositionsRef.current.forEach(initPos => {
        // Calculate new position with boundary check
        const newX = Math.max(0, Math.min(cols - 4, initPos.x + deltaX));
        const newY = Math.max(0, Math.min(rows - 3, initPos.y + deltaY));
        
        // Update node position through the callback
        onMoveNode(initPos.id, newX, newY);
      });
    } else {
      // Single node drag - use the regular approach
      const gridX = Math.round((px - dragging.offsetX) / gridSize);
      const gridY = Math.round((py - dragging.offsetY) / gridSize);
      const boundedX = Math.max(0, Math.min(cols - 4, gridX));
      const boundedY = Math.max(0, Math.min(rows - 3, gridY));
      onMoveNode(dragging.id, boundedX, boundedY);
    }
  };

  const handlePointerUp = () => {
    if (dragging) {
      setDragging(null);
      multiDragInitialPositionsRef.current = null;
    }
  };

  // Mouse down on SVG to start selection
  const handleSvgPointerDown = (e: React.PointerEvent) => {
    // Only left click, and not on a node
    if (e.button !== 0) return;
    if (e.target instanceof SVGElement && e.target.tagName === 'svg') {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = Math.round(e.clientX - rect.left - 1);
      const py = Math.round(e.clientY - rect.top - 1);
      setSelectionRect({ x1: px, y1: py, x2: px, y2: py });
      setSelecting(true);
    }
  };

  // Mouse move to update selection rectangle
  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!selecting || !selectionRect) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.round(e.clientX - rect.left - 1);
    const py = Math.round(e.clientY - rect.top - 1);
    setSelectionRect(sel => sel ? { ...sel, x2: px, y2: py } : null);
  };

  // Mouse up to finish selection
  const handleSvgPointerUp = () => {
    if (selecting && selectionRect) {
      // Calculate selection bounds
      const minX = Math.min(selectionRect.x1, selectionRect.x2);
      const minY = Math.min(selectionRect.y1, selectionRect.y2);
      const maxX = Math.max(selectionRect.x1, selectionRect.x2);
      const maxY = Math.max(selectionRect.y1, selectionRect.y2);
      // Find nodes within selection
      const selectedIds = nodes.filter(node => {
        const x = 1 + node.x * gridSize;
        const y = 1 + node.y * gridSize;
        const nodeWidth = gridSize * 4;
        const nodeHeight = gridSize * 3;
        return (
          x + nodeWidth > minX &&
          x < maxX &&
          y + nodeHeight > minY &&
          y < maxY
        );
      }).map(n => n.id);
      if (onSelectMultipleNodes) onSelectMultipleNodes(selectedIds);
    }
    setSelecting(false);
    setSelectionRect(null);
  };

  return (
    <div className="w-full h-full flex items-center justify-center select-none overflow-hidden relative" style={{ outline: 'none', background: 'transparent' }}>
      <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
        <svg
          width={cols * gridSize + 2}
          height={rows * gridSize + 2}
          style={{
            display: 'block',
            background: darkMode ? '#1e293b' : 'white',
            margin: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setCursor(null); onCursorChange(null); }}
          onPointerMove={e => { handlePointerMove(e); handleSvgPointerMove(e); }}
          onPointerUp={() => { handlePointerUp(); handleSvgPointerUp(); }}
          onPointerDown={handleSvgPointerDown}
          onClick={() => { if (onSelectNode) onSelectNode(null); }}
          onDoubleClick={handleDoubleClick}
        >
          <defs>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor={darkMode ? '#0ea5e9' : '#4f8cff'} floodOpacity="0.13" />
            </filter>
            <filter id="nodeLabelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={darkMode ? '#64748b' : '#2563eb'} floodOpacity="0.10" />
            </filter>
            <linearGradient id="nodeGradientModern" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#dbeafe" />
            </linearGradient>
            <linearGradient id="nodeGradientDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="nodeBorderGradientModern" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4f8cff" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <linearGradient id="nodeBorderGradientDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4f8cff" />
            </marker>
          </defs>
          {lines}
          {connectionElements}
          {nodeElements}
          {/* Selection rectangle */}
          {selectionRect && (
            <rect
              x={Math.min(selectionRect.x1, selectionRect.x2)}
              y={Math.min(selectionRect.y1, selectionRect.y2)}
              width={Math.abs(selectionRect.x2 - selectionRect.x1)}
              height={Math.abs(selectionRect.y2 - selectionRect.y1)}
              fill={darkMode ? 'rgba(79,140,255,0.18)' : 'rgba(79,140,255,0.13)'}
              stroke={darkMode ? '#4f8cff' : '#2563eb'}
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
  const [nodes, setNodes] = useState<{ x: number, y: number, id: number, name?: string }[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [connections, setConnections] = useState<{ from: number, to: number }[]>([]);
  const [connectingFromId, setConnectingFromId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const globeRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [availableSaves, setAvailableSaves] = useState<{ key: string, name: string, time: number }[]>([]);
  const [currentSaveName, setCurrentSaveName] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('darkMode');
      if (stored !== null) return stored === 'true';
    }
    return false;
  });
  const [showLoader, setShowLoader] = useState(true);
  // Add state for multi-selection
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<number[]>([]);

  React.useEffect(() => {
    // Show loader for at least 300ms to prevent flashing
    const timeout = setTimeout(() => setShowLoader(false), 300);
    return () => clearTimeout(timeout);
  }, []);

  const handleMenuSelect = async (action: string) => {
    switch (action) {
      case 'new':
        if (!confirm('Are you sure you want to start a new graph? Unsaved changes will be lost.')) break;
        setNodes([]); setConnections([]); setEditingNodeId(null); setCurrentSaveName(null); break;
      case 'save': {
        if (!currentSaveName) {
          // Prompt for name if not yet named
          const name = prompt('Enter a name for this save:');
          if (name) {
            try {
              localStorage.setItem(`graph_nodes_${name}`, JSON.stringify(nodes));
              localStorage.setItem(`graph_connections_${name}`, JSON.stringify(connections));
              localStorage.setItem(`graph_nodes_time_${name}`, Date.now().toString());
              setCurrentSaveName(name);
              alert(`Saved as "${name}"!`);
            } catch (e) {
              alert('Failed to save: ' + (e as Error).message);
            }
          }
        } else {
          // Save to current name
          try {
            localStorage.setItem(`graph_nodes_${currentSaveName}`, JSON.stringify(nodes));
            localStorage.setItem(`graph_connections_${currentSaveName}`, JSON.stringify(connections));
            localStorage.setItem(`graph_nodes_time_${currentSaveName}`, Date.now().toString());
            alert(`Saved as "${currentSaveName}"!`);
          } catch (e) {
            alert('Failed to save: ' + (e as Error).message);
          }
        }
        break;
      }
      case 'saveAs': {
        const name = prompt('Enter a name for this save:');
        if (name) {
          try {
            localStorage.setItem(`graph_nodes_${name}`, JSON.stringify(nodes));
            localStorage.setItem(`graph_connections_${name}`, JSON.stringify(connections));
            localStorage.setItem(`graph_nodes_time_${name}`, Date.now().toString());
            setCurrentSaveName(name);
            alert(`Saved as "${name}"!`);
          } catch (e) {
            alert('Failed to save: ' + (e as Error).message);
          }
        }
        break;
      }
      case 'load': {
        // Gather all saves
        const saves: { key: string, name: string, time: number }[] = [];
        // Default save
        const defaultTime = localStorage.getItem('graph_nodes_time');
        if (localStorage.getItem('graph_nodes')) {
          saves.push({ key: 'default', name: 'Default', time: defaultTime ? parseInt(defaultTime) : 0 });
        }
        // Named saves
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (
            k &&
            k.startsWith('graph_nodes_') &&
            !k.endsWith('_time') &&
            !k.startsWith('graph_nodes_time_') // Exclude timestamp keys
          ) {
            const name = k.replace('graph_nodes_', '');
            const timeStr = localStorage.getItem(`graph_nodes_time_${name}`);
            const time = timeStr ? parseInt(timeStr) : 0;
            saves.push({ key: name, name, time });
          }
        }
        // Sort by time desc (most recent first)
        saves.sort((a, b) => b.time - a.time);
        setAvailableSaves(saves);
        setLoadModalOpen(true);
        break;
      }
      case 'clear':
        if (!confirm('Are you sure you want to clear the current graph? This cannot be undone.')) break;
        setNodes([]); setConnections([]); setEditingNodeId(null); break;
      case 'refresh':
        window.location.reload();
        break;
    }
  };

  const handleLoadFromSave = (key: string) => {
    let loadedNodes = null, loadedConnections = null;
    try {
      if (key === 'default') {
        loadedNodes = localStorage.getItem('graph_nodes');
        loadedConnections = localStorage.getItem('graph_connections');
        setCurrentSaveName(null);
      } else {
        loadedNodes = localStorage.getItem(`graph_nodes_${key}`);
        loadedConnections = localStorage.getItem(`graph_connections_${key}`);
        setCurrentSaveName(key);
      }
      if (loadedNodes && loadedConnections) {
        setNodes(JSON.parse(loadedNodes));
        setConnections(JSON.parse(loadedConnections));
        setEditingNodeId(null);
        setLoadModalOpen(false);
        alert('Loaded!');
      } else {
        alert('No saved data found for that name.');
      }
    } catch (e) {
      alert('Failed to load: ' + (e as Error).message);
    }
  };

  const handleAddNode = () => {
    let x = 0, y = 0;
    if (cursorPos) {
      x = cursorPos.x;
      y = cursorPos.y;
    }
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    setNodes(nodes => [
      ...nodes,
      { x, y, id: newId }
    ]);
    setEditingNodeId(newId);
  };
  // Add handler for adding node at a specific grid position
  const handleAddNodeAt = (x: number, y: number) => {
    const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 1;
    setNodes(nodes => [
      ...nodes,
      { x, y, id: newId }
    ]);
    setEditingNodeId(newId);
  };
  const handleEditNode = (id: number) => setEditingNodeId(id);
  const handleRenameNode = (id: number, name: string) => {
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, name: name.trim() || undefined } : n));
    setEditingNodeId(null);
  };
  const handleMoveNode = (id: number, x: number, y: number) => {
    setNodes(nodes => nodes.map(n => n.id === id ? { ...n, x, y } : n));
  };
  const handleConnectStart = (id: number) => {
    setConnectingFromId(id);
  };
  const handleConnectEnd = (id: number) => {
    if (connectingFromId && connectingFromId !== id) {
      setConnections(conns => {
        // Prevent duplicate connections
        if (conns.some(c => c.from === connectingFromId && c.to === id)) return conns;
        return [...conns, { from: connectingFromId, to: id }];
      });
    }
    setConnectingFromId(null);
  };
  const handleDeleteSave = (key: string) => {
    if (!confirm('Are you sure you want to delete this save?')) return;
    if (key === 'default') {
      localStorage.removeItem('graph_nodes');
      localStorage.removeItem('graph_connections');
      localStorage.removeItem('graph_nodes_time');
    } else {
      localStorage.removeItem(`graph_nodes_${key}`);
      localStorage.removeItem(`graph_connections_${key}`);
      localStorage.removeItem(`graph_nodes_time_${key}`);
      if (currentSaveName === key) setCurrentSaveName(null);
    }
    // Refresh the saves list
    setAvailableSaves(saves => saves.filter(s => s.key !== key));
  };
  const handleDeleteSelectedNode = React.useCallback(() => {
    if (selectedNodeId == null) return;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    // Remove confirm prompt
    setNodes(nodes => nodes.filter(n => n.id !== selectedNodeId));
    setConnections(conns => conns.filter(c => c.from !== selectedNodeId && c.to !== selectedNodeId));
    setSelectedNodeId(null);
    setEditingNodeId(null);
  }, [selectedNodeId, nodes]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId != null) {
        e.preventDefault();
        handleDeleteSelectedNode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleDeleteSelectedNode]);

  React.useEffect(() => {
    localStorage.setItem('darkMode', darkMode ? 'true' : 'false');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Add shake animation keyframes to the component or global CSS
  const shakeStyle = `
  @keyframes shake {
    0% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }`;
  if (typeof window !== 'undefined' && !document.getElementById('shake-keyframes')) {
    const style = document.createElement('style');
    style.id = 'shake-keyframes';
    style.innerHTML = shakeStyle;
    document.head.appendChild(style);
  }

  if (showLoader) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-[9999] transition-opacity duration-300">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blue-400 mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className={"min-h-screen flex flex-col " + (darkMode ? 'dark bg-gray-900' : 'bg-[#f7f9fb]')}> 
      <header className={"h-16 border-b flex items-center px-8 shadow-sm backdrop-blur-md relative z-20 " + (darkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200')}> 
        <div ref={globeRef} className="w-10 h-10 bg-gradient-to-tr from-[#4f8cff] to-[#6ee7b7] rounded-xl flex items-center justify-center shadow-md cursor-pointer relative z-30" onClick={() => setMenuOpen(v => !v)}>
          <Globe className="w-6 h-6 text-white" />
          <DropdownMenu open={menuOpen} setOpen={setMenuOpen} onSelect={handleMenuSelect} anchorRef={globeRef} />
        </div>
        <span className={"ml-4 text-2xl font-bold tracking-tight select-none " + (darkMode ? 'text-blue-200' : 'text-blue-700')}>Backend</span>
        {cursorPos && (
          <div className={"absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-mono px-3 py-1 rounded shadow border " + (darkMode ? 'text-gray-200 bg-gray-800/80 border-gray-700' : 'text-gray-700 bg-white/80 border-gray-200')}>
            ({cursorPos.x}, {cursorPos.y})
          </div>
        )}
        {/* Options Dock */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center space-x-2 bg-white/0 dark:bg-gray-900/0 rounded-xl p-1">
          <button
            className="p-2 rounded-full bg-[#4f8cff] text-white shadow hover:bg-[#2563eb] transition-colors flex items-center justify-center"
            title="Add Node"
            onClick={handleAddNode}
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDarkMode(d => !d)}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <main className="flex-1 p-8 flex relative z-10">
        <div className={"flex-1 rounded-3xl shadow-xl flex items-center justify-center p-8 relative z-10 " + (darkMode ? 'bg-gray-900' : 'bg-white')}> 
          <InfiniteGridWithNodes
            onCursorChange={setCursorPos}
            nodes={nodes}
            editingNodeId={editingNodeId}
            onEditNode={handleEditNode}
            onRenameNode={handleRenameNode}
            onMoveNode={handleMoveNode}
            connections={connections}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            connectingFromId={connectingFromId}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            darkMode={darkMode}
            setConnections={setConnections}
            multiSelectedNodeIds={multiSelectedNodeIds}
            onAddNodeAt={handleAddNodeAt}
            onSelectMultipleNodes={setMultiSelectedNodeIds}
          />
          {/* Load Modal */}
          {loadModalOpen && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className={"rounded-2xl shadow-2xl p-8 min-w-[320px] max-w-[90vw] " + (darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white')}> 
                <h2 className={"text-xl font-bold mb-4 " + (darkMode ? 'text-blue-200' : 'text-blue-700')}>Load a Saved Graph</h2>
                {availableSaves.length === 0 ? (
                  <div className="text-gray-500 mb-4">No saves found.</div>
                ) : (
                  <ul className="mb-4">
                    {availableSaves.map(s => (
                      <li key={s.key} className="flex items-center group">
                        <button
                          className={"flex-1 text-left px-4 py-2 rounded font-mono flex justify-between items-center " + (darkMode ? 'text-blue-200 hover:bg-blue-900' : 'text-blue-700 hover:bg-blue-50')}
                          onClick={() => handleLoadFromSave(s.key)}
                        >
                          <span>{s.name}</span>
                          <span className="text-xs text-gray-400 ml-2">
                            {s.time ? new Date(s.time).toLocaleString(undefined, {
                              year: undefined,
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            }) : ''}
                          </span>
                        </button>
                        <button
                          className={"ml-2 px-2 py-1 rounded text-xs font-bold opacity-70 group-hover:opacity-100 transition " + (darkMode ? 'hover:bg-red-900 text-red-400' : 'hover:bg-red-100 text-red-500')}
                          title="Delete this save"
                          onClick={e => { e.stopPropagation(); handleDeleteSave(s.key); }}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button className={"mt-2 px-4 py-2 rounded font-semibold " + (darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-200 hover:bg-gray-300 text-gray-700')} onClick={() => setLoadModalOpen(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Add AutoGrowInput component at the top of the file:
function AutoGrowInput({ initialValue, onBlur, nodeWidth }: { initialValue: string, onBlur: (value: string) => void, nodeWidth: number }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(nodeWidth);

  React.useEffect(() => {
    if (spanRef.current) {
      const measured = spanRef.current.offsetWidth + 36;
      setWidth(Math.max(nodeWidth, Math.min(measured, 400)));
    }
  }, [value, nodeWidth]);

  React.useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width, minWidth: nodeWidth, maxWidth: 400 }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => onBlur(value)}
        onKeyDown={e => { if (e.key === 'Enter') inputRef.current?.blur(); }}
        className="transition-all duration-100 w-full px-5 py-2 rounded-full text-center text-lg font-semibold text-[#2563eb] bg-white/95 outline-none border-2 border-blue-200 focus:border-[#4f8cff] shadow-lg focus:shadow-xl placeholder-gray-300"
        style={{
          width: width,
          minWidth: nodeWidth,
          maxWidth: 400,
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 2px 12px 0 rgba(79,140,255,0.08)',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: 0.2,
        }}
        spellCheck={false}
        autoComplete="off"
        placeholder="Enter name..."
      />
      <span
        ref={spanRef}
        className="text-lg font-semibold px-5"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: 0.2,
        }}
      >
        {value || 'Enter name...'}
      </span>
    </div>
  );
}
