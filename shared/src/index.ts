import { z } from "zod";

export const RegisterDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const UpdateProfileDto = z.object({
  name: z.string().min(1),
  about: z.string().max(160).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export type RegisterPayload = z.infer<typeof RegisterDto>;
export type LoginPayload = z.infer<typeof LoginDto>;
export type UpdateProfilePayload = z.infer<typeof UpdateProfileDto>;

export type ChatType = "direct" | "group";
export type MessageStatus = "sent" | "delivered" | "read";
export type CallType = "audio" | "video";
export type CallState = "idle" | "calling" | "ringing" | "in_call" | "ended" | "busy";

export interface SocketAuthPayload {
  token: string;
}

export interface SocketUser {
  id: string;
  email: string;
  name: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  type: ChatType;
  avatarUrl?: string | null;
  lastMessage?: MessageSummary | null;
  unreadCount: number;
}

export interface MessageSummary {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
  status: MessageStatus;
  attachments?: AttachmentSummary[];
}

export interface AttachmentSummary {
  id: string;
  url: string;
  type: "image" | "file";
  name: string;
}

export interface CallStartPayload {
  chatId: string;
  callType: CallType;
}

export interface CallAcceptPayload {
  chatId: string;
}

export interface CallRejectPayload {
  chatId: string;
  reason?: "busy" | "declined";
}

export interface CallEndPayload {
  chatId: string;
}

export interface WebRtcOfferPayload {
  chatId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRtcAnswerPayload {
  chatId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface WebRtcIceCandidatePayload {
  chatId: string;
  candidate: RTCIceCandidateInit;
}

export const SocketEvents = {
  CallStart: "call:start",
  CallRinging: "call:ringing",
  CallAccept: "call:accept",
  CallReject: "call:reject",
  CallEnd: "call:end",
  WebRtcOffer: "webrtc:offer",
  WebRtcAnswer: "webrtc:answer",
  WebRtcIceCandidate: "webrtc:ice-candidate",
  Typing: "chat:typing",
  MessageSend: "message:send",
  MessageStatus: "message:status",
  Presence: "presence:update",
};
