import { MessageSummary } from "@frimes/shared";

interface MessageListProps {
  messages: MessageSummary[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="space-y-4">
        {messages.map((message, index) => {
          const isSelf = index % 2 === 0;
          return (
            <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  isSelf
                    ? "bg-primary-500 text-white"
                    : "bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <p>{message.body}</p>
                <div className="mt-2 text-xs opacity-70">{new Date(message.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
