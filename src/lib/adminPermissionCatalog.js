/**
 * Granular Module → Submodule → Action catalog for Admin RBAC.
 * Additive to existing module { read, write }. Does not replace it.
 */

export const DATA_VISIBILITY_OPTIONS = [
  { id: 'all', label: 'All records', description: 'Access every matching record in permitted modules.' },
  { id: 'department', label: 'Department records', description: 'Records created or assigned within the same operational scope.' },
  { id: 'assigned', label: 'Assigned records only', description: 'Only records assigned to this staff member (or created by them).' },
  { id: 'own', label: 'Own records only', description: 'Only records this staff member created.' },
];

/** @typedef {{ id: string, label: string, level: 'read'|'write', sensitive?: boolean }} AdminActionDef */
/** @typedef {{ id: string, label: string, actions: AdminActionDef[] }} AdminSubmoduleDef */

/** @type {Record<string, AdminSubmoduleDef[]>} */
export const MODULE_ACTION_CATALOG = {
  dashboard: [
    {
      id: 'overview',
      label: 'Overview',
      actions: [
        { id: 'view_dashboard', label: 'View Dashboard', level: 'read' },
        { id: 'view_total_orders', label: 'View Total Orders', level: 'read' },
        { id: 'view_pending_orders', label: 'View Pending Orders', level: 'read' },
        { id: 'view_todays_orders', label: "View Today's Orders", level: 'read' },
        { id: 'view_recent_orders', label: 'View Recent Orders', level: 'read' },
        { id: 'view_notifications', label: 'View Notifications', level: 'read' },
      ],
    },
    {
      id: 'financial',
      label: 'Financial summaries',
      actions: [
        { id: 'view_revenue', label: 'View Revenue', level: 'read', sensitive: true },
        { id: 'view_sales_summary', label: 'View Sales Summary', level: 'read', sensitive: true },
        { id: 'view_financial_summary', label: 'View Financial Summary', level: 'read', sensitive: true },
        { id: 'view_staff_performance', label: 'View Staff Performance', level: 'read', sensitive: true },
      ],
    },
  ],
  orders: [
    {
      id: 'orders_core',
      label: 'Orders',
      actions: [
        { id: 'view_orders', label: 'View Orders', level: 'read' },
        { id: 'view_all_orders', label: 'View All Orders', level: 'read', sensitive: true },
        { id: 'view_assigned_orders', label: 'View Assigned Orders', level: 'read' },
        { id: 'create_whatsapp_orders', label: 'Create WhatsApp Orders', level: 'write' },
        { id: 'create_website_orders', label: 'Create Website Orders', level: 'write' },
        { id: 'edit_order_details', label: 'Edit Order Details', level: 'write' },
        { id: 'delete_orders', label: 'Delete Orders', level: 'write', sensitive: true },
        { id: 'view_order_history', label: 'View Order History', level: 'read' },
        { id: 'view_internal_notes', label: 'View Internal Notes', level: 'read' },
        { id: 'change_order_priority', label: 'Change Order Priority', level: 'write' },
        { id: 'change_expected_dispatch', label: 'Change Expected Dispatch Date', level: 'write' },
      ],
    },
    {
      id: 'customer',
      label: 'Customer details',
      actions: [
        { id: 'view_customer_details', label: 'View Customer Details', level: 'read' },
        { id: 'edit_customer_details', label: 'Edit Customer Details', level: 'write' },
        { id: 'view_customer_mobile', label: 'View Customer Mobile Number', level: 'read', sensitive: true },
        { id: 'view_customer_address', label: 'View Customer Address', level: 'read', sensitive: true },
        { id: 'view_product_details', label: 'View Product Details', level: 'read' },
      ],
    },
    {
      id: 'photos',
      label: 'Photos & references',
      actions: [
        { id: 'upload_customer_photos', label: 'Upload Customer Photos', level: 'write' },
        { id: 'edit_customer_photos', label: 'Edit Customer Photos', level: 'write' },
        { id: 'replace_customer_photos', label: 'Replace Customer Photos', level: 'write' },
        { id: 'delete_customer_photos', label: 'Delete Customer Photos', level: 'write', sensitive: true },
        { id: 'view_reference_images', label: 'View Reference Images', level: 'read' },
        { id: 'upload_reference_images', label: 'Upload Reference Images', level: 'write' },
      ],
    },
    {
      id: 'payments',
      label: 'Payments',
      actions: [
        { id: 'view_payment_details', label: 'View Payment Details', level: 'read', sensitive: true },
        { id: 'add_advance_payment', label: 'Add Advance Payment', level: 'write', sensitive: true },
        { id: 'upload_payment_screenshot', label: 'Upload Payment Screenshot', level: 'write' },
        { id: 'add_additional_payment', label: 'Add Additional Payment', level: 'write', sensitive: true },
        { id: 'add_balance_payment', label: 'Add Balance Payment', level: 'write', sensitive: true },
        { id: 'view_payment_history', label: 'View Payment History', level: 'read', sensitive: true },
        { id: 'verify_payments', label: 'Verify Payments', level: 'write', sensitive: true },
        { id: 'reject_payments', label: 'Reject Payments', level: 'write', sensitive: true },
        { id: 'edit_payment_records', label: 'Edit Payment Records', level: 'write', sensitive: true },
      ],
    },
    {
      id: 'editor_assign',
      label: 'Editor assignment',
      actions: [
        { id: 'view_assigned_editor', label: 'View Assigned Editor', level: 'read' },
        { id: 'assign_editor', label: 'Assign Editor', level: 'write' },
        { id: 'reassign_editor', label: 'Reassign Editor', level: 'write' },
        { id: 'view_other_editors', label: 'View Other Editors', level: 'read' },
      ],
    },
    {
      id: 'dispatch',
      label: 'Courier & dispatch',
      actions: [
        { id: 'view_courier_details', label: 'View Courier Details', level: 'read' },
        { id: 'add_tracking_id', label: 'Add Tracking ID', level: 'write' },
        { id: 'edit_tracking_id', label: 'Edit Tracking ID', level: 'write' },
        { id: 'update_dispatch_details', label: 'Update Dispatch Details', level: 'write' },
        { id: 'view_courier_charges', label: 'View Courier Charges', level: 'read', sensitive: true },
        { id: 'edit_courier_charges', label: 'Edit Courier Charges', level: 'write', sensitive: true },
      ],
    },
  ],
  operations: [
    {
      id: 'ops_board',
      label: 'Operations board',
      actions: [
        { id: 'view_operations_dashboard', label: 'View Operations Dashboard', level: 'read' },
        { id: 'view_new_orders', label: 'View New Orders', level: 'read' },
        { id: 'view_editing_pending', label: 'View Editing Pending', level: 'read' },
        { id: 'view_editing_in_progress', label: 'View Editing in Progress', level: 'read' },
        { id: 'view_printing_pending', label: 'View Printing Pending', level: 'read' },
        { id: 'view_printing_in_progress', label: 'View Printing in Progress', level: 'read' },
        { id: 'view_production', label: 'View Production', level: 'read' },
        { id: 'view_packing', label: 'View Packing', level: 'read' },
        { id: 'view_dispatch_ready', label: 'View Dispatch Ready', level: 'read' },
        { id: 'view_dispatched_orders', label: 'View Dispatched Orders', level: 'read' },
        { id: 'view_overdue_orders', label: 'View Overdue Orders', level: 'read' },
        { id: 'view_work_planner', label: 'View Work Planner', level: 'read' },
        { id: 'view_staff_workload', label: 'View Staff Workload', level: 'read' },
      ],
    },
    {
      id: 'ops_actions',
      label: 'Operations actions',
      actions: [
        { id: 'update_operations_status', label: 'Update Operations Status', level: 'write' },
        { id: 'start_editing', label: 'Start Editing', level: 'write' },
        { id: 'mark_editing_completed', label: 'Mark Editing Completed', level: 'write' },
        { id: 'send_for_customer_preview', label: 'Send for Customer Preview', level: 'write' },
        { id: 'put_order_on_hold', label: 'Put Order On Hold', level: 'write' },
        { id: 'resume_on_hold_orders', label: 'Resume On Hold Orders', level: 'write' },
      ],
    },
    {
      id: 'editor_work',
      label: 'Editor work',
      actions: [
        { id: 'view_assigned_orders_editor', label: 'View Assigned Orders', level: 'read' },
        { id: 'view_customer_photos', label: 'View Customer Photos', level: 'read' },
        { id: 'download_customer_photos', label: 'Download Customer Photos', level: 'read', sensitive: true },
        { id: 'view_reference_images_ops', label: 'View Reference Images', level: 'read' },
        { id: 'upload_edited_photos', label: 'Upload Edited Photos', level: 'write' },
        { id: 'replace_edited_photos', label: 'Replace Edited Photos', level: 'write' },
        { id: 'delete_edited_photos', label: 'Delete Edited Photos', level: 'write', sensitive: true },
        { id: 'crop_images', label: 'Crop Images', level: 'write' },
        { id: 'edit_images', label: 'Edit Images', level: 'write' },
        { id: 'upload_design_preview', label: 'Upload Design Preview', level: 'write' },
        { id: 'view_design_preview', label: 'View Design Preview', level: 'read' },
        { id: 'view_printing_requirements', label: 'View Printing Requirements', level: 'read' },
        { id: 'view_other_editors_orders', label: "View Other Editors' Orders", level: 'read', sensitive: true },
      ],
    },
  ],
  products: [
    {
      id: 'catalog',
      label: 'Catalog',
      actions: [
        { id: 'view_products', label: 'View Products', level: 'read' },
        { id: 'create_products', label: 'Create Products', level: 'write' },
        { id: 'edit_products', label: 'Edit Products', level: 'write' },
        { id: 'delete_products', label: 'Delete Products', level: 'write', sensitive: true },
        { id: 'manage_variants', label: 'Manage Product Variants', level: 'write' },
        { id: 'manage_sizes', label: 'Manage Product Sizes', level: 'write' },
        { id: 'manage_product_images', label: 'Manage Product Images', level: 'write' },
        { id: 'manage_custom_fields', label: 'Manage Custom Fields', level: 'write' },
        { id: 'manage_photo_upload_config', label: 'Manage Photo Upload Configuration', level: 'write' },
        { id: 'manage_categories', label: 'Manage Product Categories', level: 'write' },
      ],
    },
  ],
  'making-cost': [
    {
      id: 'costs',
      label: 'Making cost',
      actions: [
        { id: 'view_making_cost', label: 'View Making Cost', level: 'read', sensitive: true },
        { id: 'edit_making_cost', label: 'Edit Making Cost', level: 'write', sensitive: true },
      ],
    },
  ],
  reports: [
    {
      id: 'reports_core',
      label: 'Reports',
      actions: [
        { id: 'view_sales_reports', label: 'View Sales Reports', level: 'read', sensitive: true },
        { id: 'view_payment_reports', label: 'View Payment Reports', level: 'read', sensitive: true },
        { id: 'view_courier_expenses', label: 'View Courier Expenses', level: 'read', sensitive: true },
        { id: 'export_reports', label: 'Export Reports', level: 'read', sensitive: true },
      ],
    },
  ],
  revenue: [
    {
      id: 'revenue_core',
      label: 'Revenue',
      actions: [
        { id: 'view_revenue_analytics', label: 'View Revenue', level: 'read', sensitive: true },
        { id: 'view_profit_reports', label: 'View Profit Reports', level: 'read', sensitive: true },
        { id: 'view_manufacturing_costs', label: 'View Manufacturing Costs', level: 'read', sensitive: true },
        { id: 'download_financial_reports', label: 'Download Financial Reports', level: 'read', sensitive: true },
      ],
    },
  ],
};

export function listModuleActions(moduleId) {
  const groups = MODULE_ACTION_CATALOG[moduleId] || [];
  return groups.flatMap((g) => g.actions.map((a) => ({ ...a, submoduleId: g.id, submoduleLabel: g.label })));
}

export function getActionMeta(moduleId, actionId) {
  return listModuleActions(moduleId).find((a) => a.id === actionId) || null;
}

export function moduleHasActionCatalog(moduleId) {
  return Array.isArray(MODULE_ACTION_CATALOG[moduleId]) && MODULE_ACTION_CATALOG[moduleId].length > 0;
}

/**
 * Build action map for a module.
 * expandFromRw: when true and no explicit actions, prefill from read/write (UI helper).
 */
export function normalizeModuleActions(moduleId, actionsInput, { read = false, write = false, expandFromRw = false } = {}) {
  const defs = listModuleActions(moduleId);
  if (!defs.length) return undefined;

  const source = actionsInput && typeof actionsInput === 'object' ? actionsInput : null;
  const hasExplicit = source && Object.keys(source).length > 0;

  if (!hasExplicit && !expandFromRw) return undefined;

  const out = {};
  defs.forEach((def) => {
    if (hasExplicit && Object.prototype.hasOwnProperty.call(source, def.id)) {
      out[def.id] = source[def.id] === true;
      return;
    }
    if (expandFromRw || hasExplicit) {
      // Missing explicit key while other actions exist → default deny for unset keys when editing granular
      // When expandFromRw and nothing saved → inherit module RW
      if (!hasExplicit && expandFromRw) {
        out[def.id] = def.level === 'write' ? write === true : (read === true || write === true);
      } else if (hasExplicit) {
        out[def.id] = false;
      }
    }
  });
  return out;
}

export function summarizeModuleActions(moduleId, actions = {}) {
  const defs = listModuleActions(moduleId);
  if (!defs.length) return { total: 0, enabled: 0 };
  const enabled = defs.filter((d) => actions?.[d.id] === true).length;
  return { total: defs.length, enabled };
}

export function normalizeDataVisibility(value, fallback = 'assigned') {
  const id = String(value || '').trim().toLowerCase();
  if (DATA_VISIBILITY_OPTIONS.some((o) => o.id === id)) return id;
  return fallback;
}
