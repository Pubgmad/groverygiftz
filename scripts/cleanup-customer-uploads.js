const baseUrl = process.env.CLEANUP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const secret = process.env.CLEANUP_SECRET;
const dryRun = process.env.CLEANUP_DRY_RUN === 'true';
const retentionDays = process.env.CLEANUP_RETENTION_DAYS || '30';

if (!secret) {
  console.error('CLEANUP_SECRET is required.');
  process.exit(1);
}

async function main() {
  const url = new URL('/api/admin/cleanup-customer-uploads', baseUrl);
  url.searchParams.set('retentionDays', retentionDays);
  if (dryRun) url.searchParams.set('dryRun', 'true');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-cleanup-secret': secret },
  });

  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep non-JSON errors readable for scheduled job logs.
  }

  if (!response.ok) {
    console.error('Customer upload cleanup failed:', body);
    process.exit(1);
  }

  console.log('Customer upload cleanup completed:');
  console.log(JSON.stringify(body, null, 2));
}

main().catch((error) => {
  console.error('Customer upload cleanup failed:', error);
  process.exit(1);
});
