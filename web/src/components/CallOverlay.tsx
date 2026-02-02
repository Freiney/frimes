import { CallState, CallType } from "@frimes/shared";

interface CallOverlayProps {
  state: CallState;
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export function CallOverlay({
  state,
  callType,
  onAccept,
  onReject,
  onEnd,
  onToggleMic,
  onToggleCamera,
}: CallOverlayProps) {
  if (state === "idle") {
    return null;
  }

  const title = callType === "video" ? "Видеозвонок" : "Аудиозвонок";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-6">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <h3 className="text-2xl font-semibold">{state === "calling" ? "Звоним..." : "Соединение"}</h3>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-500">00:12</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="aspect-video rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="aspect-video rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          {state === "ringing" && (
            <button onClick={onAccept} className="rounded-full bg-emerald-500 px-5 py-3 text-white">
              Принять
            </button>
          )}
          {state !== "ended" && (
            <button onClick={onReject} className="rounded-full bg-rose-500 px-5 py-3 text-white">
              {state === "ringing" ? "Отклонить" : "Завершить"}
            </button>
          )}
          <button onClick={onToggleMic} className="rounded-full bg-slate-100 px-5 py-3 dark:bg-slate-800">
            Микрофон
          </button>
          <button
            onClick={onToggleCamera}
            className="rounded-full bg-slate-100 px-5 py-3 dark:bg-slate-800"
          >
            Камера
          </button>
        </div>
      </div>
    </div>
  );
}
