export default function ReadOnlyBanner({ show }) {
  if (!show) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      You have read-only access. Viewing is allowed; creating, editing, and deleting are blocked.
    </div>
  );
}
