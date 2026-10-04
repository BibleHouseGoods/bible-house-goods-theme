export default function Wordmark() {
  return (
    <div className="flex items-end gap-[5px]" aria-hidden>
      {[10, 22, 36, 20, 8].map((h, i) => (
        <span key={i} className={`w-[5px] rounded-full ${i === 4 ? 'bg-bible-house' : 'bg-ink'}`} style={{ height: h }} />
      ))}
    </div>
  );
}
