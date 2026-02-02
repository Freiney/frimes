# WebRTC Calls

## Socket events

| Event | Direction | Payload |
| --- | --- | --- |
| `call:start` | caller → server → callee | `{ chatId, callType }` |
| `call:ringing` | callee → server → caller | `{ chatId }` |
| `call:accept` | callee → server → caller | `{ chatId }` |
| `call:reject` | callee → server → caller | `{ chatId, reason }` |
| `call:end` | any → server → peer | `{ chatId }` |
| `webrtc:offer` | caller → server → callee | `{ chatId, sdp }` |
| `webrtc:answer` | callee → server → caller | `{ chatId, sdp }` |
| `webrtc:ice-candidate` | any → server → peer | `{ chatId, candidate }` |

Server validates JWT per socket and ensures both users belong to the chat before relaying events.

## Permissions (Android)

Expo config already declares `RECORD_AUDIO` and `CAMERA`. Make sure the runtime permission prompt is handled before creating a call.

## TURN (coturn)

Use STUN by default (`stun:stun.l.google.com:19302`). If peers cannot connect in strict NAT, enable TURN:

1. Start coturn via docker compose:
   ```bash
   docker compose --profile turn up coturn
   ```
2. Update client ICE servers:
   ```ts
   const iceServers = [
     { urls: "stun:stun.l.google.com:19302" },
     { urls: "turn:localhost:3478", username: "frimes", credential: "frimes" },
   ];
   ```
3. For production, change username/password and set realm.
