export function createPeerConnection() {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  return new RTCPeerConnection({ iceServers });
}
