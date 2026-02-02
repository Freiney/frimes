import { useEffect, useMemo, useRef, useState } from "react";
import { ChatSummary, MessageSummary, CallType, CallState, SocketEvents } from "@frimes/shared";
import type { Socket } from "socket.io-client";
import { Sidebar } from "./components/Sidebar";
import { ChatHeader } from "./components/ChatHeader";
import { MessageList } from "./components/MessageList";
import { MessageComposer } from "./components/MessageComposer";
import { CallOverlay } from "./components/CallOverlay";
import { createSocket } from "./utils/socket";
import { getChats, getMessages, login } from "./utils/api";

export default function App() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callType, setCallType] = useState<CallType>("audio");
  const [callError, setCallError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("accessToken") || "");
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password123");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId), [chats, activeChatId]);

  useEffect(() => {
    if (!accessToken) return;
    getChats(accessToken)
      .then((data) => {
        setChats(data);
        if (data.length && !activeChatId) {
          setActiveChatId(data[0].id);
        }
      })
      .catch(() => undefined);
  }, [accessToken, activeChatId]);

  useEffect(() => {
    if (!accessToken || !activeChatId) return;
    getMessages(accessToken, activeChatId)
      .then((data) => setMessages(data))
      .catch(() => undefined);
  }, [accessToken, activeChatId]);

  useEffect(() => {
    if (!accessToken) return;
    const socket = createSocket(accessToken);
    socketRef.current = socket;

    socket.on("connect", () => console.log("socket connected", socket.id));
    socket.on("disconnect", () => console.log("socket disconnected"));
    socket.on(SocketEvents.MessageSend, (payload: MessageSummary) => {
      if (payload.chatId === activeChatId) {
        setMessages((prev) => [...prev, payload]);
      }
    });

    socket.on(SocketEvents.CallStart, (payload: { chatId: string; callType: CallType }) => {
      if (payload.chatId !== activeChatId) return;
      setCallType(payload.callType);
      setCallState("ringing");
      socket.emit(SocketEvents.CallRinging, { chatId: payload.chatId });
    });

    socket.on(SocketEvents.CallAccept, async (payload: { chatId: string }) => {
      if (payload.chatId !== activeChatId) return;
      setCallState("in_call");
      try {
        await createOffer(payload.chatId);
      } catch (error) {
        setCallState("ended");
      }
    });

    socket.on(SocketEvents.CallReject, (payload: { reason?: string }) => {
      if (payload.reason === "busy") {
        setCallError("Абонент занят. Попробуйте позже.");
      }
      setCallState("ended");
      cleanupCall();
    });

    socket.on(SocketEvents.CallEnd, () => {
      setCallState("ended");
      cleanupCall();
    });

    socket.on(SocketEvents.WebRtcOffer, async (payload: { chatId: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload.chatId !== activeChatId) return;
      const pc = await ensurePeerConnection(payload.chatId);
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit(SocketEvents.WebRtcAnswer, { chatId: payload.chatId, sdp: answer });
    });

    socket.on(SocketEvents.WebRtcAnswer, async (payload: { chatId: string; sdp: RTCSessionDescriptionInit }) => {
      if (payload.chatId !== activeChatId) return;
      const pc = peerRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp);
    });

    socket.on(SocketEvents.WebRtcIceCandidate, async (payload: { chatId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.chatId !== activeChatId) return;
      const pc = peerRef.current;
      if (!pc) return;
      await pc.addIceCandidate(payload.candidate);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, activeChatId]);

  const startCall = (type: CallType) => {
    setCallError(null);
    setCallType(type);
    setCallState("calling");
    if (socketRef.current && activeChatId) {
      socketRef.current.emit(SocketEvents.CallStart, { chatId: activeChatId, callType: type });
    }
  };

  const endCall = () => {
    setCallError(null);
    setCallState("ended");
    setTimeout(() => setCallState("idle"), 800);
    if (socketRef.current && activeChatId) {
      socketRef.current.emit(SocketEvents.CallEnd, { chatId: activeChatId });
    }
    cleanupCall();
  };

  const acceptCall = async () => {
    if (!socketRef.current || !activeChatId) return;
    setCallState("in_call");
    setCallError(null);
    socketRef.current.emit(SocketEvents.CallAccept, { chatId: activeChatId });
    try {
      await ensurePeerConnection(activeChatId);
    } catch (error) {
      setCallState("ended");
    }
  };

  const sendMessage = (text: string) => {
    if (!socketRef.current || !activeChatId) return;
    socketRef.current.emit(SocketEvents.MessageSend, { chatId: activeChatId, body: text });
  };

  const handleLogin = async () => {
    const result = await login(email, password);
    localStorage.setItem("accessToken", result.accessToken);
    setAccessToken(result.accessToken);
  };

  const ensurePeerConnection = async (chatId: string) => {
    if (peerRef.current) return peerRef.current;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit(SocketEvents.WebRtcIceCandidate, { chatId, candidate: event.candidate });
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (error) {
      setCallError("Нет доступа к микрофону/камере. Разрешите доступ и повторите вызов.");
      throw error;
    }

    return pc;
  };

  const createOffer = async (chatId: string) => {
    const pc = await ensurePeerConnection(chatId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current?.emit(SocketEvents.WebRtcOffer, { chatId, sdp: offer });
  };

  const cleanupCall = () => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="flex h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {!accessToken && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <h2 className="text-lg font-semibold">Вход</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Используйте seed аккаунты</p>
              <div className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  onClick={handleLogin}
                  className="w-full rounded-xl bg-primary-500 px-4 py-2 text-sm text-white"
                >
                  Войти
                </button>
              </div>
            </div>
          </div>
        )}
        <Sidebar
          chats={chats}
          activeChatId={activeChatId || ""}
          onSelect={(id) => setActiveChatId(id)}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((prev) => !prev)}
        />
        <div className="flex flex-1 flex-col">
          <ChatHeader
            title={activeChat?.title || "Chat"}
            status={activeChat ? "online" : "offline"}
            onAudioCall={() => startCall("audio")}
            onVideoCall={() => startCall("video")}
          />
          <MessageList messages={messages} />
          <MessageComposer onSend={sendMessage} />
        </div>
        <CallOverlay
          state={callState}
          callType={callType}
          errorMessage={callError}
          onAccept={acceptCall}
          onReject={endCall}
          onEnd={endCall}
          onToggleMic={() => undefined}
          onToggleCamera={() => undefined}
        />
      </div>
    </div>
  );
}
