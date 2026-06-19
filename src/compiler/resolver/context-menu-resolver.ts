export class ContextMenuResolver {
  private menuEl: HTMLDivElement | null = null;

  private state = {
    page: 1,
  };
  private listener: ((e: MouseEvent) => void) | undefined;
  private static _instance: ContextMenuResolver | null = null;
  constructor(
    private send: (payload: WSMessage) => void,
    private role = "anonymous",
    private html: HTMLElement = document.body,
  ) {
    ContextMenuResolver._instance = this;
  }
  resolve() {
    console.log(this.role);
    this.createMenu();
    this.bind();
  }

  private hide = () => {
    if (!this.menuEl) return;
    this.menuEl.style.display = "none";
  };

  static instance() {
    return this._instance;
  }

  private bind() {
    this.listener = (e: MouseEvent) => {
      e.preventDefault();

      const el = e.target as HTMLElement;
      const page = el.closest(".pagedjs_page");

      if (!page) return;

      const pageNum = page.getAttribute("data-page-number") || "1";

      this.setState({
        page: Number(pageNum),
      });

      this.show(e.clientX, e.clientY);
    };
    this.html.addEventListener("contextmenu", this.listener);

    this.html.addEventListener("click", this.hide);
    window.addEventListener("resize", this.hide);
    window.addEventListener("blur", this.hide);
  }

  private setState(partial: Partial<typeof this.state>) {
    this.state = {
      ...this.state,
      ...partial,
    };

    this.render();
  }

  private render() {
    if (!this.menuEl) return;

    const broadcastBtn = this.menuEl.querySelector(
      '[data-action="broadcast"]',
    ) as HTMLButtonElement | null;

    if (broadcastBtn) {
      broadcastBtn.textContent = `Tell everyone to look page ${this.state.page}`;
    }
  }

  private createMenu() {
    const el = document.createElement("div");

    Object.assign(el.style, {
      position: "fixed",
      zIndex: "9999",
      minWidth: "220px",
      padding: "6px",
      background: "#ffffff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI",
      display: "none",
    });

    el.innerHTML = `
            <button data-action="broadcast">Tell everyone to look page 1</button>
           
        `;

    el.querySelectorAll("button").forEach((btn) => {
      const b = btn as HTMLButtonElement;

      Object.assign(b.style, {
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        fontSize: "13px",
        borderRadius: "8px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: "#111827",
      });

      b.onmouseenter = () => {
        b.style.background = "rgba(0,0,0,0.05)";
      };

      b.onmouseleave = () => {
        b.style.background = "transparent";
      };
    });

    el.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute("data-action");

      if (!action) return;

      if (action === "broadcast") {
        this.send({
          type: "lookup",
          payload: { page: this.state.page },
        });
      }

      if (action === "select") {
        console.log("Add to selection");
      }

      this.hide();
    });

    this.html.appendChild(el);
    this.menuEl = el;

    this.render();
  }

  private show(x: number, y: number) {
    if (!this.menuEl) return;

    const menu = this.menuEl;

    menu.style.display = "block";

    const rect = menu.getBoundingClientRect();

    const margin = 8;

    let left = x;
    let top = y;

    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - margin;
    }

    if (top + rect.height > window.innerHeight) {
      top = window.innerHeight - rect.height - margin;
    }

    if (left < margin) left = margin;
    if (top < margin) top = margin;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  destroy() {
    if (this.listener) {
      this.html.removeEventListener("contextmenu", this.listener);
    }

    this.html.removeEventListener("click", this.hide);
    window.removeEventListener("resize", this.hide);
    window.removeEventListener("blur", this.hide);

    if (this.menuEl && this.html.contains(this.menuEl)) {
      this.html.removeChild(this.menuEl);
    }

    this.menuEl = null;
    if (ContextMenuResolver._instance === this) {
      ContextMenuResolver._instance = null;
    }
  }
}
