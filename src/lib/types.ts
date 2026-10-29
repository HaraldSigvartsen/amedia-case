export type Role = 'user' | 'assistant';

export const DEFAULT_EMBED_TITLE = 'Uten tittel';

export type EmbedSummary = {
	id: string;
	title: string;
	published: boolean;
	updatedAt: string;
};

export type ChatMessage = {
	id: number;
	role: Role;
	content: string;
	createdAt: string;
};

export type EmbedDetail = EmbedSummary & {
	html: string;
	createdAt: string;
	messages: ChatMessage[];
};

export type PublishedEmbed = {
	id: string;
	title: string;
	html: string;
};

export type ChatDonePayload = {
	html: string;
	title: string;
	commentary: string;
};
