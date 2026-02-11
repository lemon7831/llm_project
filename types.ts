
export type Role = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departments: string[]; // For permissions
}

export interface FileData {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  permissions: string[]; // 'public' or specific department names
  tags: string[]; // AI generated tags
}

// Step 7: Data Processing Strategy
export interface ProcessingPipeline {
  output_nature: 'raw' | 'ai'; // 'raw' (needs cleaning) or 'ai' (ready to use)
  pipeline: {
    code_cleaner: boolean;
    auto_summarize: boolean;
    summary_model: string; // e.g., 'gemini-3-flash-preview'
    threshold: number; // Token count threshold
  };
}

export interface BotConfig {
  name: string;
  persona: string;
  systemPrompt: string; // The editable prompt
  activeTools: string[]; // IDs of enabled MCP tools
  qualityRules: string[]; // Step 8: Reflector rules (Legacy IDs)
  reflectorPrompt: string; // Step 8: The actual editable prompt text
  toolMetadata: Record<string, any>; // Step 6.2: Advanced Tool Metadata
  toolProcessingRules: Record<string, ProcessingPipeline>; // Step 7: Advanced Data Processing Rules
}

export interface ThoughtStep {
  id: number;
  name: string; // e.g., "意圖分析"
  status: 'pending' | 'processing' | 'done';
  message: string; // e.g., "正在分析使用者意圖..."
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  thoughtProcess?: ThoughtStep[];
  feedback?: 'like' | 'dislike' | null; // Step 16: User feedback
  isPinned?: boolean; // Step 16: Added to memory
}

export interface ChatSession {
  id: string;
  userId: string;
  userName: string;
  department: string;
  startTime: string; // ISO string
  messages: ChatMessage[];
  lastMessageAt: string;
}

export type ViewMode = 'admin' | 'chat';
// Updated AdminStep to include dashboard, quality, and audit
export type AdminStep = 'dashboard' | 'identity' | 'departments' | 'members' | 'knowledge' | 'skills' | 'quality' | 'audit';

// Mock Data Types for Dashboard
export interface DashboardStats {
  planName: string;
  renewalDate: string;
  usageRound: number;
  maxRound: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  activeUsers: number;
  toolUsage: { name: string; count: number }[];
  costTrend: { date: string; cost: number; chats: number }[];
}

// Step 16: Feedback & Memory Types
export interface FeedbackCorrection {
  id: string;
  messageId: string;
  originalQuery: string;
  badAnswer: string;
  errorReason: string;
  correction: string;
  timestamp: string;
}

export interface UserMemory {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}
