import Link from 'next/link';

export default function Breadcrumbs({ items }) {
  return (
    <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        <li><Link href="/" className="hover:text-primary-600 transition-colors">Home</Link></li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="mx-1">/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-primary-600 transition-colors">{item.label}</Link>
            ) : (
              <span className="text-gray-800 font-medium">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
