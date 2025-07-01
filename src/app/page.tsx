'use client'
import React, { useRef, useState } from 'react';
import { Globe } from 'lucide-react';

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

function InfiniteGridWithNodes({ onCursorChange, nodes, editingNodeId, onEditNode, onRenameNode, onMoveNode, connections, onConnectStart, onConnectEnd, connectingFromId, selectedNodeId, onSelectNode }: {
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
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<{ x: number, y: number } | null>(null);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [dragging, setDragging] = useState<null | { id: number, offsetX: number, offsetY: number }> (null);

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
      <line key={`v${x}`} x1={x} y1={1} x2={x} y2={1 + rows * gridSize} stroke="#cbd5e1" strokeWidth={1.2} />
    );
  }
  for (let j = 0; j <= rows; j++) {
    const y = 1 + j * gridSize;
    lines.push(
      <line key={`h${y}`} x1={1} y1={y} x2={1 + cols * gridSize} y2={y} stroke="#cbd5e1" strokeWidth={1.2} />
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
      stroke="#64748b"
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
    return (
      <g key={node.id}
        style={{ cursor: isEditing ? 'text' : 'grab' }}
        onPointerDown={e => handleNodePointerDown(e, node)}
        onClick={e => {
          if (e.altKey) {
            e.stopPropagation();
            if (onSelectNode) onSelectNode(node.id); // select on alt click too
            if (connectingFromId == null) {
              onConnectStart(node.id);
            } else if (connectingFromId !== node.id) {
              onConnectEnd(node.id);
            }
          } else {
            e.stopPropagation();
            if (onSelectNode) onSelectNode(node.id);
          }
        }}
      >
        {/* Node background with glassmorphism effect */}
        <rect
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          rx={22}
          fill="url(#nodeGradient)"
          stroke={selectedNodeId === node.id
            ? (connectingFromId === node.id ? "#60a5fa" : "#4f8cff")
            : "#2563eb"}
          strokeWidth={selectedNodeId === node.id
            ? (connectingFromId === node.id ? 5 : 4)
            : 2.5}
          filter="url(#nodeShadow)"
          opacity={0.95}
          style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
        />
        {/* Node border highlight */}
        <rect
          x={x + 2}
          y={y + 2}
          width={nodeWidth - 4}
          height={nodeHeight - 4}
          rx={18}
          fill="none"
          stroke={selectedNodeId === node.id
            ? (connectingFromId === node.id ? "#60a5fa" : "#4f8cff")
            : "url(#nodeBorderGradient)"}
          strokeWidth={selectedNodeId === node.id
            ? (connectingFromId === node.id ? 4 : 3)
            : 2}
          opacity={0.9}
          style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
        />
        {/* Decorative icon */}
        <g opacity={0.18}>
          <circle cx={x + nodeWidth - 28} cy={y + 28} r={18} fill="#fff" />
          <rect x={x + nodeWidth - 44} y={y + 14} width={32} height={8} rx={4} fill="#fff" />
        </g>
        {/* Capsule label background with shadow */}
        {!isEditing && (
          <rect
            x={labelX}
            y={labelY}
            width={labelWidth}
            height={labelHeight}
            rx={labelHeight / 2}
            fill="#fff"
            filter="url(#nodeLabelShadow)"
            opacity={0.98}
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
            fill="#2563eb"
            fontWeight="bold"
            fontSize={22}
            fontFamily="'Inter', 'Segoe UI', 'Arial', sans-serif"
            style={{ cursor: 'pointer', userSelect: 'none', letterSpacing: 0.5 }}
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
    setDragging({
      id: node.id,
      offsetX: px - nodeX,
      offsetY: py - nodeY,
    });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left - 1;
    const py = e.clientY - rect.top - 1;
    // Snap to grid
    let gridX = Math.round((px - dragging.offsetX) / gridSize);
    let gridY = Math.round((py - dragging.offsetY) / gridSize);
    gridX = Math.max(0, Math.min(cols - 4, gridX));
    gridY = Math.max(0, Math.min(rows - 3, gridY));
    onMoveNode(dragging.id, gridX, gridY);
  };

  const handlePointerUp = () => {
    if (dragging) {
      setDragging(null);
    }
  };

  // Keyboard event for deleting selected node
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNodeId != null) {
        if (window.confirm('Delete selected node?')) {
          if (onSelectNode) onSelectNode(null);
          // Remove node and its connections
          onMoveNode(selectedNodeId, -1, -1); // Optionally, or handle in parent
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, onSelectNode, onMoveNode]);

  return (
    <div className="w-full h-full flex items-center justify-center select-none overflow-hidden relative" style={{ outline: 'none', background: 'transparent' }}>
      <div ref={containerRef} className="relative flex items-center justify-center w-full h-full">
        <svg
          width={cols * gridSize + 2}
          height={rows * gridSize + 2}
          style={{
            display: 'block',
            background: 'white',
            margin: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setCursor(null); onCursorChange(null); }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => { if (onSelectNode) onSelectNode(null); }}
        >
          <defs>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#4f8cff" floodOpacity="0.18" />
            </filter>
            <filter id="nodeLabelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#2563eb" floodOpacity="0.10" />
            </filter>
            <linearGradient id="nodeGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e0e7ff" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
            <linearGradient id="nodeBorderGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4f8cff" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <polygon points="0 0, 10 3.5, 0 7" fill="#4f8cff" />
            </marker>
          </defs>
          {lines}
          {connectionElements}
          {nodeElements}
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
    if (!confirm(`Delete node "${node.name || node.id}"? This will also remove its connections.`)) return;
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

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col">
      <header className="h-16 bg-white/80 border-b border-gray-200 flex items-center px-8 shadow-sm backdrop-blur-md relative z-20">
        <div ref={globeRef} className="w-10 h-10 bg-gradient-to-tr from-[#4f8cff] to-[#6ee7b7] rounded-xl flex items-center justify-center shadow-md cursor-pointer relative z-30" onClick={() => setMenuOpen(v => !v)}>
          <Globe className="w-6 h-6 text-white" />
          <DropdownMenu open={menuOpen} setOpen={setMenuOpen} onSelect={handleMenuSelect} anchorRef={globeRef} />
        </div>
        <span className="ml-4 text-2xl font-bold text-blue-700 tracking-tight select-none">Backend Graph</span>
        {cursorPos && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-700 text-sm font-mono bg-white/80 px-3 py-1 rounded shadow border border-gray-200">
            ({cursorPos.x}, {cursorPos.y})
          </div>
        )}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          <button className="px-4 py-2 rounded bg-[#4f8cff] text-white font-semibold shadow hover:bg-[#2563eb] transition-colors" onClick={handleAddNode}>Add Node</button>
        </div>
      </header>
      <main className="flex-1 p-8 flex relative z-10">
        <div className="flex-1 bg-white rounded-3xl shadow-xl flex items-center justify-center p-8 relative z-10">
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
          />
          {/* Load Modal */}
          {loadModalOpen && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[320px] max-w-[90vw]">
                <h2 className="text-xl font-bold mb-4 text-blue-700">Load a Saved Graph</h2>
                {availableSaves.length === 0 ? (
                  <div className="text-gray-500 mb-4">No saves found.</div>
                ) : (
                  <ul className="mb-4">
                    {availableSaves.map(s => (
                      <li key={s.key} className="flex items-center group">
                        <button
                          className="flex-1 text-left px-4 py-2 rounded hover:bg-blue-50 font-mono text-blue-700 flex justify-between items-center"
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
                          className="ml-2 px-2 py-1 rounded hover:bg-red-100 text-red-500 text-xs font-bold opacity-70 group-hover:opacity-100 transition"
                          title="Delete this save"
                          onClick={e => { e.stopPropagation(); handleDeleteSave(s.key); }}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button className="mt-2 px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold" onClick={() => setLoadModalOpen(false)}>Cancel</button>
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
