/** Shimmer placeholders shown while the first library request is in flight. */
export default function Skeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="glass rounded-blob rise p-2"
          // Staggered so the grid resolves as a wave rather than all at once.
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="rounded-soft shimmer aspect-video" />
          <div className="space-y-2 px-2 pt-3 pb-1.5">
            <div className="shimmer h-3 w-2/3 rounded-full" />
            <div className="shimmer h-2.5 w-2/5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
