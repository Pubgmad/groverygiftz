/** Admin auth pages are request-time only — avoid Mongo-backed SSG of login chrome. */
export const dynamic = 'force-dynamic';

export default function AdminSectionLayout({ children }) {
  return children;
}
