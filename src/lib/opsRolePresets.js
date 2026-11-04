import { emptyAdminPermissions } from '@/lib/adminPermissions';

/** Production-ready role permission packs for GroveryGiftz ops staff. */
export const OPS_ROLE_PRESETS = [
  {
    name: 'Sales Person',
    slug: 'sales-person',
    description: 'Create WhatsApp orders, manage assigned orders, designs sharing, payments, and tracking.',
    permissions: {
      ...emptyAdminPermissions(),
      dashboard: { read: true, write: false },
      orders: { read: true, write: true },
      operations: { read: true, write: true },
      customers: { read: true, write: false },
      products: { read: true, write: false },
    },
  },
  {
    name: 'Editor',
    slug: 'editor',
    description: 'Access design tasks, customer photos, upload designs, and manage revisions.',
    permissions: {
      ...emptyAdminPermissions(),
      dashboard: { read: true, write: false },
      orders: { read: true, write: true },
      operations: { read: true, write: true },
      products: { read: true, write: false },
    },
  },
  {
    name: 'Production Employee',
    slug: 'production-employee',
    description: 'Manage production, packing, quality checks, and completion videos.',
    permissions: {
      ...emptyAdminPermissions(),
      dashboard: { read: true, write: false },
      orders: { read: true, write: true },
      operations: { read: true, write: true },
    },
  },
];
