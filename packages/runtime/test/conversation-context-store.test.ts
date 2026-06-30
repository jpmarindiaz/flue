import { describe, expect, it, vi } from 'vitest';
import { defineAgent } from '../src/index.ts';
import type { FlueContextConfig } from '../src/internal.ts';
import {
	createFlueContext,
	InMemoryConversationStreamStore,
	resolveModel,
} from '../src/internal.ts';
import { createNoopSessionEnv } from './fixtures/session-env.ts';

function createContext(overrides: Partial<FlueContextConfig> = {}) {
	return createFlueContext({
		id: 'agent-instance',
		env: { API_KEY: 'secret' },
		agentConfig: {
			resolveModel: () => resolveModel('anthropic/claude-haiku-4-5'),
		},
		createDefaultEnv: async () => createNoopSessionEnv(),
		...overrides,
	});
}

describe('createFlueContext() — conversationStreamStore', () => {
	it('builds the conversation writer from a host-provided store', async () => {
		const store = new InMemoryConversationStreamStore();
		const createStream = vi.spyOn(store, 'createStream');
		const acquireProducer = vi.spyOn(store, 'acquireProducer');

		const ctx = createContext({ conversationStreamStore: store });
		await ctx.initializeRootHarness(defineAgent(() => ({ model: 'anthropic/claude-haiku-4-5' })));

		// Initializing the harness wires the writer from the provided store
		// (ConversationRecordWriter.create → store.createStream + store.acquireProducer).
		expect(createStream).toHaveBeenCalledOnce();
		expect(acquireProducer).toHaveBeenCalledOnce();
	});

	it('ignores the store when an explicit conversationWriter is given', async () => {
		const store = new InMemoryConversationStreamStore();
		const createStream = vi.spyOn(store, 'createStream');

		// A separate store backs the explicit writer; the provided conversationStreamStore is ignored.
		const { ConversationRecordWriter } = await import('../src/conversation-writer.ts');
		const conversationWriter = await ConversationRecordWriter.create({
			store: new InMemoryConversationStreamStore(),
			path: 'agents/agent-instance/default',
			identity: { agentName: 'agent', instanceId: 'agent-instance' },
			producerId: 'execution:agent-instance',
		});

		const ctx = createContext({ conversationStreamStore: store, conversationWriter });
		await ctx.initializeRootHarness(defineAgent(() => ({ model: 'anthropic/claude-haiku-4-5' })));

		expect(createStream).not.toHaveBeenCalled();
	});
});
