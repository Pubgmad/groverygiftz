export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Order from '@/models/Order';
import { verifyDesignPreviewToken } from '@/lib/designPreviewToken';
import {
  sanitizePublicDesignOrder,
  appendTimeline,
  notifyAdmins,
  approveAllCurrentSheets,
  invalidateSheetApproval,
} from '@/lib/opsOrderHelpers';
import { getLatestDesignVersionsBySheet, syncDesignApprovalFromSheets } from '@/lib/opsConstants';

export async function GET(_req, { params }) {
  const verified = verifyDesignPreviewToken(params.token);
  if (!verified) {
    return NextResponse.json({ error: 'This preview link is invalid or expired' }, { status: 410 });
  }
  await dbConnect();
  const order = await Order.findById(verified.orderId).lean();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (Number(order.currentDesignVersion) !== Number(verified.version)) {
    return NextResponse.json({
      error: 'This link is for an older design version. Ask GroveryGiftz for the latest preview link.',
      stale: true,
    }, { status: 409 });
  }
  return NextResponse.json({ preview: sanitizePublicDesignOrder(order) });
}

export async function POST(req, { params }) {
  const verified = verifyDesignPreviewToken(params.token);
  if (!verified) {
    return NextResponse.json({ error: 'This preview link is invalid or expired' }, { status: 410 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = String(body.action || '').toLowerCase();
  if (!['approve', 'request_changes', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve, request_changes, or reject' }, { status: 400 });
  }

  await dbConnect();
  const order = await Order.findById(verified.orderId);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (Number(order.currentDesignVersion) !== Number(verified.version)) {
    return NextResponse.json({ error: 'Link is for a superseded design version' }, { status: 409 });
  }

  const feedback = String(body.feedback || body.notes || '').trim();
  const sheetNumberRaw = body.sheetNumber != null ? Number(body.sheetNumber) : null;
  order.designApprovalHistory = order.designApprovalHistory || [];

  if (action === 'approve') {
    if (sheetNumberRaw != null && Number.isFinite(sheetNumberRaw)) {
      const sheets = getLatestDesignVersionsBySheet(order);
      const sheet = sheets.find((s) => Number(s.sheetNumber) === Number(sheetNumberRaw));
      if (!sheet) {
        return NextResponse.json({ error: 'Unknown sheet' }, { status: 400 });
      }
      order.designSheetApprovals = Array.isArray(order.designSheetApprovals) ? order.designSheetApprovals : [];
      const idx = order.designSheetApprovals.findIndex((row) => Number(row?.sheetNumber) === Number(sheetNumberRaw));
      const row = {
        sheetNumber: Number(sheetNumberRaw),
        status: 'approved',
        approvedVersion: sheet.versionNumber,
        approvedAt: new Date(),
        source: 'customer',
      };
      if (idx >= 0) order.designSheetApprovals[idx] = { ...order.designSheetApprovals[idx], ...row };
      else order.designSheetApprovals.push(row);
      syncDesignApprovalFromSheets(order);
      if (order.designApprovalStatus === 'approved') {
        order.opsStatus = 'approved_printing_pending';
        order.designChangeRequest = '';
      }
    } else {
      approveAllCurrentSheets(order, { source: 'customer', evidence: 'secure_preview_token' });
      order.designChangeRequest = '';
      order.opsStatus = 'approved_printing_pending';
    }
    order.designApprovalHistory.push({
      version: order.currentDesignVersion,
      sheetNumber: sheetNumberRaw || undefined,
      status: 'approved',
      source: 'customer',
      notes: feedback,
      customerEvidence: 'secure_preview_token',
      at: new Date(),
    });
  } else if (action === 'request_changes') {
    if (!feedback) return NextResponse.json({ error: 'Please describe the changes needed' }, { status: 400 });
    order.designApprovalStatus = 'changes_requested';
    order.designChangeRequest = feedback;
    order.designRevisionCount = Math.max(0, Number(order.designRevisionCount) || 0) + 1;
    if (!order.freeRevisionUsed) order.freeRevisionUsed = true;
    order.opsStatus = 'revision_required';
    order.revisionPaymentVerified = false;
    if (sheetNumberRaw != null && Number.isFinite(sheetNumberRaw)) {
      invalidateSheetApproval(order, sheetNumberRaw, { awaiting: false });
      const idx = (order.designSheetApprovals || []).findIndex((row) => Number(row?.sheetNumber) === Number(sheetNumberRaw));
      if (idx >= 0) {
        order.designSheetApprovals[idx].status = 'changes_requested';
        order.designSheetApprovals[idx].approvedVersion = 0;
      }
      syncDesignApprovalFromSheets(order);
    } else {
      const sheets = getLatestDesignVersionsBySheet(order);
      sheets.forEach((sheet) => invalidateSheetApproval(order, sheet.sheetNumber, { awaiting: false }));
      order.designSheetApprovals = (order.designSheetApprovals || []).map((row) => ({
        ...row,
        status: 'changes_requested',
        approvedVersion: 0,
      }));
      order.designApprovalStatus = 'changes_requested';
    }
    order.designApprovalHistory.push({
      version: order.currentDesignVersion,
      sheetNumber: sheetNumberRaw || undefined,
      status: 'changes_requested',
      source: 'customer',
      notes: feedback,
      customerEvidence: 'secure_preview_token',
      at: new Date(),
    });
  } else {
    order.designApprovalStatus = 'rejected';
    order.designChangeRequest = feedback;
    order.opsStatus = 'on_hold';
    order.designApprovalHistory.push({
      version: order.currentDesignVersion,
      sheetNumber: sheetNumberRaw || undefined,
      status: 'rejected',
      source: 'customer',
      notes: feedback,
      customerEvidence: 'secure_preview_token',
      at: new Date(),
    });
  }

  appendTimeline(order, {
    type: `design_${action}`,
    newStatus: order.designApprovalStatus,
    notes: feedback || action,
  });
  await order.save();

  const recipients = [order.assignedTo, order.createdByAdmin].filter(Boolean);
  await notifyAdmins(recipients, {
    type: `design_${action}`,
    title: `Design ${action.replace('_', ' ')}`,
    body: `${order.orderNumber}: ${order.designApprovalStatus}`,
    order: order._id,
    orderNumber: order.orderNumber,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    designApprovalStatus: order.designApprovalStatus,
    currentDesignVersion: order.currentDesignVersion,
    sheets: getLatestDesignVersionsBySheet(order),
  });
}
