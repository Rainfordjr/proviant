export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-56 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-4 w-72 rounded bg-gray-100 animate-pulse mt-2" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-32 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-7 w-48 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-9 w-36 rounded-lg bg-blue-200 animate-pulse" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-2 py-2 text-center">
              <div className="h-4 w-8 mx-auto rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[100px] border-b border-r border-gray-200 p-2"
            >
              <div className="h-5 w-5 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
