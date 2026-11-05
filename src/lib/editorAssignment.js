/**
 * Automatic Editor assignment for Website + WhatsApp orders.
 * Picks the active Editor (role slug `editor`) with the lowest pending editing workload.
 * Idempotent: never overwrites an existing assignedTo.
 */

import mongoose from 'mongoose';
import Admin from '@/models/Admin';
import Role from '@/models/Role';
import Order from '@/models/Order';
import { appendTimeline, notifyAdmins } from '@/lib/opsOrderHelpers';

/** Ops statuses that count as pending editing workload. */
export const PENDING_EDITING_OPS = [
  'new_order',
  'design_pending',
  'editing_in_progress',
  'preview_waiting',
  'revision_required',
];

export async function listActiveEditors() {
  const role = await Role.findOne({ slug: 'editor', isActive: { $ne: false } }).select('_id name').lean();
  if (!role) return [];
  const editors = await Admin.find({
    roleId: role._id,
    isActive: { $ne: false },
  }).select('_id name email').lean();
  return editors;
}

export async function getEditorWorkloads(editorIds = []) {
  const ids = (editorIds || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (!ids.length) return {};

  const rows = await Order.aggregate([
    {
      $match: {
        assignedTo: { $in: ids },
        opsStatus: { $in: PENDING_EDITING_OPS },
        status: { $ne: 'cancelled' },
      },
    },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);

  const map = {};
  ids.forEach((id) => { map[String(id)] = 0; });
  rows.forEach((row) => {
    map[String(row._id)] = row.count || 0;
  });
  return map;
}

/**
 * Pick active Editor with lowest pending editing count.
 * Tie-break: stable by name then _id.
 */
export async function pickLowestWorkloadEditor() {
  const editors = await listActiveEditors();
  if (!editors.length) return null;
  const workloads = await getEditorWorkloads(editors.map((e) => e._id));
  const ranked = [...editors].sort((a, b) => {
    const wa = workloads[String(a._id)] || 0;
    const wb = workloads[String(b._id)] || 0;
    if (wa !== wb) return wa - wb;
    const na = String(a.name || a.email || '');
    const nb = String(b.name || b.email || '');
    if (na !== nb) return na.localeCompare(nb);
    return String(a._id).localeCompare(String(b._id));
  });
  const winner = ranked[0];
  return {
    editor: winner,
    workload: workloads[String(winner._id)] || 0,
    workloads: ranked.map((e) => ({
      id: e._id,
      name: e.name || e.email || '',
      pending: workloads[String(e._id)] || 0,
    })),
  };
}

function pushAssignmentHistory(order, entry) {
  if (!order.assignmentHistory) order.assignmentHistory = [];
  order.assignmentHistory.push({
    at: new Date(),
    ...entry,
  });
}

/**
 * Assign Editor to order if unassigned.
 * @returns {{ assigned: boolean, warning?: string, editor?: object }}
 */
export async function autoAssignEditorIfNeeded(order, {
  source = 'system',
  actorId = null,
  actorName = 'System',
  force = false,
} = {}) {
  if (!order) return { assigned: false, warning: 'No order' };
  if (!force && order.assignedTo) {
    return { assigned: false, alreadyAssigned: true };
  }

  const pick = await pickLowestWorkloadEditor();
  if (!pick?.editor) {
    pushAssignmentHistory(order, {
      action: 'unassigned_warning',
      previousAssignee: order.assignedTo || undefined,
      previousAssigneeName: order.assignedToName || '',
      newAssignee: undefined,
      newAssigneeName: '',
      changedBy: actorId || undefined,
      changedByName: actorName,
      source,
      note: 'No active Editor available for automatic assignment',
    });
    appendTimeline(order, {
      type: 'editor_assignment_warning',
      employee: actorId || undefined,
      employeeName: actorName,
      notes: 'No active Editor available — order waiting for assignment',
    });
    return { assigned: false, warning: 'No active Editor available' };
  }

  const prevId = order.assignedTo;
  const prevName = order.assignedToName || '';
  const prevOps = order.opsStatus || 'new_order';
  order.assignedTo = pick.editor._id;
  order.assignedToName = pick.editor.name || pick.editor.email || '';

  // Spec: Order Created → Auto Editor assign → Editing in Progress
  if (!force && (prevOps === 'new_order' || prevOps === 'design_pending' || !prevOps)) {
    order.opsStatus = 'editing_in_progress';
  }

  pushAssignmentHistory(order, {
    action: force ? 'reassigned' : 'auto_assigned',
    previousAssignee: prevId || undefined,
    previousAssigneeName: prevName,
    newAssignee: pick.editor._id,
    newAssigneeName: order.assignedToName,
    changedBy: actorId || undefined,
    changedByName: actorName,
    source,
    note: `Auto-assigned to Editor with lowest pending editing workload (${pick.workload} open)`,
  });

  appendTimeline(order, {
    type: 'editor_assigned',
    previousStatus: prevName || 'unassigned',
    newStatus: order.assignedToName,
    employee: actorId || undefined,
    employeeName: actorName,
    notes: `Editor auto-assigned: ${order.assignedToName}`,
  });

  if (order.opsStatus === 'editing_in_progress' && prevOps !== 'editing_in_progress') {
    appendTimeline(order, {
      type: 'ops_status',
      previousStatus: prevOps,
      newStatus: 'editing_in_progress',
      employee: actorId || undefined,
      employeeName: actorName,
      notes: 'Ops status set to Editing in Progress after Editor assignment',
    });
  }

  return { assigned: true, editor: pick.editor, workload: pick.workload };
}

export async function notifyAssignedEditor(order) {
  if (!order?.assignedTo) return;
  await notifyAdmins([order.assignedTo], {
    type: 'order_assigned',
    title: 'New order assigned to you',
    body: `${order.orderNumber} — open Order Details for customer photos and customization`,
    order: order._id,
    orderNumber: order.orderNumber,
  }).catch(() => {});
}

/**
 * Backfill automatic Editor assignment for eligible existing orders that have no editor.
 * Never overwrites a valid assignedTo. Sets opsStatus to editing_in_progress when appropriate.
 * Processes in small batches to reduce concurrent contention.
 */
export async function autoAssignUnassignedEligibleOrders({
  limit = 40,
  actorId = null,
  actorName = 'System',
} = {}) {
  const eligible = await Order.find({
    $and: [
      {
        $or: [
          { paymentStatus: 'paid' },
          { orderSource: { $in: ['whatsapp', 'instagram'] } },
        ],
      },
      {
        $or: [
          { assignedTo: { $exists: false } },
          { assignedTo: null },
        ],
      },
      { status: { $ne: 'cancelled' } },
      {
        opsStatus: {
          $nin: ['dispatched', 'completed', 'cancelled', 'on_hold'],
        },
      },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(100, Number(limit) || 40)));

  const results = { scanned: eligible.length, assigned: 0, skipped: 0, warnings: [] };

  for (const order of eligible) {
    // Re-read assignment under each save to reduce races with concurrent creates
    if (order.assignedTo) {
      results.skipped += 1;
      continue;
    }
    const result = await autoAssignEditorIfNeeded(order, {
      source: 'backfill_unassigned',
      actorId,
      actorName,
    });
    if (result.assigned) {
      await order.save();
      await notifyAssignedEditor(order);
      results.assigned += 1;
    } else {
      results.skipped += 1;
      if (result.warning) results.warnings.push({ orderId: String(order._id), warning: result.warning });
      if (result.warning) await order.save();
    }
  }

  return results;
}

/** Manual reassignment by Super Admin / staff with write access. */
export async function reassignEditor(order, {
  editorId,
  actorId = null,
  actorName = '',
  note = '',
} = {}) {
  if (!order) throw new Error('Order required');
  if (!editorId) {
    const prevId = order.assignedTo;
    const prevName = order.assignedToName || '';
    order.assignedTo = undefined;
    order.assignedToName = '';
    pushAssignmentHistory(order, {
      action: 'unassigned',
      previousAssignee: prevId || undefined,
      previousAssigneeName: prevName,
      newAssignee: undefined,
      newAssigneeName: '',
      changedBy: actorId || undefined,
      changedByName: actorName,
      source: 'manual',
      note: note || 'Editor unassigned',
    });
    appendTimeline(order, {
      type: 'editor_unassigned',
      previousStatus: prevName,
      newStatus: 'unassigned',
      employee: actorId || undefined,
      employeeName: actorName,
      notes: note || 'Editor unassigned',
    });
    return order;
  }
  if (!mongoose.Types.ObjectId.isValid(String(editorId))) {
    throw new Error('Invalid editor');
  }
  const admin = await Admin.findById(editorId).select('_id name email isActive roleId').lean();
  if (!admin || admin.isActive === false) throw new Error('Editor not found or inactive');

  const prevId = order.assignedTo;
  const prevName = order.assignedToName || '';
  order.assignedTo = admin._id;
  order.assignedToName = admin.name || admin.email || '';
  pushAssignmentHistory(order, {
    action: 'reassigned',
    previousAssignee: prevId || undefined,
    previousAssigneeName: prevName,
    newAssignee: admin._id,
    newAssigneeName: order.assignedToName,
    changedBy: actorId || undefined,
    changedByName: actorName,
    source: 'manual',
    note: note || 'Manually reassigned',
  });
  appendTimeline(order, {
    type: 'editor_assigned',
    previousStatus: prevName || 'unassigned',
    newStatus: order.assignedToName,
    employee: actorId || undefined,
    employeeName: actorName,
    notes: note || `Editor reassigned to ${order.assignedToName}`,
  });
  return order;
}
