import { z } from 'zod';
import { ContextNode, NodeType, ClusterContext } from './contextTree';

export const ClusterContextSchema: z.ZodType<ClusterContext> = z.object({
  id: z.string(),
  provider: z.enum(['GKE', 'AWS', 'Others']),
  region: z.string().optional(),
  resourceContainerID: z.string().optional(),
  clusterName: z.string(),
});

export const ContextNodeSchema: z.ZodType<ContextNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(NodeType),
    clusterContext: ClusterContextSchema.optional(),
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
