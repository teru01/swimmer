import { z } from 'zod';
import { ContextNode, NodeType } from './contextTree';

export const ContextNodeSchema: z.ZodType<ContextNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(NodeType),
    contextName: z.string().optional(),
    parentId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isExpanded: z.boolean().optional(),
    children: z.array(ContextNodeSchema).optional(),
  })
);

export const ContextConfigSchema = z.object({
  contextTree: z.array(ContextNodeSchema),
  lastSelectedContext: ContextNodeSchema.optional(),
  availableTags: z.array(z.string()).optional(),
});

export type ContextConfig = z.infer<typeof ContextConfigSchema>;
