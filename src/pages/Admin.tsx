import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ToggleLeft, ToggleRight, Key, RefreshCw,
  Eye, EyeOff, CheckCircle, AlertCircle, Settings, Pencil, X,
  CreditCard, Zap, Save,
} from 'lucide-react';
import { FUNCTIONS_BASE, supabase } from '../lib/supabase';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  usage_count: number;
  credits: number;
  last_used_at: string | null;
  created_at: string;
}

interface EditModalProps {
  apiKey: ApiKey;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Pick<ApiKey, 'name' | 'key' | 'credits'>>) => Promise<void>;
}

function EditModal({ apiKey, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(apiKey.name);
  const [key, setKey] = useState('');
  const [credits, setCredits] = useState(String(apiKey.credits));
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updates: Partial<Pick<ApiKey, 'name' | 'key' | 'credits'>> = {};
      if (name.trim() && name.trim() !== apiKey.name) updates.name = name.trim();
      if (key.trim()) updates.key = key.trim();
      const parsedCredits = parseFloat(credits);
      if (!isNaN(parsedCredits) && parsedCredits !== apiKey.credits) updates.credits = parsedCredits;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }
      await onSave(apiKey.id, updates);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Pencil size={15} className="text-cyan-400" />
            <span className="text-white font-semibold">Edit API Key</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Label</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production Key 1"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              API Key <span className="text-slate-600 normal-case font-normal">(leave blank to keep current)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="Enter new key to replace..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Credits Balance</label>
            <div className="relative">
              <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={credits}
                onChange={e => setCredits(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <p className="text-xs text-slate-600 mt-1">Enter the current credit balance from your Freepik dashboard</p>
          </div>

          {error && (
            <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 flex items-center gap-2">
              <AlertCircle size={13} />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold transition-all active:scale-[0.98]"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}

export default function Admin() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyCredits, setNewKeyCredits] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys`, {
        headers: auth,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeys(data.data || []);
    } catch (err) {
      showFeedback('error', (err as Error).message || 'Failed to fetch keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyValue.trim()) return;
    setAdding(true);
    try {
      const auth = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          name: newKeyName.trim() || 'Unnamed Key',
          key: newKeyValue.trim(),
          credits: parseFloat(newKeyCredits) || 0,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setNewKeyName('');
      setNewKeyValue('');
      setNewKeyCredits('');
      showFeedback('success', 'API key added successfully.');
      fetchKeys();
    } catch (err) {
      showFeedback('error', (err as Error).message || 'Failed to add key');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(key: ApiKey) {
    try {
      const auth = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys/${key.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ is_active: !key.is_active }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setKeys(prev => prev.map(k => k.id === key.id ? { ...k, is_active: !k.is_active } : k));
    } catch (err) {
      showFeedback('error', (err as Error).message || 'Failed to toggle key');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const auth = await getAuthHeaders();
      const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys/${id}`, {
        method: 'DELETE',
        headers: auth,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      setKeys(prev => prev.filter(k => k.id !== id));
      showFeedback('success', 'API key deleted.');
    } catch (err) {
      showFeedback('error', (err as Error).message || 'Failed to delete key');
    }
  }

  async function handleSaveEdit(id: string, updates: Partial<Pick<ApiKey, 'name' | 'key' | 'credits'>>) {
    const auth = await getAuthHeaders();
    const res = await fetch(`${FUNCTIONS_BASE}/admin-api-keys/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    showFeedback('success', 'API key updated.');
    fetchKeys();
  }

  const activeKeys = keys.filter(k => k.is_active);
  const totalCredits = keys.reduce((sum, k) => sum + (k.credits || 0), 0);
  const activeCredits = activeKeys.reduce((sum, k) => sum + (k.credits || 0), 0);

  return (
    <div className="pb-16 px-4 pt-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-sm font-medium mb-3">
              <Settings size={14} />
              Admin Panel
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">My API Keys</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your Freepik API keys for image and video generation</p>
          </div>
          <button
            onClick={fetchKeys}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Total Keys</p>
            <p className="text-2xl font-bold text-white">{keys.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1">Active Keys</p>
            <p className="text-2xl font-bold text-emerald-400">{activeKeys.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1">
              <Zap size={11} className="text-cyan-400" />
              Active Credits
            </p>
            <p className="text-2xl font-bold text-cyan-400">{activeCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs font-medium mb-1 flex items-center gap-1">
              <CreditCard size={11} className="text-blue-400" />
              Total Credits
            </p>
            <p className="text-2xl font-bold text-blue-400">{totalCredits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {feedback && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-5 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {feedback.msg}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus size={16} className="text-cyan-400" />
            Add New API Key
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Label (e.g. Production Key 1)"
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <div className="relative">
                <input
                  type={showNewKey ? 'text' : 'password'}
                  value={newKeyValue}
                  onChange={e => setNewKeyValue(e.target.value)}
                  placeholder="Freepik API key"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNewKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-[200px]">
                <CreditCard size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newKeyCredits}
                  onChange={e => setNewKeyCredits(e.target.value)}
                  placeholder="Credits (e.g. 100)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={adding || !newKeyValue.trim()}
                className="flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm active:scale-[0.98]"
              >
                {adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                {adding ? 'Adding...' : 'Add Key'}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
            <Key size={15} className="text-slate-400" />
            <h2 className="text-white font-semibold">API Keys</h2>
            <span className="ml-auto text-xs text-slate-500">{keys.length} total</span>
          </div>

          {loading && keys.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
              Loading keys...
            </div>
          ) : keys.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Key size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No API keys yet</p>
              <p className="text-sm mt-1">Add your first Freepik API key above</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {keys.map(key => (
                <div
                  key={key.id}
                  className={`px-5 py-4 transition-colors ${key.is_active ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${key.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{key.name}</p>
                        <p className="text-slate-500 text-xs font-mono mt-0.5 truncate">{key.key}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                            <CreditCard size={10} />
                            {(key.credits || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} credits
                          </span>
                          <span className="text-slate-600 text-xs">{key.usage_count} uses</span>
                          <span className="text-slate-600 text-xs">
                            {key.last_used_at
                              ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}`
                              : 'Never used'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingKey(key)}
                        className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                        title="Edit key"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleToggle(key)}
                        className={`p-1 transition-colors ${key.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'}`}
                        title={key.is_active ? 'Disable key' : 'Enable key'}
                      >
                        {key.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title="Delete key"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-slate-600 text-xs">
          Keys are rotated automatically using least-usage-first strategy
        </div>
      </div>

      {editingKey && (
        <EditModal
          apiKey={editingKey}
          onClose={() => setEditingKey(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
