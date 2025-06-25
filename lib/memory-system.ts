// Memory System for AI Agents
// Persistent memory, context recall, semantic search, conversation history

import { createClient } from '@/lib/supabase/client';

export interface Memory {
  id: string;
  user_id: string;
  memory_type: 'conversation' | 'preference' | 'fact' | 'pattern' | 'skill' | 'context';
  content: string;
  embedding?: number[]; // Vector embedding for semantic search
  importance_score: number; // 0-1 how important this memory is
  context_tags: string[]; // Tags for categorization
  source_session_id?: string;
  related_memories: string[]; // IDs of related memories
  expires_at?: Date; // Optional expiration
  created_at: Date;
  last_accessed_at: Date;
  access_count: number;
}

export interface MemoryQuery {
  query: string;
  memory_types?: string[];
  context_tags?: string[];
  importance_threshold?: number;
  max_results?: number;
  include_expired?: boolean;
}

export interface MemoryRecall {
  memories: Memory[];
  relevance_scores: number[];
  total_found: number;
  query_embedding?: number[];
}

export class MemorySystem {
  private supabase = createClient();
  private memoryCache = new Map<string, Memory[]>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // ==========================================
  // MEMORY STORAGE
  // ==========================================

  // Store a new memory
  async storeMemory(
    userId: string,
    content: string,
    memoryType: Memory['memory_type'],
    options: {
      importance?: number;
      tags?: string[];
      sourceSessionId?: string;
      expiresAt?: Date;
      relatedMemories?: string[];
    } = {}
  ): Promise<string> {
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(content);
    
    const memory: Omit<Memory, 'id'> = {
      user_id: userId,
      memory_type: memoryType,
      content,
      embedding,
      importance_score: options.importance || this.calculateImportanceScore(content, memoryType),
      context_tags: options.tags || this.extractContextTags(content),
      source_session_id: options.sourceSessionId,
      related_memories: options.relatedMemories || [],
      expires_at: options.expiresAt,
      created_at: new Date(),
      last_accessed_at: new Date(),
      access_count: 0
    };

    const { data, error } = await this.supabase
      .from('user_memory')
      .insert({
        user_id: memory.user_id,
        memory_type: memory.memory_type,
        content: memory.content,
        embedding: memory.embedding ? `[${memory.embedding.join(',')}]` : null,
        importance_score: memory.importance_score,
        context_tags: memory.context_tags,
        source_session_id: memory.source_session_id,
        expires_at: memory.expires_at?.toISOString(),
        created_at: memory.created_at.toISOString(),
        last_accessed_at: memory.last_accessed_at.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store memory: ${error.message}`);
    }

    // Establish relationships with related memories
    if (options.relatedMemories && options.relatedMemories.length > 0) {
      await this.establishMemoryRelationships(data.id, options.relatedMemories);
    }

    // Invalidate cache
    this.memoryCache.delete(userId);

    return data.id;
  }

  // Store conversation context
  async storeConversationMemory(
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const conversationContent = `User: ${userMessage}\nAI: ${aiResponse}`;
    
    await this.storeMemory(
      userId,
      conversationContent,
      'conversation',
      {
        importance: this.calculateConversationImportance(userMessage, aiResponse),
        tags: ['conversation', conversationId, ...((context?.tags as string[]) || [])],
        sourceSessionId: conversationId
      }
    );
  }

  // Store user preferences
  async storePreference(
    userId: string,
    preference: string,
    value: unknown,
    context?: string
  ): Promise<void> {
    const preferenceContent = `Preference: ${preference} = ${JSON.stringify(value)}${context ? ` (Context: ${context})` : ''}`;
    
    await this.storeMemory(
      userId,
      preferenceContent,
      'preference',
      {
        importance: 0.8, // Preferences are generally important
        tags: ['preference', preference.toLowerCase().replace(/\s+/g, '_')]
      }
    );
  }

  // Store factual information
  async storeFact(
    userId: string,
    fact: string,
    source?: string,
    confidence?: number
  ): Promise<void> {
    const factContent = `Fact: ${fact}${source ? ` (Source: ${source})` : ''}${confidence ? ` (Confidence: ${confidence})` : ''}`;
    
    await this.storeMemory(
      userId,
      factContent,
      'fact',
      {
        importance: confidence || 0.7,
        tags: ['fact', ...(source ? [source.toLowerCase()] : [])]
      }
    );
  }

  // ==========================================
  // MEMORY RETRIEVAL
  // ==========================================

  // Recall memories based on query
  async recallMemories(userId: string, query: MemoryQuery): Promise<MemoryRecall> {
    const cacheKey = `${userId}_${JSON.stringify(query)}`;
    
    // Check cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      return {
        memories: cached,
        relevance_scores: cached.map(() => 1.0),
        total_found: cached.length
      };
    }

    // Generate embedding for semantic search
    const queryEmbedding = await this.generateEmbedding(query.query);

    // Build query
    let dbQuery = this.supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId);

    // Apply filters
    if (query.memory_types && query.memory_types.length > 0) {
      dbQuery = dbQuery.in('memory_type', query.memory_types);
    }

    if (query.importance_threshold) {
      dbQuery = dbQuery.gte('importance_score', query.importance_threshold);
    }

    if (!query.include_expired) {
      dbQuery = dbQuery.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    // Execute query
    const { data, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to recall memories: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { memories: [], relevance_scores: [], total_found: 0 };
    }

    // Convert to Memory objects and calculate relevance
    const memories: Memory[] = data.map(this.mapDatabaseToMemory);
    const relevanceScores = await this.calculateRelevanceScores(
      memories,
      queryEmbedding,
      query
    );

    // Sort by relevance and limit results
    const sortedIndices = relevanceScores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.max_results || 10)
      .map(item => item.index);

    const sortedMemories = sortedIndices.map(i => memories[i]);
    const sortedScores = sortedIndices.map(i => relevanceScores[i]);

    // Update access counts
    await this.updateMemoryAccess(sortedMemories.map(m => m.id));

    // Cache results
    this.memoryCache.set(cacheKey, sortedMemories);
    setTimeout(() => this.memoryCache.delete(cacheKey), this.cacheTimeout);

    return {
      memories: sortedMemories,
      relevance_scores: sortedScores,
      total_found: memories.length,
      query_embedding: queryEmbedding
    };
  }

  // Get recent memories
  async getRecentMemories(
    userId: string,
    limit: number = 10,
    memoryTypes?: string[]
  ): Promise<Memory[]> {
    let query = this.supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (memoryTypes && memoryTypes.length > 0) {
      query = query.in('memory_type', memoryTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent memories: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToMemory);
  }

  // Get memories by importance
  async getImportantMemories(
    userId: string,
    threshold: number = 0.8,
    limit: number = 20
  ): Promise<Memory[]> {
    const { data, error } = await this.supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .gte('importance_score', threshold)
      .order('importance_score', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get important memories: ${error.message}`);
    }

    return (data || []).map(this.mapDatabaseToMemory);
  }

  // Get context for current session
  async getSessionContext(userId: string, sessionId: string): Promise<{
    current_session_memories: Memory[];
    related_memories: Memory[];
    user_preferences: Memory[];
  }> {
    // Get memories from current session
    const currentSessionMemories = await this.recallMemories(userId, {
      query: sessionId,
      memory_types: ['conversation', 'context'],
      max_results: 20
    });

    // Get related memories based on current session content
    const relatedMemories = await this.recallMemories(userId, {
      query: currentSessionMemories.memories.map(m => m.content).join(' '),
      memory_types: ['fact', 'pattern', 'skill'],
      max_results: 10
    });

    // Get user preferences
    const preferences = await this.recallMemories(userId, {
      query: 'preferences settings',
      memory_types: ['preference'],
      max_results: 15
    });

    return {
      current_session_memories: currentSessionMemories.memories,
      related_memories: relatedMemories.memories,
      user_preferences: preferences.memories
    };
  }

  // ==========================================
  // MEMORY MANAGEMENT
  // ==========================================

  // Update memory importance
  async updateMemoryImportance(memoryId: string, newImportance: number): Promise<void> {
    const { error } = await this.supabase
      .from('user_memory')
      .update({
        importance_score: Math.max(0, Math.min(1, newImportance)),
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId);

    if (error) {
      throw new Error(`Failed to update memory importance: ${error.message}`);
    }
  }

  // Delete memory
  async deleteMemory(memoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_memory')
      .delete()
      .eq('id', memoryId);

    if (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }

    // Clear cache
    this.memoryCache.clear();
  }

  // Cleanup expired memories
  async cleanupExpiredMemories(userId?: string): Promise<number> {
    let query = this.supabase
      .from('user_memory')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { error, count } = await query;

    if (error) {
      throw new Error(`Failed to cleanup expired memories: ${error.message}`);
    }

    return count || 0;
  }

  // Consolidate similar memories
  async consolidateMemories(userId: string, similarityThreshold: number = 0.9): Promise<number> {
    const memories = await this.getRecentMemories(userId, 100);
    let consolidatedCount = 0;

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const similarity = await this.calculateMemorySimilarity(memories[i], memories[j]);
        
        if (similarity > similarityThreshold) {
          // Merge memories
          const mergedContent = `${memories[i].content}\n[Consolidated with: ${memories[j].content}]`;
          const mergedImportance = Math.max(memories[i].importance_score, memories[j].importance_score);
          
          await this.updateMemory(memories[i].id, {
            content: mergedContent,
            importance_score: mergedImportance,
            context_tags: [...new Set([...memories[i].context_tags, ...memories[j].context_tags])]
          });
          
          await this.deleteMemory(memories[j].id);
          consolidatedCount++;
        }
      }
    }

    return consolidatedCount;
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  private async generateEmbedding(text: string): Promise<number[]> {
    // In a real implementation, this would call an embedding API
    // For now, return a simple hash-based pseudo-embedding
    const hash = this.simpleHash(text);
    return Array.from({ length: 512 }, (_, i) => Math.sin(hash + i) * 0.1);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash;
  }

  private calculateImportanceScore(content: string, memoryType: Memory['memory_type']): number {
    let baseScore = 0.5;
    
    // Type-based scoring
    switch (memoryType) {
      case 'preference': baseScore = 0.8; break;
      case 'fact': baseScore = 0.7; break;
      case 'conversation': baseScore = 0.4; break;
      case 'pattern': baseScore = 0.6; break;
      case 'skill': baseScore = 0.9; break;
      case 'context': baseScore = 0.3; break;
    }

    // Content-based adjustments
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 50) baseScore += 0.1;
    if (content.includes('important') || content.includes('remember')) baseScore += 0.2;
    if (content.includes('prefer') || content.includes('like')) baseScore += 0.1;

    return Math.max(0, Math.min(1, baseScore));
  }

  private extractContextTags(content: string): string[] {
    const tags = [];
    const lowerContent = content.toLowerCase();
    
    // Extract common patterns
    if (lowerContent.includes('research')) tags.push('research');
    if (lowerContent.includes('analysis')) tags.push('analysis');
    if (lowerContent.includes('writing')) tags.push('writing');
    if (lowerContent.includes('coding')) tags.push('coding');
    if (lowerContent.includes('preference')) tags.push('preference');
    
    // Extract quoted phrases as tags
    const quotedPhrases = content.match(/"([^"]+)"/g);
    if (quotedPhrases) {
      tags.push(...quotedPhrases.map(phrase => phrase.slice(1, -1).toLowerCase()));
    }

    return tags;
  }

  private calculateConversationImportance(userMessage: string, aiResponse: string): number {
    let importance = 0.4; // Base importance for conversations
    
    // Boost importance for learning indicators
    const learningWords = ['learn', 'remember', 'understand', 'explain', 'teach'];
    if (learningWords.some(word => userMessage.toLowerCase().includes(word))) {
      importance += 0.3;
    }
    
    // Boost for preference expressions
    const preferenceWords = ['prefer', 'like', 'dislike', 'want', 'need'];
    if (preferenceWords.some(word => userMessage.toLowerCase().includes(word))) {
      importance += 0.2;
    }
    
    // Boost for detailed responses
    if (aiResponse.length > 500) importance += 0.1;
    
    return Math.min(1, importance);
  }

  private async calculateRelevanceScores(
    memories: Memory[],
    queryEmbedding: number[],
    query: MemoryQuery
  ): Promise<number[]> {
    const scores = [];
    
    for (const memory of memories) {
      let score = 0;
      
      // Semantic similarity (using embeddings)
      if (memory.embedding && queryEmbedding) {
        score += this.cosineSimilarity(memory.embedding, queryEmbedding) * 0.4;
      }
      
      // Text similarity
      score += this.textSimilarity(memory.content, query.query) * 0.3;
      
      // Importance boost
      score += memory.importance_score * 0.2;
      
      // Recency boost
      const daysSinceCreated = (Date.now() - memory.created_at.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, (1 - daysSinceCreated / 30)) * 0.1; // 30-day recency window
      
      scores.push(score);
    }
    
    return scores;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private mapDatabaseToMemory(data: Record<string, unknown>): Memory {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      memory_type: data.memory_type as Memory['memory_type'],
      content: data.content as string,
      embedding: data.embedding ? JSON.parse(data.embedding as string) : undefined,
      importance_score: data.importance_score as number,
      context_tags: (data.context_tags as string[]) || [],
      source_session_id: data.source_session_id as string | undefined,
      related_memories: (data.related_memories as string[]) || [],
      expires_at: data.expires_at ? new Date(data.expires_at as string | number | Date) : undefined,
      created_at: new Date(data.created_at as string | number | Date),
      last_accessed_at: new Date(data.last_accessed_at as string | number | Date),
      access_count: (data.access_count as number) || 0
    };
  }

  private async updateMemoryAccess(memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;
    
    const { error } = await this.supabase
      .from('user_memory')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: 1
      })
      .in('id', memoryIds);

    if (error) {
      console.error('Failed to update memory access:', error);
    }
  }

  private async establishMemoryRelationships(memoryId: string, relatedIds: string[]): Promise<void> {
    // This would establish bidirectional relationships between memories
    // Simplified implementation
    const { error } = await this.supabase
      .from('user_memory')
      .update({
        related_memories: relatedIds
      })
      .eq('id', memoryId);

    if (error) {
      console.error('Failed to establish memory relationships:', error);
    }
  }

  private async calculateMemorySimilarity(memory1: Memory, memory2: Memory): Promise<number> {
    if (memory1.embedding && memory2.embedding) {
      return this.cosineSimilarity(memory1.embedding, memory2.embedding);
    }
    return this.textSimilarity(memory1.content, memory2.content);
  }

  private async updateMemory(memoryId: string, updates: Partial<Memory>): Promise<void> {
    const { error } = await this.supabase
      .from('user_memory')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', memoryId);

    if (error) {
      throw new Error(`Failed to update memory: ${error.message}`);
    }
  }
} 