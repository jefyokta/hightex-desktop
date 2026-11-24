import type { ContextMenuActionProvider, ContextMenuContext, NodeActionItem } from "./contracts";
import { DefaultNodeAction } from "./actions/default-node-action";
import { ImageFigureAction } from "./actions/image-figure-action";
import { ImageAction } from "./actions/image-action";
import { FigureTableAction } from "./actions/figure-table-action";
import { BlockMathAction } from "./actions/block-math-action";
import { InlineMathAction } from "./actions/inline-math-action";
import { TableAction } from "./actions/table-action";
import { HeadingAction } from "./actions/heading-action";
import { ListItemAction } from "./actions/list-item-action";

export class ContextMenuActions {
  constructor(
    private readonly providers: readonly ContextMenuActionProvider[] = [
      new ImageFigureAction(),
      new ImageAction(),
      new FigureTableAction(),
      new BlockMathAction(),
      new InlineMathAction(),
      new TableAction(),
      new HeadingAction(),
      new ListItemAction(),
    ],
    private readonly defaults: ContextMenuActionProvider = new DefaultNodeAction(),
  ) {}

  public collect(context: ContextMenuContext): NodeActionItem[] {
    const items = [...this.providers, this.defaults].flatMap(provider =>
      provider.supports(context) ? provider.items(context) : [],
    );
    const keys = new Set<string>();
    return items.filter(item => {
      if (!item.key) return true;
      if (keys.has(item.key)) return false;
      keys.add(item.key);
      return true;
    });
  }
}
