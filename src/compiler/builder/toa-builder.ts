import { HighTexDB } from "@/editor/storage/hightex-db"
import { Engine } from "../engine"



export class TOABuilder {
  async create(engine: Engine): Promise<HTMLElement> {
    const wrapper = this.createWrapper("toa", "DAFTAR SINGKATAN")

    const doc =
      engine.parser.mode === "single"
        ? engine.parser.chapter.document
        : engine.parser.document

    if (!doc.ready) {
      await doc.warm()
    }

    const aliases = await HighTexDB
      .getInstance()
      .getAliases(doc.id)

    const aliasesParent = document.createElement("div")
    aliasesParent.classList.add("toa-list")

    Object.assign(aliasesParent.style, {
      marginTop: "1.5rem",
      display: "grid",
      gridTemplateColumns: "6.5cm 0.5cm 7cm",
    })

    for (const alias of aliases) {
      aliasesParent.appendChild(this.createAliasList(alias))
    }

    wrapper.appendChild(aliasesParent)

    return wrapper
  }

  createAliasList(alias: Omit<Alias,"documentId">): HTMLElement {
    const parent = document.createElement("div")

    parent.style.display = "contents"

    const key = document.createElement("div")
    key.textContent = alias.key

    const separator = document.createElement("div")
    separator.textContent = ":"

    const value = document.createElement("div")
    value.textContent = alias.value

    parent.append(key, separator, value)

    return parent
  }

  createWrapper(id: string, text: string): HTMLElement {
    const section = document.createElement("section")
    section.classList.add("introduction", "new-page", id)

    const h1 = document.createElement("h1")
    h1.id = id
    h1.textContent = text
    h1.classList.add("chapter")

    section.appendChild(h1)

    return section
  }
}