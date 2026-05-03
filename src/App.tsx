import { useState, useEffect, useCallback } from 'react';
import ImageGen from './pages/ImageGen';
import VideoGen from './pages/VideoGen';
import Admin from './pages/Admin';
import AdminUsers from './pages/AdminUsers';
import Login from './pages/Login';
import { useAuth } from './lib/AuthContext';
import {
  Zap, CheckCircle, Clock, AlertCircle, Loader,
  X, Download, Copy, RotateCcw, Play, ChevronLeft, Menu, Image, Video, Wand2, CreditCard,
  LogOut, Users, Key, Shield,
} from 'lucide-react';
import { supabase, FUNCTIONS_BASE } from './lib/supabase';

type Page = 'image' | 'video' | 'admin-keys' | 'admin-users';

export interface HistoryItem {
  id: string;
  type: 'image' | 'video';
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model: string;
  parameters: Record<string, unknown>;
  result_url: string | null;
  error_message: string | null;
  cost: number;
  created_at: string;
  updated_at: string;
}

interface PreviewModalProps {
  item: HistoryItem;
  onClose: () => void;
  onReusePrompt: (prompt: string, type: 'image' | 'video') => void;
}

function PreviewModal({ item, onClose, onReusePrompt }: PreviewModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleDownload() {
    if (!item.result_url) return;
    const ext = item.type === 'video' ? 'mp4' : ((item.parameters?.output_format as string) || 'png');
    const filename = `freepik-${item.type}-${Date.now()}.${ext}`;
    try {
      const res = await fetch(item.result_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.result_url, '_blank');
    }
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(item.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReuse() {
    onReusePrompt(item.prompt, item.type);
    onClose();
  }

  const params = item.parameters as Record<string, string>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {item.type === 'image'
              ? <Image size={16} className="text-cyan-400" />
              : <Video size={16} className="text-blue-400" />}
            <span className="text-white font-semibold capitalize">{item.type} Generation</span>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
              'bg-cyan-500/20 text-cyan-400'
            }`}>{item.status}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Media */}
        <div className="p-5">
          {item.result_url ? (
            <div className="rounded-xl overflow-hidden bg-slate-800 mb-5">
              {item.type === 'video' ? (
                <video
                  src={item.result_url}
                  controls
                  className="w-full max-h-[50vh] object-contain"
                  autoPlay
                />
              ) : (
                <img
                  src={item.result_url}
                  alt={item.prompt}
                  className="w-full max-h-[50vh] object-contain"
                />
              )}
            </div>
          ) : item.status === 'failed' ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-6 mb-5 text-center">
              <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
              <p className="text-red-400 font-medium mb-1">Generation Failed</p>
              <p className="text-slate-400 text-sm">{item.error_message || 'An unknown error occurred'}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-800 p-10 mb-5 flex flex-col items-center justify-center gap-3">
              <Loader size={32} className="text-cyan-400 animate-spin" />
              <p className="text-slate-400 text-sm capitalize">{item.status}...</p>
            </div>
          )}

          {/* Prompt */}
          <div className="mb-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Prompt</p>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed border border-slate-700">
              {item.prompt}
            </div>
          </div>

          {/* Params */}
          {Object.keys(params).filter(k => !['task_id', 'key_id', 'credit_cost'].includes(k)).length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-2">Parameters</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(params)
                  .filter(([k]) => k !== 'task_id')
                  .map(([k, v]) => (
                    <div key={k} className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
                      <p className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-white font-medium mt-0.5">{String(v)}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {item.result_url && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-medium transition-colors"
              >
                <Download size={15} />
                Download {item.type === 'video' ? 'Video' : 'Image'}
              </button>
            )}
            <button
              onClick={handleCopyPrompt}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Copy size={15} />
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
            <button
              onClick={handleReuse}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-sm font-medium transition-colors"
            >
              <RotateCcw size={15} />
              Reuse Prompt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, profile, loading: authLoading, isAdmin, signOut } = useAuth();
  const [page, setPage] = useState<Page>('image');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [reusePrompt, setReusePrompt] = useState<{ prompt: string; type: 'image' | 'video' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalCredits, setTotalCredits] = useState<number | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const fetchCredits = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys/credits-summary`, { headers });
      if (res.ok) {
        const json = await res.json();
        setTotalCredits(json.total ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  const pollProcessingItems = useCallback(async (items: HistoryItem[]) => {
    const processing = items.filter(
      i => (i.status === 'processing' || i.status === 'pending') && i.parameters?.task_id
    );
    if (processing.length === 0) return;

    await Promise.allSettled(
      processing.map(async (item) => {
        try {
          const res = await fetch(`${FUNCTIONS_BASE}/freepik-poll-task`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              task_id: item.parameters.task_id,
              history_id: item.id,
              model: item.model,
            }),
          });
          await res.json();
        } catch { /* next cycle */ }
      })
    );
  }, []);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('generation_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      const items = data as HistoryItem[];
      setHistory(items);
      pollProcessingItems(items);
    }
  }, [pollProcessingItems]);

  useEffect(() => {
    if (!user) return;
    fetchHistory();
    fetchCredits();
    const interval = setInterval(() => {
      fetchHistory();
      fetchCredits();
    }, 5000);
    return () => clearInterval(interval);
  }, [user, fetchHistory, fetchCredits]);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle size={14} className="text-green-400" />;
      case 'processing':
      case 'pending': return <Loader size={14} className="text-cyan-400 animate-spin" />;
      case 'failed': return <AlertCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  }

  function handleReusePrompt(prompt: string, type: 'image' | 'video') {
    setReusePrompt({ prompt, type });
    setPage(type);
    setSidebarOpen(true);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader size={28} className="text-cyan-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (page === 'admin-keys' || page === 'admin-users') {
    const title = page === 'admin-keys' ? 'My API Keys' : 'User Management';
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="border-b border-slate-800 bg-slate-900/50 px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => { setPage('image'); fetchCredits(); }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <span className="text-white font-semibold">{title}</span>
        </div>
        {page === 'admin-keys' ? <Admin /> : <AdminUsers />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/50 z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Zap size={15} className="text-white" />
            </div>
            <h1 className="text-white font-bold text-base truncate">FreepikAI</h1>
            <p className="text-slate-500 text-xs ml-2 hidden sm:block">Transform ideas into visuals</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalCredits !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-cyan-400">
                <CreditCard size={13} />
                {totalCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-slate-500 font-normal">cr</span>
              </div>
            )}
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-7 h-7 rounded-full bg-slate-700 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                    {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
                  </div>
                )}
                {profile?.role === 'admin' && (
                  <Shield size={12} className="text-amber-400" />
                )}
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-white text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
                      <p className="text-slate-400 text-xs truncate">{profile?.email}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1.5 ${
                        profile?.role === 'admin'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                      }`}>
                        {profile?.role === 'admin' ? <Shield size={9} /> : null}
                        {profile?.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={() => { setPage('admin-keys'); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 text-sm transition-colors text-left"
                      >
                        <Key size={15} />
                        My API Keys
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => { setPage('admin-users'); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 text-sm transition-colors text-left"
                        >
                          <Users size={15} />
                          Users
                        </button>
                      )}
                      <button
                        onClick={() => { signOut(); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-sm transition-colors text-left"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
            >
              <Menu size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-80 lg:w-72 xl:w-80
          border-r border-slate-800 bg-slate-900 lg:bg-slate-900/30 overflow-y-auto
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          top-14 lg:top-auto
        `}>
          <div className="lg:hidden flex items-center justify-between px-4 pt-3 pb-1">
            <span className="text-white font-semibold text-sm">Generator</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="p-3 flex gap-2 border-b border-slate-800">
            <button
              onClick={() => setPage('image')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                page === 'image' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Image size={14} />
              Image
            </button>
            <button
              onClick={() => setPage('video')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                page === 'video' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Play size={14} />
              Video
            </button>
          </div>

          {page === 'image' && (
            <ImageGen
              reusePrompt={reusePrompt?.type === 'image' ? reusePrompt.prompt : undefined}
              onReuseConsumed={() => setReusePrompt(null)}
            />
          )}
          {page === 'video' && (
            <VideoGen
              reusePrompt={reusePrompt?.type === 'video' ? reusePrompt.prompt : undefined}
              onReuseConsumed={() => setReusePrompt(null)}
            />
          )}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">
              History
              <span className="ml-2 text-sm font-normal text-slate-500">({history.length})</span>
            </h2>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-medium transition-colors"
            >
              <Wand2 size={13} />
              Generate
            </button>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                <Zap size={24} className="text-slate-600" />
              </div>
              <p className="text-slate-400 font-medium mb-1">No generations yet</p>
              <p className="text-slate-600 text-sm">Open the generator and create your first image or video.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="aspect-square bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col items-center justify-center relative group hover:border-slate-500 hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {item.result_url ? (
                    <>
                      {item.type === 'video' ? (
                        <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                          <video src={item.result_url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                              <Play size={16} className="text-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={item.result_url} alt={item.prompt} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-xs text-white line-clamp-2 leading-tight">{item.prompt}</p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Download size={11} className="text-slate-300" />
                          <Copy size={11} className="text-slate-300" />
                          <RotateCcw size={11} className="text-slate-300" />
                        </div>
                      </div>
                    </>
                  ) : item.status === 'failed' ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 px-3 text-center">
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-red-400 font-medium">Failed</span>
                      <span className="text-xs text-slate-500 line-clamp-2">{item.error_message || 'Generation failed'}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 px-2">
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-slate-400 capitalize">{item.status}</span>
                      <span className="text-xs text-slate-500 text-center line-clamp-2">{item.prompt}</span>
                    </div>
                  )}

                  <div className={`absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded-md font-medium ${
                    item.type === 'video' ? 'bg-blue-500/80 text-white' : 'bg-cyan-500/80 text-white'
                  }`}>
                    {item.type === 'video' ? 'VID' : 'IMG'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {selected && (
        <PreviewModal
          item={selected}
          onClose={() => setSelected(null)}
          onReusePrompt={handleReusePrompt}
        />
      )}
    </div>
  );
}

export default App;
