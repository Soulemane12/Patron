export default function TestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Test Page</h1>
      <p className="text-xl">If you can see this, the deployment is working!</p>
      <p className="mt-4">Environment check:</p>
      <p className="text-sm mt-2">
        NEXT_PUBLIC_BASE_URL is {process.env.NEXT_PUBLIC_BASE_URL || "not set"}
      </p>
      <p className="text-sm">
        GROQ_API_KEY is {process.env.GROQ_API_KEY ? "set" : "not set"}
      </p>
      <p className="text-sm">
        EMAIL_PASSWORD is {process.env.EMAIL_PASSWORD ? "set" : "not set"}
      </p>
      <p className="text-sm">
        NEXT_PUBLIC_SUPABASE_URL is {process.env.NEXT_PUBLIC_SUPABASE_URL || "not set"}
      </p>
      <p className="text-sm">
        NEXT_PUBLIC_SUPABASE_ANON_KEY is {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "not set"}
      </p>
    </div>
  );
}