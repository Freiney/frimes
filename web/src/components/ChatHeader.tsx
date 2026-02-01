interface ChatHeaderProps {
  title: string;
  status: string;
  onAudioCall: () => void;
  onVideoCall: () => void;
}

export function ChatHeader({ title, status, onAudioCall, onVideoCall }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{status}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAudioCall}
          className="rounded-full bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800"
        >
          📞 Audio
        </button>
        <button
          onClick={onVideoCall}
          className="rounded-full bg-primary-500 px-4 py-2 text-sm text-white"
        >
          🎥 Video
        </button>
      </div>
    </header>
  );
}
