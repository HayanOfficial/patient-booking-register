import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, KeyRound, UserCheck, UserX, AlertCircle, Check } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const UserManagementTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'receptionist'>('receptionist');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await api.getAllUsers(currentUser?.role || 'admin');
      setUsers(list);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    try {
      const res = await api.createUser({
        actorUser: { id: currentUser?.id, username: currentUser?.username, role: currentUser?.role },
        data: {
          username: username.trim(),
          password_plain: password,
          full_name: fullName.trim(),
          role,
          must_change_password: true,
        },
      });

      if (res.success) {
        setSuccessMsg(`User '${username}' created successfully.`);
        setUsername('');
        setPassword('');
        setFullName('');
        setShowAddModal(false);
        loadUsers();
      } else {
        setErrorMsg(res.message || 'Failed to create user.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.');
    }
  };

  const handleToggleStatus = async (userToToggle: User) => {
    setErrorMsg('');
    setSuccessMsg('');
    const newStatus = userToToggle.status === 'active' ? 'disabled' : 'active';

    const res = await api.updateUser({
      actorUser: { id: currentUser?.id, username: currentUser?.username, role: currentUser?.role },
      userId: userToToggle.id,
      updates: { status: newStatus },
    });

    if (res.success) {
      setSuccessMsg(`User status updated to ${newStatus}.`);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Cannot modify this user.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || resetNewPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    const res = await api.updateUser({
      actorUser: { id: currentUser?.id, username: currentUser?.username, role: currentUser?.role },
      userId: selectedUser.id,
      updates: { password_plain: resetNewPassword },
    });

    if (res.success) {
      setSuccessMsg(`Password for '${selectedUser.username}' reset successfully.`);
      setShowResetModal(false);
      setResetNewPassword('');
      setSelectedUser(null);
      loadUsers();
    } else {
      setErrorMsg(res.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span>User Management & Access Control</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage front-desk staff, administrators, password resets, and account statuses.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setShowAddModal(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Full Name & Username</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {users.map((u) => {
              const isAdmin = u.role === 'admin';
              const isActive = u.status === 'active';

              return (
                <tr key={u.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{u.full_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isAdmin ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isAdmin ? <Shield className="w-3 h-3 text-amber-600" /> : null}
                      <span className="capitalize">{u.role}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setShowResetModal(true);
                        }}
                        title="Reset Password"
                        className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(u)}
                        title={isActive ? 'Disable User' : 'Enable User'}
                        className={`p-1.5 rounded-lg transition ${
                          isActive
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900 mb-4">Create New Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Asad Ali"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">Username *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. asad_frontdesk"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="receptionist">Receptionist (Front-Desk Booking Only)</option>
                  <option value="admin">Admin (Full Access & Settings)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900 mb-2">Reset User Password</h3>
            <p className="text-xs text-slate-500 mb-4">
              Resetting password for <span className="font-bold text-slate-800">{selectedUser.full_name}</span> (@{selectedUser.username})
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">New Password *</label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
