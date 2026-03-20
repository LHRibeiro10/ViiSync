const { randomUUID } = require("crypto");

const DEFAULT_TTL_MS = Number(process.env.ASSISTANT_MEMORY_TTL_MS || 1000 * 60 * 60 * 24);
const DEFAULT_MAX_CONVERSATIONS = Number(
  process.env.ASSISTANT_MEMORY_MAX_CONVERSATIONS || 100
);

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createBaseConversation({ initialMessages = [], meta = {} } = {}) {
  const timestamp = new Date().toISOString();

  return {
    id: randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    meta,
    providerState: {},
    messages: initialMessages,
  };
}

class InMemoryAssistantConversationRepository {
  constructor({ ttlMs = DEFAULT_TTL_MS, maxConversations = DEFAULT_MAX_CONVERSATIONS } = {}) {
    this.ttlMs = ttlMs;
    this.maxConversations = maxConversations;
    this.store = new Map();
  }

  pruneStore() {
    const now = Date.now();

    for (const [conversationId, conversation] of this.store.entries()) {
      const updatedAt = new Date(conversation.updatedAt).getTime();

      if (!Number.isFinite(updatedAt) || now - updatedAt > this.ttlMs) {
        this.store.delete(conversationId);
      }
    }

    if (this.store.size <= this.maxConversations) {
      return;
    }

    const conversationsByAge = [...this.store.values()].sort((left, right) => {
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    });

    while (this.store.size > this.maxConversations && conversationsByAge.length) {
      const oldestConversation = conversationsByAge.shift();

      if (oldestConversation) {
        this.store.delete(oldestConversation.id);
      }
    }
  }

  async createConversation(options = {}) {
    this.pruneStore();

    const conversation = createBaseConversation(options);
    this.store.set(conversation.id, cloneData(conversation));

    return cloneData(conversation);
  }

  async getConversation(conversationId) {
    this.pruneStore();

    const conversation = this.store.get(conversationId);
    return conversation ? cloneData(conversation) : null;
  }

  async saveConversation(conversation) {
    const persistedConversation = {
      ...conversation,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(persistedConversation.id, cloneData(persistedConversation));
    this.pruneStore();

    return cloneData(persistedConversation);
  }

  async resetConversation(conversationId, options = {}) {
    const existingConversation = await this.getConversation(conversationId);

    if (!existingConversation) {
      return null;
    }

    const resetConversation = {
      ...existingConversation,
      messages: options.initialMessages || [],
      providerState: {},
      meta: {
        ...existingConversation.meta,
        ...(options.meta || {}),
      },
    };

    return this.saveConversation(resetConversation);
  }
}

class PrismaAssistantConversationRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  mapConversationRecord(record) {
    return {
      id: record.id,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      meta: record.metadata || {},
      providerState: record.providerState || {},
      messages: (record.messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        meta: message.metadata || {},
      })),
    };
  }

  async createConversation({ initialMessages = [], meta = {} } = {}) {
    const record = await this.prisma.assistantConversation.create({
      data: {
        metadata: meta,
        providerState: {},
        messages: {
          create: initialMessages.map((message) => ({
            role: message.role,
            content: message.content,
            metadata: message.meta || {},
          })),
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return this.mapConversationRecord(record);
  }

  async getConversation(conversationId) {
    const record = await this.prisma.assistantConversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return record ? this.mapConversationRecord(record) : null;
  }

  async saveConversation(conversation) {
    await this.prisma.assistantMessage.deleteMany({
      where: {
        conversationId: conversation.id,
      },
    });

    const record = await this.prisma.assistantConversation.update({
      where: {
        id: conversation.id,
      },
      data: {
        metadata: conversation.meta || {},
        providerState: conversation.providerState || {},
        messages: {
          create: (conversation.messages || []).map((message) => ({
            role: message.role,
            content: message.content,
            metadata: message.meta || {},
            createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
          })),
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return this.mapConversationRecord(record);
  }

  async resetConversation(conversationId, { initialMessages = [], meta = {} } = {}) {
    await this.prisma.assistantMessage.deleteMany({
      where: {
        conversationId,
      },
    });

    const record = await this.prisma.assistantConversation.update({
      where: {
        id: conversationId,
      },
      data: {
        metadata: meta,
        providerState: {},
        messages: {
          create: initialMessages.map((message) => ({
            role: message.role,
            content: message.content,
            metadata: message.meta || {},
          })),
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return this.mapConversationRecord(record);
  }
}

function createConversationRepository() {
  const provider = normalizeProvider(process.env.ASSISTANT_PERSISTENCE_PROVIDER || "memory");

  if (provider === "prisma") {
    try {
      const prisma = require("../../lib/prisma");

      if (prisma.assistantConversation && prisma.assistantMessage) {
        return {
          persistenceMode: "prisma",
          repository: new PrismaAssistantConversationRepository(prisma),
        };
      }
    } catch (error) {
      console.warn("[assistant] Prisma persistence unavailable, falling back to memory.");
    }
  }

  return {
    persistenceMode: "memory",
    repository: new InMemoryAssistantConversationRepository(),
  };
}

function normalizeProvider(provider) {
  return String(provider || "")
    .trim()
    .toLowerCase();
}

module.exports = {
  createConversationRepository,
};
