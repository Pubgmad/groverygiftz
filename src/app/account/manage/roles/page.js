'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiPlus, FiShield, FiTrash2, FiUserMinus, FiUsers } from 'react-icons/fi';
import { ADMIN_MODULES, emptyAdminPermissions, normalizeEmail, normalizePermissions } from '@/lib/adminPermissions';
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
    const email = normalizeEmail(assignForm.email);
    if (!roleId) return toast.error('Select a role first');
    const passwordCheck = validateStrongPassword(assignForm.password);
    const existing = assignments.some((row) => normalizeEmail(row.email) === email);
    if (!existing && !passwordCheck.valid) return toast.error('Set a strong password for this new admin login');
    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...assignForm, email, roleId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Unable to assign access');
      return;
    }
    toast.success(res.status === 201 ? 'Access assigned' : 'Access updated');
    setAssignForm({ email: '', name: '', password: '', roleId });
    await load();
  };

  if (loading && roles.length === 0) return <div className="py-12 text-center text-gray-500">Loading roles...</div>;

  const visibleAssignments = selectedRole ? selectedAssignments : assignments;
  const assigningExisting = assignments.some((row) => normalizeEmail(row.email) === normalizeEmail(assignForm.email));

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <div className="mb-5 min-w-0">
        <h1 className="text-2xl font-bold leading-tight">Roles & Permissions</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Create a role, choose Read/Write access, then assign an email. Assigned people sign in at Admin Login. Only the primary admin can manage this section.</p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-2xl border bg-white p-3">
          <button type="button" onClick={() => setSelectedId('new')} className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${selectedId === 'new' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
            <FiPlus className="shrink-0" /> New role
          </button>
          {roles.length === 0 && <p className="px-2 py-3 text-sm leading-6 text-gray-500">No roles yet. Create one below, then assign an email.</p>}
          <div className="mt-1 max-h-64 space-y-1 overflow-y-auto xl:max-h-none">
            {roles.map((role) => (
              <button key={role._id} type="button" onClick={() => setSelectedId(role._id)} className={`w-full rounded-xl px-3 py-2.5 text-left ${selectedId === role._id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}>
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{role.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${role.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>{role.isActive === false ? 'Inactive' : 'Active'}</span>
                </span>
                <span className="mt-1 block text-xs text-gray-500">{role.activeAssignedCount || 0} assigned</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <form onSubmit={saveRole} className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight">{selectedId === 'new' ? 'Create role' : 'Edit role'}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">Write includes Read. Some modules are view-only because they have no admin edits.</p>
              </div>
              {selectedRole && (
                <button type="button" onClick={() => setConfirm({ title: 'Delete this role?', bodyText: 'Assigned users must be revoked first. This cannot be undone.', url: `/api/admin/roles/${selectedRole._id}`, method: 'DELETE', success: 'Role deleted', resetSelection: true })} className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:w-auto">
                  <FiTrash2 /> Delete
                </button>
              )}
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium">Role name
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full min-w-0 rounded-lg border px-4 py-3 text-base sm:text-sm" placeholder="Example: Sales" />
              </label>
              <label className="flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold sm:mt-6">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-5 w-5 accent-primary-600" />
                Role is active
              </label>
            </div>
            <label className="mt-4 block min-w-0 text-sm font-medium">Description
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="mt-1 w-full min-w-0 rounded-lg border px-4 py-3 text-base sm:text-sm" placeholder="Optional internal note" />
            </label>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Module access</p>
              {ADMIN_MODULES.map((module) => {
                const row = form.permissions[module.id] || { read: false, write: false };
                return (
                  <div key={module.id} className="min-w-0 rounded-2xl border p-3">
                    <p className="font-semibold leading-snug text-gray-900">{module.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{module.description}{!module.writeSupported ? ' Write is unavailable because this module has no admin edits.' : ''}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gray-50 px-2 text-sm font-semibold">
                        <input type="checkbox" checked={row.read} onChange={(e) => setPermission(module.id, 'read', e.target.checked)} className="h-5 w-5 accent-primary-600" />
                        Read
                      </label>
                      <label className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold ${module.writeSupported ? 'bg-gray-50' : 'bg-gray-100 text-gray-400'}`}>
                        <input type="checkbox" disabled={!module.writeSupported} checked={row.write} onChange={(e) => setPermission(module.id, 'write', e.target.checked)} className="h-5 w-5 accent-primary-600 disabled:opacity-40" />
                        Write
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="submit" disabled={saving} className="mt-5 min-h-[48px] w-full rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700 disabled:opacity-70 sm:w-auto">
              {saving ? 'Saving...' : selectedId === 'new' ? 'Create role' : 'Save role'}
            </button>
          </form>

          <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <FiUsers className="shrink-0 text-primary-600" />
              <h2 className="text-xl font-bold leading-tight">Assign email</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-gray-500">They sign in at <span className="font-semibold">/admin/login</span> with the password you set here. A shop customer account with the same email does not get admin access.</p>
            {roles.filter((role) => role.isActive !== false).length === 0 && (
              <p className="mb-4 rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">Create and save an active role before assigning an email.</p>
            )}
            <form onSubmit={assignUser} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-medium">Email
                <input required type="email" inputMode="email" autoComplete="off" value={assignForm.email} onChange={(e) => setAssignForm((p) => ({ ...p, email: e.target.value }))} className="mt-1 w-full min-w-0 rounded-lg border px-4 py-3 text-base sm:text-sm" placeholder="person@example.com" />
              </label>
              <label className="block min-w-0 text-sm font-medium">Display name
                <input value={assignForm.name} onChange={(e) => setAssignForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full min-w-0 rounded-lg border px-4 py-3 text-base sm:text-sm" placeholder="Optional" />
              </label>
              <label className="block min-w-0 text-sm font-medium">Role
                <select required value={assignForm.roleId || selectedRole?._id || ''} onChange={(e) => setAssignForm((p) => ({ ...p, roleId: e.target.value }))} className="mt-1 w-full min-w-0 rounded-lg border bg-white px-4 py-3 text-base sm:text-sm">
                  <option value="">Select role</option>
                  {roles.filter((role) => role.isActive !== false).map((role) => <option key={role._id} value={role._id}>{role.name}</option>)}
                </select>
              </label>
              <label className="block min-w-0 text-sm font-medium">Password {assigningExisting ? '(optional reset)' : ''}
                <PasswordInput value={assignForm.password} onChange={(e) => setAssignForm((p) => ({ ...p, password: e.target.value }))} autoComplete="new-password" inputClassName="w-full min-w-0 rounded-lg border px-4 py-3 text-base focus:outline-none focus:border-primary-500 sm:text-sm" />
              </label>
              <div className="min-w-0 rounded-xl bg-primary-50/70 p-3 text-xs leading-5 text-gray-600 sm:col-span-2">
                <p className="mb-2 font-semibold text-gray-800">New accounts need a strong password:</p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {PASSWORD_REQUIREMENTS.map((rule) => (
                    <span key={rule.key} className={rule.test(assignForm.password) ? 'text-green-700' : 'text-gray-500'}>{rule.test(assignForm.password) ? 'OK' : '-'} {rule.label}</span>
                  ))}
                </div>
              </div>
              <button type="submit" className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-700 sm:col-span-2 sm:w-auto">
                <FiCheck /> Save assignment
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {visibleAssignments.map((row) => {
                const badge = statusLabel[row.accessStatus] || statusLabel.unassigned;
                return (
                  <div key={row._id} className="min-w-0 rounded-2xl border p-3">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-all text-sm font-semibold leading-5">{row.email}</p>
                        {row.name ? <p className="mt-0.5 break-words text-xs text-gray-500">{row.name}</p> : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">Role: {row.roleName || '—'}</p>
                    {row.isActive ? (
                      <button type="button" onClick={() => setConfirm({ title: 'Revoke access?', bodyText: `${row.email} will lose admin access immediately on the next request.`, url: `/api/admin/assignments/${row._id}`, method: 'DELETE', success: 'Access revoked' })} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-red-600">
                        <FiUserMinus /> Revoke
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirm({ title: 'Restore access?', bodyText: `${row.email} will be able to sign in with this role again.`, url: `/api/admin/assignments/${row._id}`, method: 'PUT', body: { isActive: true, roleId: row.roleId }, success: 'Access restored' })} className="mt-3 min-h-[44px] text-sm font-semibold text-primary-600">Restore</button>
                    )}
                  </div>
                );
              })}
              {visibleAssignments.length === 0 && (
                <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No assigned emails yet.</p>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <FiShield className="shrink-0 text-primary-600" />
              <h2 className="text-lg font-bold leading-tight">Recent permission changes</h2>
            </div>
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log._id} className="break-words rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                  <span className="font-semibold text-gray-800">{log.actorEmail || 'Primary admin'}</span> {log.action.replace('.', ' ')} {log.details?.email || log.details?.name || ''}
                  <span className="mt-1 block text-gray-400 sm:ml-2 sm:mt-0 sm:inline">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : ''}</span>
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
            <p className="mt-2 break-words text-sm leading-6 text-gray-600">{confirm.bodyText}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirm(null)} className="min-h-[44px] rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={runConfirmed} className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
