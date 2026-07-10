import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  Server, Box, Play, Film, Shield, Globe, Lock, Camera, Cpu,
  MessageSquare, BarChart2, Activity, Cloud, ShieldCheck, GitBranch, Wifi,
  Search, Moon, Sun, Edit2, Plus, X, Copy, ExternalLink, Check, Layers,
  Database, Terminal, Monitor, HardDrive, AlertTriangle, Clock, Zap,
  LayoutGrid, List, RefreshCw, Network, GripVertical, Trash2, CheckSquare, Square,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = "online" | "offline" | "slow" | "unknown";
type Category = "AI" | "Infrastructure" | "Media" | "Network" | "Security";
type FilterCategory = "All" | Category;
type CheckType = "HTTP" | "Ping" | "TCP" | "None";
type ViewMode = "grid" | "list";
type StatusFilter = "all" | "online" | "offline" | "degraded";
type ConfirmAction =
  | { type: "single-delete"; ids: string[]; names: string[] }
  | { type: "bulk-delete"; ids: string[]; names: string[] };

interface Service {
  id: string;
  name: string;
  description: string;
  category: Category;
  url: string;
  healthUrl: string;
  checkType: CheckType;
  icon: string;
  status: Status;
  statusCheckEnabled: boolean;
  displayOrder?: number;
  lastCheckedAt?: string | null;
  responseTimeMs?: number | null;
}

interface DashboardSettings {
  dashboardName: string;
  dashboardSubtitle: string;
  dashboardIcon: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  Server, Box, Play, Film, Shield, Globe, Lock, Camera, Cpu, MessageSquare,
  BarChart2, Activity, Cloud, ShieldCheck, GitBranch, Wifi, Database, Terminal,
  Monitor, HardDrive, Layers, Network, RefreshCw,
};

const STATUS_CFG: Record<Status, { label: string; dot: string; chip: string }> = {
  online:  { label: "Online",  dot: "bg-emerald-400",                   chip: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" },
  offline: { label: "Offline", dot: "bg-red-400",                       chip: "bg-red-400/10 text-red-400 border-red-400/20" },
  slow:    { label: "Slow",    dot: "bg-amber-400",                      chip: "bg-amber-400/10 text-amber-400 border-amber-400/20" },
  unknown: { label: "Unknown", dot: "bg-zinc-500",                       chip: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

const CAT_CFG: Record<Category, { chip: string; active: string; hover: string }> = {
  AI:             { chip: "bg-purple-400/10 text-purple-300 border-purple-400/20",  active: "bg-purple-400/15 text-purple-300 border-purple-400/30", hover: "hover:text-purple-300" },
  Infrastructure: { chip: "bg-blue-400/10 text-blue-300 border-blue-400/20",        active: "bg-blue-400/15 text-blue-300 border-blue-400/30",       hover: "hover:text-blue-300" },
  Media:          { chip: "bg-orange-400/10 text-orange-300 border-orange-400/20",  active: "bg-orange-400/15 text-orange-300 border-orange-400/30", hover: "hover:text-orange-300" },
  Network:        { chip: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",        active: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",       hover: "hover:text-cyan-300" },
  Security:       { chip: "bg-rose-400/10 text-rose-300 border-rose-400/20",        active: "bg-rose-400/15 text-rose-300 border-rose-400/30",       hover: "hover:text-rose-300" },
};

const ALL_CATEGORIES: Category[] = ["AI", "Infrastructure", "Media", "Network", "Security"];

const DEFAULT_SETTINGS: DashboardSettings = {
  dashboardName: "Andre's Homelab",
  dashboardSubtitle: "Control Panel",
  dashboardIcon: "Server",
};

const API_BASE = "/api";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "Request failed");
    throw new Error(message || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusChip({ status }: { status: Status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border leading-none", cfg.chip)}>
      <span className={clsx("size-1.5 rounded-full flex-shrink-0", cfg.dot, status === "online" && "animate-pulse")} />
      {cfg.label}
    </span>
  );
}

function CategoryChip({ category }: { category: Category }) {
  return (
    <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border font-medium leading-none", CAT_CFG[category].chip)}>
      {category}
    </span>
  );
}

// ─── Service Card ────────────────────────────────────────────────────────────

function CheckingChip() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border leading-none bg-blue-400/10 text-blue-300 border-blue-400/20">
      <RefreshCw size={9} className="animate-spin" />
      Checking
    </span>
  );
}

function formatLastChecked(service: Service, isChecking: boolean) {
  if (isChecking) return "Checking now";
  if (!service.statusCheckEnabled || service.checkType === "None") return "Checks disabled";
  if (!service.lastCheckedAt) return "Not checked yet";

  const checkedAt = new Date(service.lastCheckedAt);
  const seconds = Math.max(0, Math.floor((Date.now() - checkedAt.getTime()) / 1000));
  const response = service.responseTimeMs != null ? `, ${service.responseTimeMs}ms` : "";

  if (seconds < 10) return `Checked just now${response}`;
  if (seconds < 60) return `Checked ${seconds}s ago${response}`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Checked ${minutes}m ago${response}`;

  const hours = Math.floor(minutes / 60);
  return `Checked ${hours}h ago${response}`;
}

function ServiceCard({ service, onEdit, manageMode, isChecking, selected, onSelect, onDragStart, onDragOver, onDrop }: {
  service: Service;
  onEdit: (s: Service) => void;
  manageMode: boolean;
  isChecking: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const Icon = ICON_MAP[service.icon] ?? Server;
  const hasServiceUrl = service.url.trim().length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasServiceUrl) return;
    navigator.clipboard.writeText(service.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasServiceUrl) return;
    window.open(service.url, "_blank", "noopener,noreferrer");
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(service);
  };

  return (
    <div className={clsx(
      "group relative overflow-hidden flex flex-col bg-card border rounded-lg p-3.5 transition-all duration-150 cursor-default",
      "hover:shadow-lg hover:shadow-black/25",
      selected
        ? "border-primary/55 ring-1 ring-primary/30 bg-primary/5"
        : manageMode ? "border-primary/30 ring-1 ring-primary/20" : "border-border hover:border-white/10 dark:hover:border-white/10"
    )}
      draggable={manageMode}
      onDragStart={() => onDragStart(service.id)}
      onDragOver={e => { if (manageMode) { e.preventDefault(); onDragOver(service.id); } }}
      onDrop={e => { if (manageMode) { e.preventDefault(); onDrop(); } }}
    >
      {isChecking && (
        <div className="absolute left-0 top-0 h-0.5 w-full bg-primary/20">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}

      {manageMode && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
          <button
            onClick={() => onSelect(service.id)}
            className="size-7 flex items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground hover:text-primary hover:border-primary/35 transition-colors"
            title={selected ? "Deselect service" : "Select service"}
          >
            {selected ? <CheckSquare size={14} /> : <Square size={14} />}
          </button>
          <div
            className="size-7 flex items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground cursor-grab"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="flex-shrink-0 size-8 rounded-md bg-muted flex items-center justify-center">
          <Icon size={15} className="text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-medium text-foreground leading-none truncate">{service.name}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-none truncate">{service.description}</p>
        </div>
      </div>

      {/* Chips row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <CategoryChip category={service.category} />
        {isChecking ? <CheckingChip /> : <StatusChip status={service.status} />}
        {!service.statusCheckEnabled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground/60 leading-none">
            No check
          </span>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/70 font-mono mb-2.5 leading-none truncate">
        {formatLastChecked(service, isChecking)}
      </p>

      {/* URL */}
      <div className="flex items-center gap-1.5 mb-3 bg-muted/40 border border-border rounded px-2 py-1.5">
        <Globe size={10} className="text-muted-foreground/60 flex-shrink-0" />
        <p className="text-[10px] font-mono text-muted-foreground truncate leading-none">
          {hasServiceUrl ? service.url : "No service URL"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-auto">
        <button
          onClick={handleOpen}
          disabled={!hasServiceUrl}
          className={clsx(
            "flex-1 flex items-center justify-center gap-1.5 h-7 px-2 rounded text-[11px] font-medium transition-colors",
            hasServiceUrl
              ? "bg-primary/10 hover:bg-primary/20 text-primary"
              : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          <ExternalLink size={11} strokeWidth={2} />
          Open
        </button>
        <button
          onClick={handleCopy}
          title="Copy URL"
          disabled={!hasServiceUrl}
          className={clsx(
            "size-7 flex items-center justify-center rounded border border-border transition-colors",
            hasServiceUrl
              ? "hover:border-white/12 hover:bg-white/5 text-muted-foreground hover:text-foreground"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          {copied
            ? <Check size={12} className="text-emerald-400" />
            : <Copy size={12} />}
        </button>
        <button
          onClick={handleEdit}
          title="Edit service"
          className="size-7 flex items-center justify-center rounded border border-border hover:border-white/12 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Edit2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── List Row ────────────────────────────────────────────────────────────────

function ServiceRow({ service, onEdit, isChecking, manageMode, selected, onSelect, onDragStart, onDragOver, onDrop }: {
  service: Service;
  onEdit: (s: Service) => void;
  isChecking: boolean;
  manageMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const Icon = ICON_MAP[service.icon] ?? Server;
  const hasServiceUrl = service.url.trim().length > 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasServiceUrl) return;
    navigator.clipboard.writeText(service.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={clsx(
        "relative overflow-hidden flex items-center gap-3 px-4 py-2.5 bg-card border rounded-lg hover:border-white/10 transition-all group",
        selected ? "border-primary/55 ring-1 ring-primary/30 bg-primary/5" : "border-border"
      )}
      draggable={manageMode}
      onDragStart={() => onDragStart(service.id)}
      onDragOver={e => { if (manageMode) { e.preventDefault(); onDragOver(service.id); } }}
      onDrop={e => { if (manageMode) { e.preventDefault(); onDrop(); } }}
    >
      {isChecking && <div className="absolute left-0 top-0 h-0.5 w-full bg-primary/40" />}
      {manageMode && (
        <>
          <button
            onClick={() => onSelect(service.id)}
            className="size-6 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/35 transition-colors"
            title={selected ? "Deselect service" : "Select service"}
          >
            {selected ? <CheckSquare size={13} /> : <Square size={13} />}
          </button>
          <GripVertical size={14} className="text-muted-foreground cursor-grab" />
        </>
      )}
      <div className="size-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <Icon size={13} className="text-muted-foreground" strokeWidth={1.75} />
      </div>
      <div className="w-40 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{service.name}</p>
      </div>
      <div className="flex-1 min-w-0 hidden sm:block">
        <p className="text-xs text-muted-foreground truncate">{service.description}</p>
      </div>
      <CategoryChip category={service.category} />
      {isChecking ? <CheckingChip /> : <StatusChip status={service.status} />}
      <p className="text-[10px] text-muted-foreground/70 font-mono w-36 truncate hidden xl:block">
        {formatLastChecked(service, isChecking)}
      </p>
      <p className="text-[10px] font-mono text-muted-foreground w-52 truncate hidden lg:block">
        {hasServiceUrl ? service.url : "No service URL"}
      </p>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
        <button
          onClick={() => hasServiceUrl && window.open(service.url, "_blank", "noopener,noreferrer")}
          disabled={!hasServiceUrl}
          className={clsx(
            "flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors",
            hasServiceUrl
              ? "bg-primary/10 hover:bg-primary/20 text-primary"
              : "bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          <ExternalLink size={10} strokeWidth={2} />
          Open
        </button>
        <button
          onClick={handleCopy}
          disabled={!hasServiceUrl}
          className={clsx(
            "size-6 flex items-center justify-center rounded border border-border transition-colors",
            hasServiceUrl
              ? "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              : "text-muted-foreground/30 cursor-not-allowed"
          )}
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
        <button
          onClick={() => onEdit(service)}
          className="size-6 flex items-center justify-center rounded border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Edit2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, accent, active = false, onClick, title }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      title={title}
      className={clsx(
        "flex items-center gap-3 bg-card border rounded-lg px-4 py-3 text-left transition-all",
        onClick && "cursor-pointer hover:bg-muted/20 hover:border-white/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active ? "border-primary/45 ring-1 ring-primary/25 bg-primary/5" : "border-border"
      )}
    >
      <div className={clsx("size-9 rounded-md flex items-center justify-center flex-shrink-0", accent)}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-semibold text-foreground leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{label}</p>
      </div>
    </Component>
  );
}

// ─── Toggle Switch ───────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className={clsx(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
        on ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={clsx(
        "inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
        on ? "translate-x-[18px]" : "translate-x-[3px]"
      )} />
    </button>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

const EMPTY: Omit<Service, "id"> = {
  name: "", description: "", category: "Infrastructure",
  url: "", healthUrl: "", checkType: "HTTP",
  icon: "Server", status: "unknown", statusCheckEnabled: true,
};

function EditModal({ service, onSave, onDelete, onClose }: {
  service: Service | null;
  onSave: (s: Service) => Promise<void> | void;
  onDelete: (service: Service) => void;
  onClose: () => void;
}) {
  const isNew = service === null;
  const [form, setForm] = useState<Omit<Service, "id">>(service ? { ...service } : { ...EMPTY });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await onSave({ ...form, id: service?.id ?? String(Date.now()) });
    onClose();
  };

  const handleDelete = () => {
    if (service) onDelete(service);
  };

  const inputCls = "w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-muted/60 transition-colors";
  const labelCls = "block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[480px] bg-card border border-border rounded-xl shadow-2xl shadow-black/40 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-primary/15 flex items-center justify-center">
              {isNew ? <Plus size={13} className="text-primary" /> : <Edit2 size={12} className="text-primary" />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">
                {isNew ? "Add Service" : `Edit — ${service.name}`}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
                {isNew ? "Register a new self-hosted service" : "Update service configuration"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Name + Icon */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className={labelCls}>Service Name *</label>
              <input
                className={inputCls}
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="e.g. Vaultwarden"
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Icon</label>
              <select
                className={inputCls}
                value={form.icon}
                onChange={e => set("icon", e.target.value)}
              >
                {Object.keys(ICON_MAP).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <input
              className={inputCls}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Short description of the service"
            />
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              value={form.category}
              onChange={e => set("category", e.target.value as Category)}
            >
              {ALL_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Service URL */}
          <div>
            <label className={labelCls}>Service URL</label>
            <input
              className={clsx(inputCls, "font-mono")}
              value={form.url}
              onChange={e => set("url", e.target.value)}
              placeholder="Optional for non-web devices"
            />
          </div>

          {/* Health Check URL + Type */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <label className={labelCls}>Health Check URL</label>
              <input
                className={clsx(inputCls, "font-mono")}
                value={form.healthUrl}
                onChange={e => set("healthUrl", e.target.value)}
                placeholder={
                  form.checkType === "Ping"
                    ? "192.168.0.102 or eap610.lan"
                    : form.checkType === "TCP"
                      ? "192.168.0.50:22"
                      : "https://service.lan/health"
                }
              />
            </div>
            <div>
              <label className={labelCls}>Check Type</label>
              <select
                className={inputCls}
                value={form.checkType}
                onChange={e => set("checkType", e.target.value as CheckType)}
              >
                {(["HTTP", "Ping", "TCP", "None"] as CheckType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status monitoring toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/25 rounded-lg border border-border">
            <div>
              <p className="text-xs font-medium text-foreground">Status Monitoring</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Periodically check service health</p>
            </div>
            <Toggle on={form.statusCheckEnabled} onToggle={() => set("statusCheckEnabled", !form.statusCheckEnabled)} />
          </div>

          {/* Icon preview */}
          {(() => {
            const PreviewIcon = ICON_MAP[form.icon] ?? Server;
            return (
              <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border border-dashed">
                <div className="size-9 rounded-md bg-muted flex items-center justify-center">
                  <PreviewIcon size={16} className="text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryChip category={form.category} />
                  <StatusChip status={form.status} />
                </div>
                <p className="text-xs font-medium text-foreground ml-1">{form.name || "Service Name"}</p>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border flex-shrink-0">
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                className={clsx(
                  "text-xs px-2 py-1 rounded transition-colors",
                  "text-muted-foreground/60 hover:text-red-400 hover:bg-red-400/10"
                )}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-7 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="h-7 px-4 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isNew ? "Add Service" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Category Group Header ────────────────────────────────────────────────────

function DeleteConfirmModal({ action, onCancel, onConfirm }: {
  action: ConfirmAction;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const count = action.ids.length;
  const visibleNames = action.names.slice(0, 5);
  const extra = Math.max(0, action.names.length - visibleNames.length);
  const title = count === 1 ? "Delete service?" : `Delete ${count} services?`;
  const buttonText = count === 1 ? "Delete Service" : `Delete ${count} Services`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-[420px] bg-card border border-border rounded-xl shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <div className="size-8 rounded-md bg-red-400/10 flex items-center justify-center flex-shrink-0">
            <Trash2 size={15} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground leading-none">{title}</h2>
            <p className="text-xs text-muted-foreground mt-2 leading-snug">
              This will remove the selected service{count === 1 ? "" : "s"} from your dashboard. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
            {visibleNames.map(name => (
              <p key={name} className="text-xs text-foreground truncate">{name}</p>
            ))}
            {extra > 0 && (
              <p className="text-xs text-muted-foreground">and {extra} more</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            className="h-8 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-8 px-3 text-xs rounded-md bg-red-500 text-white hover:bg-red-500/90 transition-colors font-medium"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardSettingsModal({ settings, onSave, onClose }: {
  settings: DashboardSettings;
  onSave: (settings: DashboardSettings) => Promise<void> | void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DashboardSettings>(settings);
  const PreviewIcon = ICON_MAP[form.dashboardIcon] ?? Server;
  const inputCls = "w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-muted/60 transition-colors";
  const labelCls = "block text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide";

  const set = <K extends keyof DashboardSettings>(k: K, v: DashboardSettings[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.dashboardName.trim()) return;
    await onSave({
      dashboardName: form.dashboardName.trim(),
      dashboardSubtitle: form.dashboardSubtitle.trim(),
      dashboardIcon: form.dashboardIcon,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[460px] bg-card border border-border rounded-xl shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-md bg-primary/15 flex items-center justify-center">
              <Edit2 size={12} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">Dashboard Settings</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Customize header identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>Dashboard Name *</label>
            <input
              className={inputCls}
              value={form.dashboardName}
              onChange={e => set("dashboardName", e.target.value)}
              placeholder="Andre's Homelab"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className={labelCls}>Subtitle</label>
              <input
                className={inputCls}
                value={form.dashboardSubtitle}
                onChange={e => set("dashboardSubtitle", e.target.value)}
                placeholder="Control Panel"
              />
            </div>
            <div>
              <label className={labelCls}>Icon</label>
              <select
                className={inputCls}
                value={form.dashboardIcon}
                onChange={e => set("dashboardIcon", e.target.value)}
              >
                {Object.keys(ICON_MAP).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg border border-border border-dashed">
            <div className="size-9 rounded-md bg-primary/20 flex items-center justify-center">
              <PreviewIcon size={16} className="text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none truncate">{form.dashboardName || "Dashboard Name"}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-1 font-mono truncate">{form.dashboardSubtitle || "Subtitle"}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="h-8 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.dashboardName.trim()}
            className="h-8 px-3 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupHeader({ category, count }: { category: Category; count: number }) {
  const cfg = CAT_CFG[category];
  return (
    <div className="flex items-center gap-2 mt-2 mb-3">
      <span className={clsx("text-xs font-semibold uppercase tracking-widest", cfg.chip.split(" ").find(c => c.startsWith("text-")))}>{category}</span>
      <span className="text-[10px] text-muted-foreground font-mono">{count}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [services, setServices] = useState<Service[]>([]);
  const [modalService, setModalService] = useState<Service | "new" | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [manageMode, setManageMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [grouped, setGrouped] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const loadServices = async () => {
    try {
      setServices(await apiRequest<Service[]>("/services"));
    } catch (error) {
      console.error("Failed to load services", error);
    }
  };

  const loadSettings = async () => {
    try {
      setDashboardSettings(await apiRequest<DashboardSettings>("/settings"));
    } catch (error) {
      console.error("Failed to load dashboard settings", error);
    }
  };

  const replaceService = (service: Service) => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === service.id);
      if (idx < 0) return [...prev, service];
      const next = [...prev];
      next[idx] = service;
      return next;
    });
  };

  const markChecking = (ids: string[], checking: boolean) => {
    setCheckingIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checking) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const checkService = async (id: string) => {
    markChecking([id], true);
    try {
      replaceService(await apiRequest<Service>(`/services/${id}/check`, { method: "POST" }));
    } catch (error) {
      console.error("Failed to check service", error);
    } finally {
      markChecking([id], false);
    }
  };

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Services
  useEffect(() => {
    loadServices();
    loadSettings();
    const refreshStatuses = async () => {
      if (services.length === 0) return;
      setIsRefreshingAll(true);
      const ids = services.map(s => s.id);
      markChecking(ids, true);
      try {
        const checked = await apiRequest<Service[]>("/services/check-all", { method: "POST" });
        setServices(checked);
      } catch (error) {
        console.error("Failed to refresh service statuses", error);
      } finally {
        setIsRefreshingAll(false);
        markChecking(ids, false);
      }
    };
    refreshStatuses();
    const t = setInterval(refreshStatuses, 60000);
    return () => clearInterval(t);
  }, [services.length]);

  useEffect(() => {
    if (manageMode) return;
    setSelectedIds(new Set());
  }, [manageMode]);

  useEffect(() => {
    if (draggedId || !orderDirty) return;

    const saveOrder = async () => {
      try {
        const ordered = await apiRequest<Service[]>("/services/reorder", {
          method: "POST",
          body: JSON.stringify({ ids: services.map(service => service.id) }),
        });
        setServices(ordered);
      } catch (error) {
        console.error("Failed to save service order", error);
        loadServices();
      } finally {
        setOrderDirty(false);
      }
    };

    saveOrder();
  }, [draggedId, orderDirty, services]);

  // Filter
  const filtered = services.filter(s => {
    const matchCat = activeCategory === "All" || s.category === activeCategory;
    const matchStatus =
      statusFilter === "all" ||
      s.status === statusFilter ||
      (statusFilter === "degraded" && (s.status === "slow" || s.status === "unknown"));
    const q = search.toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.url.toLowerCase().includes(q) ||
      s.healthUrl.toLowerCase().includes(q);
    return matchCat && matchStatus && matchSearch;
  });

  // Stats
  const stats = {
    total:      services.length,
    online:     services.filter(s => s.status === "online").length,
    offline:    services.filter(s => s.status === "offline").length,
    degraded:   services.filter(s => s.status === "slow" || s.status === "unknown").length,
    categories: new Set(services.map(s => s.category)).size,
  };

  const handleSave = async (updated: Service) => {
    const exists = services.some(s => s.id === updated.id);
    const saved = exists
      ? await apiRequest<Service>(`/services/${updated.id}`, { method: "PATCH", body: JSON.stringify(updated) })
      : await apiRequest<Service>("/services", { method: "POST", body: JSON.stringify(updated) });

    replaceService(saved);
    if (saved.statusCheckEnabled && saved.checkType !== "None") {
      checkService(saved.id);
    }
  };

  const deleteServices = async (ids: string[]) => {
    await Promise.all(ids.map(id => apiRequest<void>(`/services/${id}`, { method: "DELETE" })));
    setServices(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const requestSingleDelete = (service: Service) => {
    setConfirmAction({ type: "single-delete", ids: [service.id], names: [service.name] });
  };

  const requestBulkDelete = () => {
    const ids = [...selectedIds];
    const names = services.filter(service => selectedIds.has(service.id)).map(service => service.name);
    if (ids.length > 0) setConfirmAction({ type: "bulk-delete", ids, names });
  };

  const confirmDelete = async () => {
    if (!confirmAction) return;
    await deleteServices(confirmAction.ids);
    setConfirmAction(null);
    if (confirmAction.type === "single-delete") {
      setModalService(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const service of filtered) next.add(service.id);
      return next;
    });
  };

  const reorderService = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    setServices(prev => {
      const from = prev.findIndex(service => service.id === draggedId);
      const to = prev.findIndex(service => service.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((service, index) => ({ ...service, displayOrder: index }));
    });
    setOrderDirty(true);
  };

  const finishDrag = () => {
    setDraggedId(null);
  };

  const toggleStatusFilter = (filter: StatusFilter) => {
    setStatusFilter(current => current === filter ? "all" : filter);
  };

  const showAllServices = () => {
    setStatusFilter("all");
    setActiveCategory("All");
  };

  const handleHeaderClick = () => {
    if (manageMode) {
      setSettingsModalOpen(true);
      return;
    }

    setSearch("");
    setStatusFilter("all");
    setActiveCategory("All");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSettingsSave = async (settings: DashboardSettings) => {
    setDashboardSettings(await apiRequest<DashboardSettings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }));
  };

  const visibleSelectedCount = filtered.filter(service => selectedIds.has(service.id)).length;

  const modalServiceObj = modalService === "new" ? null : modalService;

  const dateStr = currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const HeaderIcon = ICON_MAP[dashboardSettings.dashboardIcon] ?? Server;

  // Group filtered services by category
  const groupedServices = ALL_CATEGORIES
    .map(cat => ({ cat, services: filtered.filter(s => s.category === cat) }))
    .filter(g => g.services.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto px-4 h-13 flex items-center gap-3" style={{ height: "52px" }}>

          {/* Logo + Title */}
          <button
            onClick={handleHeaderClick}
            className={clsx(
              "flex items-center gap-2 flex-shrink-0 mr-1 rounded-lg -ml-1 px-1 py-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              manageMode ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
            )}
            title={manageMode ? "Edit dashboard header" : "Show all services"}
          >
            <div className={clsx(
              "size-7 rounded-md flex items-center justify-center transition-colors",
              manageMode ? "bg-primary/25 ring-1 ring-primary/30" : "bg-primary/20"
            )}>
              <HeaderIcon size={13} className="text-primary" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-none truncate max-w-[190px]">{dashboardSettings.dashboardName}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-mono truncate max-w-[190px]">
                {manageMode ? "Manage Mode" : dashboardSettings.dashboardSubtitle}
              </p>
            </div>
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-border flex-shrink-0" />

          {/* Search */}
          <div className="flex-1 max-w-xs relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services…"
              className="w-full h-8 pl-8 pr-7 bg-muted/40 border border-border rounded-md text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:bg-muted/60 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Clock */}
          <div className="text-right flex-shrink-0 hidden md:block">
            <p className="text-[10px] text-muted-foreground font-mono leading-none">{dateStr}</p>
            <p className="text-xs text-foreground font-mono leading-none mt-0.5 tabular-nums">{timeStr}</p>
          </div>

          <div className="h-5 w-px bg-border flex-shrink-0 hidden md:block" />

          {/* View Mode */}
          <div className="flex items-center border border-border rounded-md overflow-hidden flex-shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={clsx(
                "size-7 flex items-center justify-center transition-colors",
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              title="Grid view"
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={clsx(
                "size-7 flex items-center justify-center border-l border-border transition-colors",
                viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              title="List view"
            >
              <List size={13} />
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            className="size-7 flex items-center justify-center rounded-md border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Manage Dashboard */}
          <button
            onClick={() => setManageMode(m => !m)}
            className={clsx(
              "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs border transition-colors flex-shrink-0",
              manageMode
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <Edit2 size={11} />
            <span className="hidden sm:inline">{manageMode ? "Done" : "Manage"}</span>
          </button>

          {/* Add Service */}
          <button
            onClick={() => setModalService("new")}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Plus size={12} strokeWidth={2.5} />
            <span className="hidden sm:inline">Add Service</span>
          </button>
        </div>
      </header>

      {/* ─── Main ────────────────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-4 py-4 space-y-4">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <StatCard
            label="Total Services"
            value={stats.total}
            accent="bg-blue-400/10"
            icon={<Server size={15} className="text-blue-400" strokeWidth={1.75} />}
            active={statusFilter === "all" && activeCategory === "All"}
            onClick={showAllServices}
            title="Show all services"
          />
          <StatCard
            label="Online"
            value={stats.online}
            accent="bg-emerald-400/10"
            icon={<Zap size={15} className="text-emerald-400" strokeWidth={1.75} />}
            active={statusFilter === "online"}
            onClick={() => toggleStatusFilter("online")}
            title="Filter online services"
          />
          <StatCard
            label="Offline"
            value={stats.offline}
            accent="bg-red-400/10"
            icon={<AlertTriangle size={15} className="text-red-400" strokeWidth={1.75} />}
            active={statusFilter === "offline"}
            onClick={() => toggleStatusFilter("offline")}
            title="Filter offline services"
          />
          <StatCard
            label="Slow / Unknown"
            value={stats.degraded}
            accent="bg-amber-400/10"
            icon={<Clock size={15} className="text-amber-400" strokeWidth={1.75} />}
            active={statusFilter === "degraded"}
            onClick={() => toggleStatusFilter("degraded")}
            title="Filter slow or unknown services"
          />
          <StatCard
            label="Categories"
            value={stats.categories}
            accent="bg-purple-400/10"
            icon={<Layers size={15} className="text-purple-400" strokeWidth={1.75} />}
            active={grouped}
            onClick={() => setGrouped(g => !g)}
            title="Toggle category grouping"
          />
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mr-0.5">Filter</span>

          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
              title="Clear status filter"
            >
              {statusFilter === "online" ? "Online" : statusFilter === "offline" ? "Offline" : "Slow / Unknown"}
              <X size={11} />
            </button>
          )}

          {/* All */}
          <button
            onClick={() => setActiveCategory("All")}
            className={clsx(
              "h-7 px-2.5 rounded text-xs font-medium border transition-colors",
              activeCategory === "All"
                ? "bg-white/10 text-foreground border-white/20"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            All
            <span className="ml-1.5 text-[10px] opacity-55 font-mono">{services.length}</span>
          </button>

          {ALL_CATEGORIES.map(cat => {
            const cfg = CAT_CFG[cat];
            const count = services.filter(s => s.category === cat).length;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  "h-7 px-2.5 rounded text-xs font-medium border transition-colors",
                  isActive ? cfg.active : `border-border text-muted-foreground ${cfg.hover} hover:border-border`
                )}
              >
                {cat}
                <span className="ml-1.5 text-[10px] opacity-55 font-mono">{count}</span>
              </button>
            );
          })}

          <div className="flex-1" />

          {/* Group toggle */}
          {viewMode === "grid" && (
            <button
              onClick={() => setGrouped(g => !g)}
              className={clsx(
                "flex items-center gap-1.5 h-7 px-2.5 rounded text-xs border transition-colors",
                grouped
                  ? "bg-muted text-foreground border-border"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <Layers size={11} />
              {grouped ? "Ungrouped" : "Group"}
            </button>
          )}

          <p className="text-[11px] text-muted-foreground font-mono">
            {isRefreshingAll && (
              <span className="inline-flex items-center gap-1 mr-3 text-primary">
                <RefreshCw size={10} className="animate-spin" />
                Refreshing statuses
              </span>
            )}
            {filtered.length} service{filtered.length !== 1 ? "s" : ""}
            {search && <span className="opacity-70"> • "{search}"</span>}
          </p>
        </div>

        {/* ─── Service Grid / List ─────────────────────────────────────────────── */}
        {manageMode && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <GripVertical size={13} />
              <span className="font-mono">{selectedIds.size} selected</span>
              {visibleSelectedCount > 0 && (
                <span className="font-mono opacity-70">({visibleSelectedCount} visible)</span>
              )}
            </div>
            <div className="flex-1" />
            <button
              onClick={selectVisible}
              disabled={filtered.length === 0}
              className="h-7 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Select Visible
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
              className="h-7 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
            <button
              onClick={requestBulkDelete}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-red-400/25 bg-red-400/10 text-xs text-red-300 hover:bg-red-400/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={12} />
              Delete Selected
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Server size={28} className="mb-3 opacity-20" strokeWidth={1.5} />
            <p className="text-sm font-medium">No services found</p>
            {search && <p className="text-xs mt-1 opacity-50">Try a different search term</p>}
          </div>
        ) : viewMode === "list" ? (
          <div className="space-y-1.5">
            {filtered.map(s => (
              <ServiceRow
                key={s.id}
                service={s}
                onEdit={svc => setModalService(svc)}
                isChecking={checkingIds.has(s.id)}
                manageMode={manageMode}
                selected={selectedIds.has(s.id)}
                onSelect={toggleSelected}
                onDragStart={setDraggedId}
                onDragOver={reorderService}
                onDrop={finishDrag}
              />
            ))}
          </div>
        ) : grouped ? (
          /* Grouped view */
          <div className="space-y-2">
            {groupedServices.map(({ cat, services: catServices }) => (
              <div key={cat}>
                <GroupHeader category={cat} count={catServices.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {catServices.map(s => (
                    <ServiceCard
                      key={s.id}
                      service={s}
                      onEdit={svc => setModalService(svc)}
                      manageMode={manageMode}
                      isChecking={checkingIds.has(s.id)}
                      selected={selectedIds.has(s.id)}
                      onSelect={toggleSelected}
                      onDragStart={setDraggedId}
                      onDragOver={reorderService}
                      onDrop={finishDrag}
                    />
                  ))}
                </div>
              </div>
            ))}
            {manageMode && (
              <button
                onClick={() => setModalService("new")}
                className="flex items-center gap-2 h-9 px-4 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary text-xs font-medium transition-colors mt-2"
              >
                <Plus size={14} />
                Add Service
              </button>
            )}
          </div>
        ) : (
          /* Flat grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filtered.map(s => (
              <ServiceCard
                key={s.id}
                service={s}
                onEdit={svc => setModalService(svc)}
                manageMode={manageMode}
                isChecking={checkingIds.has(s.id)}
                selected={selectedIds.has(s.id)}
                onSelect={toggleSelected}
                onDragStart={setDraggedId}
                onDragOver={reorderService}
                onDrop={finishDrag}
              />
            ))}
            {manageMode && (
              <button
                onClick={() => setModalService("new")}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg min-h-[164px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                <Plus size={18} strokeWidth={1.5} />
                <span className="text-xs font-medium">Add Service</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* ─── Modal ───────────────────────────────────────────────────────────── */}
      {modalService !== null && (
        <EditModal
          service={modalServiceObj}
          onSave={handleSave}
          onDelete={requestSingleDelete}
          onClose={() => setModalService(null)}
        />
      )}

      {settingsModalOpen && (
        <DashboardSettingsModal
          settings={dashboardSettings}
          onSave={handleSettingsSave}
          onClose={() => setSettingsModalOpen(false)}
        />
      )}

      {confirmAction && (
        <DeleteConfirmModal
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* Scrollbar suppression */}
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
      `}</style>
    </div>
  );
}
