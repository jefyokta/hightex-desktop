import { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { Chapter } from "../chapter";

export const RefPluginKey = new PluginKey("ref-cache");

export class FigureCache {
  static tableCache: Node[] = [];
  static imageCache: Node[] = [];
  static refCache: Node[] = [];

  //   static attachmentFigure:Attachment[] = []

  static collect(doc: Node) {
    const tables: Node[] = [];
    const images: Node[] = [];
    const refs: Node[] = [];

    doc.descendants((node) => {
      if (node.type.name === "figureTable") tables.push(node);
      if (node.type.name === "imageFigure") images.push(node);
      if (node.type.name == "refComponent") refs.push(node);
    });

    return { tables, images, refs };
  }

  //   static setAttachment(att:Attachment[]){

  //     this.attachmentFigure = att
  //   }

  static updateCache(doc: Node) {
    const { tables, images, refs } = this.collect(doc);
    const tableChanged = this.hasChanged(this.tableCache, tables);
    const imageChanged = this.hasChanged(this.imageCache, images);

    this.tableCache = tables;
    this.imageCache = images;
    this.refCache = refs;

    return { tableChanged, imageChanged };
  }

  static onCreate(view: EditorView) {
    const { doc } = view.state;
    this.updateCache(doc);
    this.handleRef(view);
  }

  static hasChanged(oldArr: Node[], newArr: Node[]): boolean {
    if (oldArr.length !== newArr.length) return true;
    for (let i = 0; i < newArr.length; i++) {
      if (!oldArr[i]?.eq(newArr[i])) return true;
    }
    return false;
  }

  static getLabel(figureId: string, figureType: "imageFigure" | "figureTable") {
    const chapter = Chapter.instance!.getChapter();
    const list =
      figureType === "imageFigure" ? this.imageCache : this.tableCache;
    const index = list.findIndex((f) => f.attrs.id === figureId);
    return index >= 0
      ? `${figureType === "imageFigure" ? "Gambar" : "Tabel"} ${chapter}.${index + 1}`
      : false;
  }

  static handleRef(view: EditorView) {
    const doc = view.state.doc;
    const chapter = Chapter.instance!.getChapter();
    const tr = view.state.tr;

    doc.descendants((n, pos) => {
      if (n.type.name === "refComponent") {
        const id = n.attrs.link;
        const refType = n.attrs.ref;

        if (!id || !refType) return;

        let label = "";
        let figureExists = false;

        if (refType === "imageFigure") {
          const index = this.imageCache.findIndex((f) => f.attrs.id === id);
          if (index >= 0) {
            figureExists = true;
            label = `Gambar ${chapter}.${index + 1}`;
          }

          //   const found = this.attachmentFigure.find(e=>e.id == id)
          //   if (found) {
          //     figureExists =true
          //     label = `Gambar ${found.label}`

          //   }
        }

        if (refType === "figureTable") {
          const index = this.tableCache.findIndex((f) => f.attrs.id === id);
          if (index >= 0) {
            figureExists = true;
            label = `Tabel ${chapter}.${index + 1}`;
          }
        }

        // if (!figureExists) {
        // //   EventBus.emit("warning", {
        // //     elementId: `ref-${id}`,
        // //     message: `Missing ${refType} "${id}"`,
        // //     remove:false,
        // //   })
        // } else {
        //   EventBus.emit("warning", { elementId: `ref-${id}`,remove:true })
        // }

        if (figureExists && n.attrs.label !== label) {
          tr.setNodeMarkup(pos, undefined, { ...n.attrs, label });
        }
      }
    });

    if (tr.docChanged) {
      view.dispatch(tr);
    }
  }
}

export const RefPlugin = new Plugin({
  key: RefPluginKey,
  view() {
    let working = false;

    return {
      update(view: EditorView, prevState) {
        const { state } = view;
        const { doc } = state;
        const changed = !doc.eq(prevState.doc);
        if (!changed || working) return;

        working = true;

        const cacheChanged = FigureCache.updateCache(doc);
        if (
          cacheChanged.tableChanged ||
          cacheChanged.imageChanged ||
          FigureCache.refCache.length > 0
        ) {
          FigureCache.handleRef(view);
        }

        working = false;
      },
    };
  },
  props: {
    decorations(state) {
      const decorations: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name === "refComponent") {
          const label = FigureCache.getLabel(node.attrs.link, node.attrs.ref);
          const deco = Decoration.node(pos, pos + node.nodeSize, {
            "data-label": label || undefined,
          });
          decorations.push(deco);
        }
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
});
