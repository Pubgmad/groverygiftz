'use client';

import { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { ADMIN_MODULES, normalizePermissions } from '@/lib/adminPermissions';
import { MODULE_ACTION_CATALOG, summarizeModuleActions } from '@/lib/adminPermissionCatalog';

/**
 * Expandable Module → Submodule → Action permission matrix.
 * Keeps module Read/Write while exposing granular actions when catalog exists.
 */
export default function RolePermissionMatrix({ permissions, onChange }) {
  const [openModules, setOpenModules] = useState(() => new Set(['orders', 'operations', 'dashboard']));

  const rows = useMemo(() => normalizePermissions(permissions || {}, { expandActions: true }), [permissions]);

  const setModuleRw = (moduleId, field, value) => {
    const next = normalizePermissions(rows, { expandActions: true });
    const module = ADMIN_MODULES.find((m) => m.id === moduleId);
    if (!module) return;
    if (field === 'write') {
      next[moduleId] = {
        ...next[moduleId],
        read: value ? true : next[moduleId].read,
        write: module.writeSupported ? value : false,
      };
    } else {
      next[moduleId] = {
        ...next[moduleId],
        read: value,
        write: value ? next[moduleId].write : false,
      };
    }
    // Refresh actions from new RW when toggling module-level access
    const expanded = normalizePermissions(next, { expandActions: true });
    if (next[moduleId].actions) {
      Object.keys(next[moduleId].actions).forEach((actionId) => {
        const defs = MODULE_ACTION_CATALOG[moduleId]?.flatMap((g) => g.actions) || [];
        const def = defs.find((a) => a.id === actionId);
        if (!def) return;
        expanded[moduleId].actions[actionId] = def.level === 'write'
          ? expanded[moduleId].write
          : expanded[moduleId].read;
      });
    }
    onChange(expanded);
  };

  const setAction = (moduleId, actionId, value) => {
    const next = normalizePermissions(rows, { expandActions: true });
    if (!next[moduleId].actions) next[moduleId].actions = {};
    next[moduleId].actions[actionId] = value === true;
    // Keep module RW in sync with any enabled action
    const defs = MODULE_ACTION_CATALOG[moduleId]?.flatMap((g) => g.actions) || [];
    const anyRead = defs.some((d) => d.level === 'read' && next[moduleId].actions[d.id]);
    const anyWrite = defs.some((d) => d.level === 'write' && next[moduleId].actions[d.id]);
    if (value) {
      next[moduleId].read = true;
      if (defs.find((d) => d.id === actionId)?.level === 'write') next[moduleId].write = true;
    } else {
      next[moduleId].write = anyWrite;
      next[moduleId].read = anyRead || anyWrite;
    }
    onChange(next);
  };

  const bulkModule = (moduleId, mode) => {
    const next = normalizePermissions(rows, { expandActions: true });
    const module = ADMIN_MODULES.find((m) => m.id === moduleId);
    const defs = MODULE_ACTION_CATALOG[moduleId]?.flatMap((g) => g.actions) || [];
    if (mode === 'all') {
      next[moduleId].read = true;
      next[moduleId].write = !!module?.writeSupported;
      if (!next[moduleId].actions) next[moduleId].actions = {};
      defs.forEach((d) => { next[moduleId].actions[d.id] = d.level === 'write' ? !!module?.writeSupported : true; });
    } else if (mode === 'none') {
      next[moduleId].read = false;
      next[moduleId].write = false;
      if (!next[moduleId].actions) next[moduleId].actions = {};
      defs.forEach((d) => { next[moduleId].actions[d.id] = false; });
    } else if (mode === 'read') {
      next[moduleId].read = true;
      next[moduleId].write = false;
      if (!next[moduleId].actions) next[moduleId].actions = {};
      defs.forEach((d) => { next[moduleId].actions[d.id] = d.level === 'read'; });
    } else if (mode === 'write') {
      next[moduleId].read = true;
      next[moduleId].write = !!module?.writeSupported;
      if (!next[moduleId].actions) next[moduleId].actions = {};
      defs.forEach((d) => { next[moduleId].actions[d.id] = true; });
    }
    onChange(next);
  };

  const toggleOpen = (moduleId) => {
    setOpenModules((prev) => {
      const copy = new Set(prev);
      if (copy.has(moduleId)) copy.delete(moduleId);
      else copy.add(moduleId);
      return copy;
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">Module & action access</p>
      <p className="text-xs leading-5 text-gray-500">
        Write includes Read. Expand a module to set individual actions. Existing staff roles without action settings keep their previous Read/Write behaviour.
      </p>
      {ADMIN_MODULES.map((module) => {
        const row = rows[module.id] || { read: false, write: false, actions: {} };
        const groups = MODULE_ACTION_CATALOG[module.id] || [];
        const summary = summarizeModuleActions(module.id, row.actions || {});
        const open = openModules.has(module.id);
        return (
          <div key={module.id} className="min-w-0 overflow-hidden rounded-2xl border">
            <div className="bg-white p-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => toggleOpen(module.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                  <span className="mt-0.5 text-gray-500">{open ? <FiChevronDown /> : <FiChevronRight />}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-snug text-gray-900">{module.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{module.description}</span>
                    {summary.total > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-800">
                        {summary.enabled}/{summary.total} actions
                      </span>
                    ) : null}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1">
                  {groups.length ? (
                    <>
                      <button type="button" onClick={() => bulkModule(module.id, 'all')} className="rounded-lg border px-2 py-1 text-[11px] font-semibold">Select all</button>
                      <button type="button" onClick={() => bulkModule(module.id, 'none')} className="rounded-lg border px-2 py-1 text-[11px] font-semibold">Deselect all</button>
                      <button type="button" onClick={() => bulkModule(module.id, 'read')} className="rounded-lg border px-2 py-1 text-[11px] font-semibold">Read all</button>
                      {module.writeSupported ? (
                        <button type="button" onClick={() => bulkModule(module.id, 'write')} className="rounded-lg border px-2 py-1 text-[11px] font-semibold">Write all</button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold ${row.read ? 'bg-green-50 text-green-800' : 'bg-gray-50'}`}>
                  <input type="checkbox" checked={!!row.read} onChange={(e) => setModuleRw(module.id, 'read', e.target.checked)} className="h-5 w-5 accent-primary-600" />
                  Read
                </label>
                <label className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold ${!module.writeSupported ? 'bg-gray-100 text-gray-400' : row.write ? 'bg-green-50 text-green-800' : 'bg-gray-50'}`}>
                  <input type="checkbox" disabled={!module.writeSupported} checked={!!row.write} onChange={(e) => setModuleRw(module.id, 'write', e.target.checked)} className="h-5 w-5 accent-primary-600 disabled:opacity-40" />
                  Write
                </label>
              </div>
            </div>
            {open && groups.length > 0 ? (
              <div className="space-y-3 border-t bg-gray-50/80 p-3">
                {groups.map((group) => (
                  <div key={group.id} className="rounded-xl border bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{group.label}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {group.actions.map((action) => {
                        const enabled = row.actions?.[action.id] === true;
                        return (
                          <label
                            key={action.id}
                            className={`flex min-h-[44px] items-start gap-2 rounded-xl border px-3 py-2 text-sm ${enabled ? 'border-primary-200 bg-primary-50/50' : 'border-gray-100 bg-white'} ${action.sensitive ? 'ring-1 ring-amber-100' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => setAction(module.id, action.id, e.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-primary-600"
                            />
                            <span className="min-w-0 leading-snug">
                              <span className="font-semibold text-gray-900">{action.label}</span>
                              <span className="mt-0.5 block text-[11px] text-gray-500">
                                {action.level === 'write' ? 'Write action' : 'Read action'}
                                {action.sensitive ? ' · sensitive' : ''}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
