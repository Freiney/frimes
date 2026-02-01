import { useMemo, useState } from "react";
import { ChatSummary, MessageSummary, CallType, CallState } from "@frimes/shared";
import { Sidebar } from "./components/Sidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { MessageComposer } from "./components/MessageComposer";
import { CallOverlay } from "./components/CallOverlay";

const demoChats: ChatSummary[] = [
  {
    id: "1",
    title: "Alice",
    type: "direct",
    avatarUrl: null,
    unreadCount: 1,
  },
  {
    id: "2",
    title: "Frimes Team",
    type: "group",
    avatarUrl: null,
    unreadCount: 0,
  },
];

const demoMessages: Record<string, MessageSummary[]> = {
  "1": [
    {
      id: "m1",
      chatId: "1",
      senderId: "alice",
      body: "Привет! Готовы к демо звонка?",
      createdAt: new Date().toISOString(),
      status: "read",
    },
  ],
  "2": [
    {
      id: "m2",
      chatId: "2",
      senderId: "bob",
      body: "Сегодня релиз Frimes",
      createdAt: new Date().toISOString(),
      status: "delivered",
    },
  ],
};

export default function App() {
  const [activeChatId, setActiveChatId] = useState("1");
  const [darkMode, setDarkMode] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("audio");

  const messages = useMemo(() => demoMessages[activeChatId] || [], [activeChatId]);

  const startCall = (type: CallType) => {
    setCallType(type);
    setCallState("calling");
  };

  const endCall = () => {
    setCallState("ended");
    setTimeout(() => setCallState("idle"), 800);
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Sidebar
          chats={demoChats}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((prev) => !prev)}
        />
        <div className="flex flex-1 flex-col">
          <ChatHeader
            title={demoChats.find((chat) => chat.id === activeChatId)?.title || "Chat"}
            status="online"
            onAudioCall={() => startCall("audio")}
            onVideoCall={() => startCall("video")}
          />
          <MessageList messages={messages} />
          <MessageComposer onSend={() => undefined} />
        </div>
        <CallOverlay
          state={callState}
          callType={callType}
          onAccept={() => setCallState("in_call")}
          onReject={endCall}
          onEnd={endCall}
          onToggleMic={() => undefined}
          onToggleCamera={() => undefined}
        />
      </div>
    </div>
  );
}
