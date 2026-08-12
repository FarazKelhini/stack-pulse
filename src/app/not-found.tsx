import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold">Technology not found</h2>
      <Link href="/search" className="text-blue-600 underline">Return to search</Link>
    </div>
  );
}
