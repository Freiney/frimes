import { useState } from "react";

interface MessageComposerProps {
  onSend: (text: string) => void;
}

export function MessageComposer({ onSend }: MessageComposerProps) {
  const [text, setText] = useState("");

  return (
    <div className="border-t border-slate-200 bg-white/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <button className="rounded-full bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">＋</button>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Написать сообщение..."
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:outline-none dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          onClick={() => {
            if (!text.trim()) return;
            onSend(text);
            setText("");
          }}
          className="rounded-full bg-primary-500 px-4 py-2 text-sm text-white"
        >
          Отправить
        </button>
      </div>
    </div>
  );
}
