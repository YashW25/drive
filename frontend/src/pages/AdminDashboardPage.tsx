import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  HardDrive, 
  Database, 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  UserCheck, 
  UserMinus,
  MessageSquare,
  Server
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalFolders: number;
  totalStorageBytes: number;
  activeSessions: number;
}

interface AdminUser {
  id: string;
  displayName: string;
  email: string | null;
  phoneNumber: string;
  role: string;
  isProfileComplete: boolean;
  createdAt: string;
  _count?: {
    files: number;
    folders: number;
  };
}

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        apiRequest<AdminStats>('/admin/stats'),
        apiRequest<{ users: AdminUser[] }>('/admin/users'),
      ]);
      setStats(statsRes);
      setUsersList(usersRes.users);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin panel data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleRole = async (targetUser: AdminUser) => {
    const newRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Are you sure you want to change ${targetUser.displayName}'s role to ${newRole}?`)) {
      return;
    }
    setUpdatingUser(targetUser.id);
    try {
      await apiRequest(`/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } finally {
      setUpdatingUser(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold font-heading text-white">Access Denied</h1>
        <p className="text-sm text-slate-400 max-w-md mt-2 mb-6">
          You need Administrator privileges to access the Zentro Admin Control Panel.
        </p>
        <Link
          to="/drive"
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Return to My Drive
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Admin Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Link
            to="/drive"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to My Drive"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-heading text-white tracking-tight">
                Admin Control Panel
              </h1>
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold rounded-md uppercase">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">System metrics, user privileges, and OpenWA WhatsApp engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href="http://localhost:2785"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>OpenWA WhatsApp Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchAdminData} className="underline font-semibold">Retry</button>
          </div>
        )}

        {/* System Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Registered Users</p>
              <h3 className="text-2xl font-bold text-white font-heading mt-0.5">
                {loading ? '...' : stats?.totalUsers || 0}
              </h3>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total Files Stored</p>
              <h3 className="text-2xl font-bold text-white font-heading mt-0.5">
                {loading ? '...' : stats?.totalFiles || 0}
              </h3>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Storage Volume</p>
              <h3 className="text-2xl font-bold text-white font-heading mt-0.5">
                {loading ? '...' : formatSize(stats?.totalStorageBytes || 0)}
              </h3>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Active Auth Sessions</p>
              <h3 className="text-2xl font-bold text-white font-heading mt-0.5">
                {loading ? '...' : stats?.activeSessions || 0}
              </h3>
            </div>
          </div>
        </div>

        {/* Quick OpenWA WhatsApp Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
              <Server className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                WhatsApp OpenWA Engine Dashboard
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Manage WhatsApp sessions, view live QR connection status, inspect webhook queues, and test messaging endpoints.
              </p>
            </div>
          </div>
          <a
            href="http://localhost:2785"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all flex-shrink-0"
          >
            <span>Launch Engine Dashboard</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Users Management Table */}
        <div className="glass-card rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-heading">User Directory & Privileges</h3>
              <p className="text-xs text-slate-400">Manage user accounts and assign Administrator permissions</p>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-lg">
              {usersList.length} User{usersList.length !== 1 ? 's' : ''} Total
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Mobile Number</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Files</th>
                  <th className="p-3.5">Registered</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Loading user data...
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No registered users found.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 font-bold text-white flex items-center justify-center text-xs">
                          {u.displayName ? u.displayName[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{u.displayName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">ID: {u.id.slice(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{u.phoneNumber}</td>
                      <td className="p-3.5 text-slate-400">{u.email || '—'}</td>
                      <td className="p-3.5">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase">
                            <ShieldCheck className="w-3 h-3 text-amber-400" /> ADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium uppercase">
                            USER
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-slate-300">
                        {u._count?.files || 0} files
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        {u.id === user.id ? (
                          <span className="text-[11px] text-slate-500 italic">Current User</span>
                        ) : (
                          <button
                            onClick={() => handleToggleRole(u)}
                            disabled={updatingUser === u.id}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              u.role === 'ADMIN'
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {u.role === 'ADMIN' ? (
                              <>
                                <UserMinus className="w-3.5 h-3.5" /> Demote to User
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" /> Promote to Admin
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
