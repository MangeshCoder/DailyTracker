export type MessageRole = "user" | "assistant";

export interface SuggestedAction {
  id: string;
  type:
    | "CREATE_TASK"
    | "UPDATE_TASK_STATUS"
    | "START_BREAK"
    | "END_BREAK"
    | "APPLY_LEAVE"
    | "APPLY_WFH"
    | "CHECK_IN"
    | "CHECK_OUT"
    | "CREATE_GOAL"
    | "SUBMIT_EOD"
    | "NAVIGATE";
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