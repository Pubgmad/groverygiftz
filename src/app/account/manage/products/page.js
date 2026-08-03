'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { FiPlus, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async () => {
    setLoading(true);
    const res = await fetch(`/api/products?all=true&page=${page}&search=${search}&limit=20`);
    const data = await res.json();
    setProducts(data.products || []);
    setTotalPages(data.pages || 1);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [page, search]);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    toast.success('Product deleted');
    fetchProducts();
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/account/manage/products/new" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 sm:w-auto">
          <FiPlus /> Add Product
        </Link>
      </div>

      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <p className="p-6 text-center">Loading...</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead><tr className="bg-gray-50 text-left"><th className="p-4">Image</th><th className="p-4">Title</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden">
                      {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                  </td>
                  <td className="p-4 font-medium max-w-[220px] truncate">{p.title}</td>
                  <td className="p-4">{formatPrice(p.salePrice || p.regularPrice)}</td>
                  <td className="p-4">{p.stock}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link href={`/account/manage/products/${p._id}`} className="text-blue-600 hover:text-blue-800"><FiEdit /></Link>
                      <button onClick={() => handleDelete(p._id)} className="text-red-600 hover:text-red-800"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No products found</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => (
            <button key={i} onClick={() => setPage(i + 1)}
              className={`w-10 h-10 rounded-lg text-sm ${page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
