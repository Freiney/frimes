const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  return apiRequest<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getChats(accessToken: string) {
  return apiRequest<any[]>("/chats", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getMessages(accessToken: string, chatId: string) {
  const params = new URLSearchParams({ chatId });
  return apiRequest<any[]>(`/chats/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
