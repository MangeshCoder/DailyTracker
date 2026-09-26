import type { ChatApiResponse, MessageHistory } from "../types/chat";

const BASE_URL = 'https://localhost:7096/api';

export const sendMessage = async (
  message: string,
  history: MessageHistory[]
): Promise<string> => {
  const response = await fetch(`${BASE_URL}/aichat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  const data: ChatApiResponse = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error ?? "Failed to get AI response.");
  }

  return data.reply;
};