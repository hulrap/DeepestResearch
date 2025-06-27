// Memory System for AI Agents
import { createClient } from '@/lib/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Memory {
  id: string;
  user_id: string;
  memory_type: 'conversation' | 'preference' | 'fact' | 'pattern';
  content: string;
  importance_score: number;
  context_tags: string[];
  created_at: Date;
  last_accessed_at: Date;
}

export class MemorySystem {
  private supabase = createClient();

  // Store a new memory
  async storeMemory(
    userId: string,
    content: string,
    memoryType: Memory['memory_type'],
    importance: number = 0.5,
    tags: string[] = []
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('user_memory')
      .insert({
        user_id: userId,
        memory_type: memoryType,
        content,
        importance_score: importance,
        context_tags: tags,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store memory: ${error.message}`);
    }

    return data.id;
  }

  // Recall memories based on query
  async recallMemories(
    userId: string,
    query: string,
    memoryTypes?: string[],
    limit: number = 10
  ): Promise<Memory[]> {
    let dbQuery = this.supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('importance_score', { ascending: false })
      .limit(limit);

    if (memoryTypes && memoryTypes.length > 0) {
      dbQuery = dbQuery.in('memory_type', memoryTypes);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to recall memories: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToMemory);
  }

  // Store conversation memory
  async storeConversation(
    userId: string,
    userMessage: string,
    aiResponse: string,
    sessionId: string
  ): Promise<void> {
    const content = `User: ${userMessage}\nAI: ${aiResponse}`;
    await this.storeMemory(userId, content, 'conversation', 0.4, ['conversation', sessionId]);
  }

  // Store user preference
  async storePreference(userId: string, preference: string, value: unknown): Promise<void> {
    const content = `${preference}: ${JSON.stringify(value)}`;
    await this.storeMemory(userId, content, 'preference', 0.8, ['preference']);
  }

  // Get recent memories
  async getRecentMemories(userId: string, limit: number = 10): Promise<Memory[]> {
    const { data, error } = await this.supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent memories: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToMemory);
  }

  private mapDatabaseToMemory(data: Record<string, unknown>): Memory {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      memory_type: data.memory_type as Memory['memory_type'],
      content: data.content as string,
      importance_score: data.importance_score as number,
      context_tags: (data.context_tags as string[]) || [],
      created_at: new Date(data.created_at as string | number | Date),
      last_accessed_at: new Date(data.last_accessed_at as string | number | Date)
    };
  }
}

export async function createMemory(
  supabase: SupabaseClient,
  userId: string,
  contextData: { sessionId: string; query: string; response: string }
): Promise<string | null> {
  const memoryId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('memory_contexts')
    .insert({
      id: memoryId,
      user_id: userId,
      session_id: contextData.sessionId,
      context_type: 'conversation',
      context_data: {
        query: contextData.query,
        response: contextData.response
      },
      created_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating memory:', error);
    return null;
  }

  const memoryData = data as { id: string } | null;
  return memoryData?.id ?? null;
} 