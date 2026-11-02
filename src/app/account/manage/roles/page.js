'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiPlus, FiShield, FiTrash2, FiUserMinus, FiUsers } from 'react-icons/fi';
import { ADMIN_MODULES, emptyAdminPermissions, normalizePermissions } from '@/lib/adminPermissions';
import { PASSWORD_REQUIREMENTS, validateStrongPassword } from '@/lib/passwordPolicy';
import PasswordInput from '@/components/common/PasswordInput';

const emptyRoleForm = () => ({
  name: '',
  description: '',
  isActive: true,
  permissions: emptyAdminPermissions(),
});

const statusLabel = {
  active: { label: 'Active', className: 'bg-green-50 text-green-700' },
  revoked: { label: 'Revoked', className: 'bg-red-50 text-red-700' },
  unassigned: { label: 'Unassigned', className: 'bg-gray-100 text-gray-600' },
  'role-inactive': { label: 'Role inactive', className: 'bg-amber-50 text-amber-700' },
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('new');
  const [form, setForm] = useState(emptyRoleForm);
  const [assignForm, setAssignForm] = useState({ email: '', name: '', password: '', roleId: '' });
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const [rolesRes, assignRes, auditRes] = await Promise.all([
      fetch('/api/admin/roles', { cache: 'no-store' }),
      fetch('/api/admin/assignments', { cache: 'no-store' }),
      fetch('/api/admin/audit', { cache: 'no-store' }),
    ]);
    if (!rolesRes.ok) {
      const data = await rolesRes.json().catch(() => ({}));
      toast.error(data.error || 'Unable to load roles');
      setLoading(false);
      return;
    }
    const rolesData = await rolesRes.json();
    const assignData = assignRes.ok ? await assignRes.json() : { assignments: [] };
    const auditData = auditRes.ok ? await auditRes.json() : { logs: [] };
    setRoles(rolesData.roles || []);
    setAssignments(assignData.assignments || []);
    setLogs(auditData.logs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedRole = useMemo(() => roles.find((role) => role._id === selectedId) || null, [roles, selectedId]);
  const selectedAssignments = useMemo(
    () => assignments.filter((row) => String(row.roleId || '') === String(selectedRole?._id || '')),
    [assignments, selectedRole]
  );

  useEffect(() => {
    if (selectedId === 'new') {
      setForm(emptyRoleForm());
      return;
    }
    if (selectedRole) {
      setForm({
        name: selectedRole.name || '',
        description: selectedRole.description || '',
        isActive: selectedRole.isActive !== false,
        permissions: normalizePermissions(selectedRole.permissions),
      });
    }
  }, [selectedId, selectedRole]);

  const setPermission = (moduleId, field, value) => {
    setForm((current) => {
      const next = normalizePermissions(current.permissions);
      if (field === 'write') {
        next[moduleId] = { read: value ? true : next[moduleId].read, write: value };
      } else {
        next[moduleId] = { read: value, write: value ? next[moduleId].write : false };
      }
      return { ...current, permissions: next };
    });
  };

  const saveRole = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = { ...form, permissions: normalizePermissions(form.permissions) };
    const isNew = selectedId === 'new';
    const res = await fetch(isNew ? '/api/admin/roles' : `/api/admin/roles/${selectedId}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Unable to save role');
      return;
    }
    toast.success(isNew ? 'Role created' : 'Role updated');
    await load();
    if (data.role?._id) setSelectedId(data.role._id);
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const res = await fetch(confirm.url, { method: confirm.method, headers: { 'Content-Type': 'application/json' }, body: confirm.body ? JSON.stringify(confirm.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Request failed');
      return;
    }
    toast.success(confirm.success);
    setConfirm(null);
    await load();
    if (confirm.resetSelection) setSelectedId('new');
  };

  const assignUser = async (event) => {
    event.preventDefault();
    const roleId = assignForm.roleId || selectedRole?._id;
    if (!roleId) return toast.error('Select a role first');
    const passwordCheck = validateStrongPassword(assignForm.password);
    const existing = assignments.some((row) => row.email === assignForm.email.trim().toLowerCase());
    if (!existing && !passwordCheck.valid) return toast.error('Set a strong password for this new admin login');
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...assignForm, roleId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Unable to assign access');
      return;
    }
    toast.success('Access assigned');
    setAssignForm({ email: '', name: '', password: '', roleId: roleId });
    await load();
  };

  if (loading && roles.length === 0) return <div className="py-12 text-center text-gray-500">Loading roles...</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-gray-500">Create roles, choose module access, and assign verified admin logins by email. Only the primary admin can manage this section.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-white p-3">
          <button type="button" onClick={() => setSelectedId('new')} className={`mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold ${selectedId === 'new' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
            <FiPlus /> New role
          </button>
          {roles.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">No roles yet. Create the first role to assign dashboard access.</p>}
          {roles.map((role) => (
            <button key={role._id} type="button" onClick={() => setSelectedId(role._id)} className={`mb-2 w-full rounded-xl px-3 py-3 text-left ${selectedId === role._id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{role.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${role.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>{role.isActive === false ? 'Inactive' : 'Active'}</span>
              </span>
              <span className="mt-1 block text-xs text-gray-500">{role.activeAssignedCount || 0} assigned</span>
            </button>
          ))}
        </aside>

        <div className="space-y-5">
          <form onSubmit={saveRole} className="rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold">{selectedId === 'new' ? 'Create role' : 'Edit role'}</h2>
                <p className="mt-1 text-sm text-gray-500">Write access includes Read. Modules without existing edit actions stay read-only.</p>
              </div>
              {selectedRole && (
                <button type="button" onClick={() => setConfirm({ title: 'Delete this role?', bodyText: 'Assigned users must be revoked first. This cannot be undone.', url: `/api/admin/roles/${selectedRole._id}`, method: 'DELETE', success: 'Role deleted', resetSelection: true })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  <FiTrash2 /> Delete
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">Role name
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border px-4 py-2.5" placeholder="Example: Sales" />
              </label>
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold md:mt-6">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4" />
                Role is active
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium">Description
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border px-4 py-2.5" placeholder="Optional internal note" />
            </label>

            <div className="mt-6 overflow-hidden rounded-2xl border">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_88px_88px] bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 sm:grid">
                <span>Module</span><span className="text-center">Read</span><span className="text-center">Write</span>
              </div>
              <div className="divide-y">
                {ADMIN_MODULES.map((module) => {
                  const row = form.permissions[module.id] || { read: false, write: false };
                  return (
                    <div key={module.id} className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1.4fr)_88px_88px] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{module.label}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{module.description}{!module.writeSupported ? ' Write is not available because this module has no admin edits.' : ''}</p>
                      </div>
                      <label className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold sm:justify-center sm:bg-transparent sm:px-0 sm:py-0">
                        <span className="sm:hidden">Read</span>
                        <input type="checkbox" checked={row.read} onChange={(e) => setPermission(module.id, 'read', e.target.checked)} className="h-5 w-5 accent-primary-600" />
                      </label>
                      <label className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold sm:justify-center sm:bg-transparent sm:px-0 sm:py-0 ${module.writeSupported ? 'bg-gray-50' : 'bg-gray-100 text-gray-400'}`}>
                        <span className="sm:hidden">Write</span>
                        <input type="checkbox" disabled={!module.writeSupported} checked={row.write} onChange={(e) => setPermission(module.id, 'write', e.target.checked)} className="h-5 w-5 accent-primary-600 disabled:opacity-40" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-70 sm:w-auto">
              {saving ? 'Saving...' : selectedId === 'new' ? 'Create role' : 'Save role'}
            </button>
          </form>

          <section className="rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <FiUsers className="text-primary-600" />
              <h2 className="font-display text-xl font-bold">Assign email</h2>
            </div>
            <p className="mb-4 text-sm text-gray-500">Assigned people sign in at Admin Login with the password you set. A customer account with the same email does not receive admin access.</p>
            <form onSubmit={assignUser} className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium">Email
                <input required type="email" value={assignForm.email} onChange={(e) => setAssignForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full rounded-lg border px-4 py-2.5" placeholder="person@example.com" />
              </label>
              <label className="block text-sm font-medium">Display name
                <input value={assignForm.name} onChange={(e) => setAssignForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border px-4 py-2.5" placeholder="Optional" />
              </label>
              <label className="block text-sm font-medium">Role
                <select required value={assignForm.roleId || selectedRole?._id || ''} onChange={(e) => setAssignForm((p) => ({ ...p, roleId: e.target.value }))} className="mt-1 w-full rounded-lg border px-4 py-2.5">
                  <option value="">Select role</option>
                  {roles.filter((role) => role.isActive !== false).map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Password {assignments.some((row) => row.email === assignForm.email.trim().toLowerCase()) ? '(optional reset)' : ''}
                <PasswordInput value={assignForm.password} onChange={(e) => setAssignForm((p) => ({ ...p, password: e.target.value }))} inputClassName="w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:border-primary-500" />
              </label>
              <div className="md:col-span-2 rounded-xl bg-primary-50/70 p-3 text-xs text-gray-600">
                <p className="mb-2 font-semibold text-gray-800">New accounts need a strong password:</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {PASSWORD_REQUIREMENTS.map((rule) => (
                    <span key={rule.key} className={rule.test(assignForm.password) ? 'text-green-700' : 'text-gray-500'}>{rule.test(assignForm.password) ? 'OK' : '-'} {rule.label}</span>
                  ))}
                </div>
              </div>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700 md:col-span-2 md:w-auto">
                <FiCheck /> Save assignment
              </button>
            </form>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRole ? selectedAssignments : assignments).map((row) => {
                    const badge = statusLabel[row.accessStatus] || statusLabel.unassigned;
                    return (
                      <tr key={row._id} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-semibold break-all">{row.email}</p>
                          <p className="text-xs text-gray-500">{row.name}</p>
                        </td>
                        <td className="px-3 py-3">{row.roleName || '—'}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span></td>
                        <td className="px-3 py-3">
                          {row.isActive ? (
                            <button type="button" onClick={() => setConfirm({ title: 'Revoke access?', bodyText: `${row.email} will lose admin access immediately on the next request.`, url: `/api/admin/assignments/${row._id}`, method: 'DELETE', success: 'Access revoked' })} className="inline-flex items-center gap-1 text-sm font-semibold text-red-600">
                              <FiUserMinus /> Revoke
                            </button>
                          ) : (
                            <button type="button" onClick={() => setConfirm({ title: 'Restore access?', bodyText: `${row.email} will be able to sign in with this role again.`, url: `/api/admin/assignments/${row._id}`, method: 'PUT', body: { isActive: true, roleId: row.roleId }, success: 'Access restored' })} className="text-sm font-semibold text-primary-600">Restore</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(selectedRole ? selectedAssignments : assignments).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No assigned emails yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <FiShield className="text-primary-600" />
              <h2 className="font-display text-lg font-bold">Recent permission changes</h2>
            </div>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log._id} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">{log.actorEmail || 'Primary admin'}</span> {log.action.replace('.', ' ')} {log.details?.email || log.details?.name || ''}
                  <span className="ml-2 text-gray-400">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : ''}</span>
                </div>
              ))}
              {logs.length === 0 && <p className="text-sm text-gray-500">No role changes recorded yet.</p>}
            </div>
          </section>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">{confirm.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{confirm.bodyText}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirm(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={runConfirmed} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
