export const ADMIN_BASE_PATH = '/account/manage';

export const ADMIN_MODULES = [
  { id: 'dashboard', label: 'Dashboard', href: ADMIN_BASE_PATH, writeSupported: false, description: 'Store overview and recent paid-order summary.' },
  { id: 'products', label: 'Products', href: `${ADMIN_BASE_PATH}/products`, writeSupported: true, description: 'Catalog, variants, stock, images, and product pages.' },
  { id: 'making-cost', label: 'Making Cost', href: `${ADMIN_BASE_PATH}/making-cost`, writeSupported: true, description: 'Product and variant making costs used for product gross profit. Separate from catalog editing.' },
  { id: 'collections', label: 'Collections', href: `${ADMIN_BASE_PATH}/collections`, writeSupported: true, description: 'Storefront collections and featured grouping.' },
  { id: 'shipping', label: 'Shipping Templates', href: `${ADMIN_BASE_PATH}/shipping`, writeSupported: true, description: 'State shipping templates used at checkout.' },
  { id: 'estimated-delivery', label: 'Estimated Delivery Days', href: `${ADMIN_BASE_PATH}/estimated-delivery`, writeSupported: true, description: 'Central Tamil Nadu and other-state delivery estimates.' },
  { id: 'orders', label: 'Orders', href: `${ADMIN_BASE_PATH}/orders`, writeSupported: true, description: 'Website and WhatsApp orders, status, tracking, shipping labels, and customer upload originals.' },
  { id: 'operations', label: 'Operations', href: `${ADMIN_BASE_PATH}/operations`, writeSupported: true, description: 'Ops board, tasks, design approval, printing, production, packing, and dispatch.' },
  { id: 'reports', label: 'Reports', href: `${ADMIN_BASE_PATH}/reports`, writeSupported: false, description: 'Payment and parcel dispatch date reports, staff collections, and combined order history (IST).' },
  { id: 'revenue', label: 'Revenue Analytics', href: `${ADMIN_BASE_PATH}/revenue`, writeSupported: false, description: 'Aggregated paid-order revenue, geography, products, and timing. Read-only.' },
  { id: 'customers', label: 'Customers', href: `${ADMIN_BASE_PATH}/customers`, writeSupported: false, description: 'Customer account list. No admin edits exist in this module.' },
  { id: 'reviews', label: 'Reviews', href: `${ADMIN_BASE_PATH}/reviews`, writeSupported: false, description: 'Verified customer reviews. No admin edits exist in this module.' },
  { id: 'banners', label: 'Banners', href: `${ADMIN_BASE_PATH}/banners`, writeSupported: true, description: 'Homepage hero banners.' },
  { id: 'gift-recommender', label: 'Gift Recommender', href: `${ADMIN_BASE_PATH}/gift-recommender`, writeSupported: true, description: 'Storefront gift finder options and quick picks.' },
  { id: 'blogs', label: 'Blogs', href: `${ADMIN_BASE_PATH}/blogs`, writeSupported: true, description: 'Blog posts and featured images.' },
  { id: 'pages', label: 'Pages', href: `${ADMIN_BASE_PATH}/pages`, writeSupported: true, description: 'About, policies, and other content pages.' },
  { id: 'newsletter', label: 'Newsletter', href: `${ADMIN_BASE_PATH}/newsletter`, writeSupported: false, description: 'Subscriber list. Public subscribe remains unchanged.' },
  { id: 'messages', label: 'Messages', href: `${ADMIN_BASE_PATH}/messages`, writeSupported: false, description: 'Contact form inbox. No persisted admin edits exist in this module.' },
  { id: 'settings', label: 'Settings', href: `${ADMIN_BASE_PATH}/settings`, writeSupported: true, description: 'Store identity, payments, tracking keys, and homepage media.' },
];

export const ADMIN_MODULE_IDS = ADMIN_MODULES.map((module) => module.id);
export const ADMIN_UPLOAD_MODULES = ['products', 'collections', 'banners', 'blogs', 'settings'];
export const GIFT_RECOMMENDER_SETTING_KEYS = [
  'giftFinderStillConfused',
  'giftFinderTryLine',
  'giftFinderDescription',
  'giftFinderOccasions',
  'giftFinderTypes',
  'giftFinderQuickPicks',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyAdminPermissions() {
  return Object.fromEntries(ADMIN_MODULES.map((module) => [module.id, { read: false, write: false }]));
}

export function fullAdminPermissions() {
  return Object.fromEntries(ADMIN_MODULES.map((module) => [module.id, { read: true, write: !!module.writeSupported }]));
}

export function moduleById(moduleId) {
  return ADMIN_MODULES.find((module) => module.id === moduleId) || null;
}

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value = '') {
  const email = normalizeEmail(value);
  return email.length > 3 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function normalizeRoleName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function roleSlugFromName(name = '') {
  return normalizeRoleName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function normalizePermissions(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(ADMIN_MODULES.map((module) => {
    const row = source[module.id] && typeof source[module.id] === 'object' ? source[module.id] : {};
    const write = module.writeSupported && row.write === true;
    const read = write || row.read === true;
    return [module.id, { read, write }];
  }));
}

export function hasModulePermission(permissions, moduleId, action = 'read') {
  if (!ADMIN_MODULE_IDS.includes(moduleId)) return false;
  const row = permissions?.[moduleId];
  if (!row) return false;
  if (action === 'write') return row.write === true;
  return row.read === true || row.write === true;
}

export function moduleIdFromPath(pathname = '') {
  const path = String(pathname || '').split('?')[0];
  if (path === ADMIN_BASE_PATH || path === `${ADMIN_BASE_PATH}/`) return 'dashboard';
  if (path === `${ADMIN_BASE_PATH}/roles` || path.startsWith(`${ADMIN_BASE_PATH}/roles/`)) return 'roles';
  const match = ADMIN_MODULES
    .filter((module) => module.id !== 'dashboard')
    .sort((a, b) => b.href.length - a.href.length)
    .find((module) => path === module.href || path.startsWith(`${module.href}/`));
  return match?.id || null;
}

export function publicAdminAccess() {
  return {
    ok: false,
    status: 401,
    message: 'Unauthorized',
    isPrimary: false,
    adminActive: false,
    accessStatus: 'unauthenticated',
    roleId: null,
    roleName: '',
    permissions: emptyAdminPermissions(),
  };
}

export function primaryAdminAccess() {
  return {
    ok: true,
    status: 200,
    message: '',
    isPrimary: true,
    adminActive: true,
    accessStatus: 'primary',
    roleId: null,
    roleName: 'Primary admin',
    permissions: fullAdminPermissions(),
  };
}
