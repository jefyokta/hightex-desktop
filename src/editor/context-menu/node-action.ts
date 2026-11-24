import type { ContextMenuActionProvider, ContextMenuContext, NodeActionItem } from "./contracts";

export abstract class NodeAction implements ContextMenuActionProvider {
  /** null applies to every node; concrete node handlers use their schema name. */
  protected abstract readonly nodeType: string | null;

  public supports({ editor }: ContextMenuContext): boolean {
    return this.nodeType === null || editor.isActive(this.nodeType);
  }

  public abstract items(context: ContextMenuContext): NodeActionItem[];
}
