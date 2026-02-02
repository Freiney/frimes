import { ChatSummary } from "@frimes/shared";

interface SidebarProps {
  chats: ChatSummary[];
  activeChatId: string;
  onSelect: (id: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export function Sidebar({ chats, activeChatId, onSelect, darkMode, onToggleTheme }: SidebarProps) {
  return (
    <aside className="flex w-80 flex-col border-r border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Frimes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Messenger</p>
        </div>
        <button
          onClick={onToggleTheme}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800"
        >
          {darkMode ? "Light" : "Dark"}
        </button>
      </div>
      <input
        className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        placeholder="Поиск чатов..."
      />
      <div className="mt-4 space-y-2 overflow-y-auto">
        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
              activeChatId === chat.id
                ? "bg-primary-500 text-white"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1">
              <p className="font-medium">{chat.title}</p>
              <p className="text-xs opacity-70">Новые сообщения ждут</p>
            </div>
            {chat.unreadCount > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-1 text-xs">{chat.unreadCount}</span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
