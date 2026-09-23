export type MessageRole = "user" | "assistant";

export interface SuggestedAction {
  id: string;
  type: "CREATE_TASK" | "SUBMIT_EOD" | "APPLY_WFH" | "APPLY_LEAVE" | "CHECK_IN" | "CHECK_OUT" | "NAVIGATE";
  title: string;
  payload: Record<string, any>;
  confirmed?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  category?: "Attendance" | "Tasks" | "EOD" | "Leave" | "Analytics" | "General";
}

export interface MessageHistory {
  role: MessageRole;
  content: string;
}

export interface ChatApiResponse {
  reply: string;
  success: boolean;
  actions?: SuggestedAction[];
  error?: string;
}