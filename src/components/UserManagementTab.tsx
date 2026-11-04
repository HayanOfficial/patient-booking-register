'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, KeyRound, ShieldAlert, CheckCircle, Ban, Edit3, Lock } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const UserManagementTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [password, setPassword] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setEmail('');
    setRole('operator');
    setPassword('welcome123');
    setErrorMsg(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.full_name);
    setEmail(user.email || '');
    setRole(user.role);
    setPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setModalOpen(true);
  };

  const handleToggleStatus = async (user: UserProfile) => {
    try {
      setErrorMsg(null);
      const newStatus = user.status === 'active' ? 'disabled' : 'active';
      await api.saveUser({
        id: user.id,
        status: newStatus,
      });
      setSuccessMsg(`User ${user.username} status updated to ${newStatus}`);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user status');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.saveUser({
        id: editingUser ? editingUser.id : undefined,
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        role,
      });

      setSuccessMsg(editingUser ? 'User updated successfully' : 'New user created successfully');
      setModalOpen(false);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span>User Management & Role Permissions</span>
          </h2>
          <p className="text-xs text-slate-500">
            Configure system accounts (Admin, Operator, Receptionist). Public signup is disabled.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add System User</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold">
          {successMsg}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-extrabold uppercase text-[11px] text-slate-500">
              <th className="py-3 px-4">Username</th>
              <th className="py-3 px-4">Full Name</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Password Policy</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-900 font-mono">{u.username}</td>
                <td className="py-3 px-4 text-slate-700">{u.full_name}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      u.role === 'admin'
                        ? 'bg-rose-100 text-rose-700'
                        : u.role === 'operator'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {u.status === 'active' ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-500 text-[11px]">
                  {u.must_change_password ? (
                    <span className="text-amber-600 font-bold">Must Change on Next Login</span>
                  ) : (
                    <span className="text-slate-400">Regular</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                      title="Edit User"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        u.status === 'active'
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={u.status === 'active' ? 'Disable Account' : 'Activate Account'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between font-bold text-sm">
              <span>{editingUser ? 'Edit System User' : 'Create New User Account'}</span>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!!editingUser}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="operator">Operator (Call center / leads only)</option>
                  <option value="receptionist">Receptionist (Front desk & tokens)</option>
                  <option value="admin">Admin (Full administrative control)</option>
                </select>
              </div>

              {!editingUser && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    User will be required to change password on first login.
                  </span>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 font-bold text-slate-950 rounded-xl"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
