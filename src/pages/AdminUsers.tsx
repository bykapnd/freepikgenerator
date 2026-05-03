import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, ShieldOff, RefreshCw, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/AuthContext';

type SortField = 'created_at' | 'last_sign_in_at' | 'email' | 'role';
type SortDir = 'asc' | 'desc';

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order(sortField, { ascending: sortDir === 'asc' });
    setUsers((data as Profile[]) || []);
    setLoading(false);
  }, [sortField, sortDir]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function toggleRole(profile: Profile) {
    setToggling(profile.id);
    const newRole = profile.role === 'admin' ? 'user' : 'admin';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profile.id);

    if (!error) {
      setUsers(prev => prev.map(u => u.id === profile.id ? { ...u, role: newRole } : u));
    }
    setToggling(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-cyan-400" />
      : <ChevronDown size={13} className="text-cyan-400" />;
  };

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q)
      || u.full_name.toLowerCase().includes(q)
      || u.role.toLowerCase().includes(q);
  });

  const adminCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="pb-16 px-4 pt-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-sm font-medium mb-3">
              <Users size={14} />
              User Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Users</h1>
            <p className="text-slate-400 text-sm mt-1">
              {users.length} registered user{users.length !== 1 ? 's' : ''} -- {adminCount} admin{adminCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <div className="relative mb-5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_100px_140px_140px_80px] gap-3 px-5 py-3 border-b border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <button onClick={() => handleSort('email')} className="flex items-center gap-1 text-left hover:text-slate-300 transition-colors">
              User <SortIcon field="email" />
            </button>
            <span>Email</span>
            <button onClick={() => handleSort('role')} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
              Role <SortIcon field="role" />
            </button>
            <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
              Joined <SortIcon field="created_at" />
            </button>
            <button onClick={() => handleSort('last_sign_in_at')} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
              Last Login <SortIcon field="last_sign_in_at" />
            </button>
            <span className="text-right">Action</span>
          </div>

          {loading && users.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
              Loading users...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">{search ? 'No users match your search' : 'No users yet'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filtered.map(u => (
                <div
                  key={u.id}
                  className="px-5 py-4 sm:grid sm:grid-cols-[1fr_1fr_100px_140px_140px_80px] sm:gap-3 sm:items-center space-y-2 sm:space-y-0 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt={u.full_name}
                        className="w-8 h-8 rounded-full shrink-0 bg-slate-700 object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full shrink-0 bg-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-white text-sm font-medium truncate">
                      {u.full_name || 'No Name'}
                    </span>
                  </div>

                  <span className="text-slate-400 text-sm truncate block">{u.email}</span>

                  <div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                    }`}>
                      {u.role === 'admin' ? <Shield size={10} /> : null}
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>

                  <span className="text-slate-500 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    }) : '--'}
                  </span>

                  <span className="text-slate-500 text-xs">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : 'Never'}
                  </span>

                  <div className="flex justify-end">
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={toggling === u.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        u.role === 'admin'
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20'
                      } disabled:opacity-50`}
                      title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                    >
                      {toggling === u.id ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : u.role === 'admin' ? (
                        <ShieldOff size={11} />
                      ) : (
                        <Shield size={11} />
                      )}
                      {u.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-slate-600 text-xs">
          Users are automatically registered on first Google sign-in
        </div>
      </div>
    </div>
  );
}
