import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid place-items-center h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
        <p className="text-sm text-secondary mb-6">Page not found</p>
        <Link href="/" className="text-sm text-primary hover:underline">
          Back to Meetings
        </Link>
      </div>
    </div>
  );
}
