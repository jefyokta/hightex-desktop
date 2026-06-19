export class CommentResolver {
private listener = (e: PointerEvent) => {
  const win = this.root.defaultView;
  const CommentEl = win!.customElements.get("ht-comment")!;
  if (e.target instanceof CommentEl) {
    const comments: CommentServerMessage[] = (
      e.target as CommentElement
    ).getComments();
    this.open(comments, e.clientX, e.clientY); // ← kirim koordinat mouse
  } else if (!this.popUpEl!.contains(e.target as Node)) {
    this.close();
  }
};

  private scrollListener = () => this.close();
  private arrowEl: HTMLElement | null = null;

  private popUpEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private slideWrapEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private currentIndex = 0;
  private comments: CommentServerMessage[] = [];
  private isOpen = false;
  private static _instance:CommentResolver | null;
  constructor(private root: Document) {
    this.createPopUp();
    CommentResolver._instance =this
  }

  static instance(){
    return this._instance
  }

  resolve() {
    this.root.addEventListener("click", this.listener as EventListener);
    this.root.defaultView?.addEventListener("scroll", this.scrollListener, {
      passive: true,
    });
  }

private open(comments: CommentServerMessage[], mx: number, my: number) {
  const isReplace = this.isOpen;
  this.comments = comments;
  this.currentIndex = 0;

  this.positionNearMouse(mx, my); 

  if (isReplace) {
    this.renderHeader();
    this.renderContent();
  } else {
    this.popUpEl!.style.display = "block";
    void this.popUpEl!.offsetHeight;
    this.popUpEl!.style.opacity = "1";
    this.popUpEl!.style.transform = "translateY(0) scale(1)";
    this.isOpen = true;
    this.renderHeader();
    this.renderContent();
  }
}

private positionNearMouse(mx: number, my: number) {
  const el = this.popUpEl!;
  const gap = 12;
  const arrowSize = 8;

  // Ukur ukuran popup
  el.style.visibility = "hidden";
  el.style.display = "block";
  const elW = el.offsetWidth;
  const elH = el.offsetHeight;
  el.style.display = this.isOpen ? "block" : "none";
  el.style.visibility = "";

  const win = this.root.defaultView!;
  const vw = win.innerWidth;
  // const vh = win.innerHeight;

  const spaceAbove = my;
  // const spaceBelow = vh - my;
  const placeAbove = spaceAbove > elH + gap + arrowSize;

  let top: number;
  let arrowBottom: boolean;

  if (placeAbove) {
    top = my - elH - gap - arrowSize;
    arrowBottom = true; 
  } else {
    top = my + gap + arrowSize;
    arrowBottom = false;
  }

  let left = mx - elW / 2;
  left = Math.max(gap, Math.min(left, vw - elW - gap));

  const arrowLeft = Math.min(
    Math.max(mx - left, 16),
    elW - 16,
  );

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;

  this.arrowEl!.style.left = `${arrowLeft}px`;
  this.arrowEl!.style.transform = `translateX(-50%) ${arrowBottom ? "rotate(180deg)" : "rotate(0deg)"}`;
  if (arrowBottom) {
    this.arrowEl!.style.bottom = `-${arrowSize}px`;
    this.arrowEl!.style.top = "";
  } else {
    this.arrowEl!.style.top = `-${arrowSize}px`;
    this.arrowEl!.style.bottom = "";
  }
}

  private renderHeader() {
    const el = this.headerEl!;
    const total = this.comments.length;
    const idx = this.currentIndex;
    const comment = this.comments[idx];

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div data-avatar style="
            width:28px;height:28px;border-radius:50%;
            background:#ececec;display:flex;align-items:center;
            justify-content:center;font-size:11px;font-weight:600;color:#555;flex-shrink:0;
          ">${(comment.name?.[0] ?? "?").toUpperCase()}</div>
          <div>
            <div data-name style="font-size:13px;font-weight:600;color:#1a1a1a;line-height:1.2;">${comment.name ?? "Anonymous"}</div>
            <div data-role style="font-size:11px;color:#aaa;text-transform:capitalize;">${comment.role}</div>
          </div>
        </div>
        ${
          total > 1
            ? `
        <div style="display:flex;align-items:center;gap:4px;">
          <span data-counter style="font-size:11px;color:#bbb;margin-right:2px;">${idx + 1} / ${total}</span>
          <button data-prev style="
            width:24px;height:24px;border:none;background:#f2f2f2;border-radius:6px;
            cursor:pointer;font-size:15px;line-height:1;color:#555;
            opacity:${idx === 0 ? 0.3 : 1};pointer-events:${idx === 0 ? "none" : "auto"};
          ">‹</button>
          <button data-next style="
            width:24px;height:24px;border:none;background:#f2f2f2;border-radius:6px;
            cursor:pointer;font-size:15px;line-height:1;color:#555;
            opacity:${idx === total - 1 ? 0.3 : 1};pointer-events:${idx === total - 1 ? "none" : "auto"};
          ">›</button>
        </div>`
            : ""
        }
      </div>
    `;

    el.querySelector("[data-prev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigate(-1);
    });
    el.querySelector("[data-next]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigate(1);
    });
  }

  private updateHeader() {
    const total = this.comments.length;
    const idx = this.currentIndex;
    const comment = this.comments[idx];
    const h = this.headerEl!;

    const counter = h.querySelector("[data-counter]");
    const prev = h.querySelector("[data-prev]") as HTMLElement | null;
    const next = h.querySelector("[data-next]") as HTMLElement | null;
    const avatar = h.querySelector("[data-avatar]") as HTMLElement | null;
    const name = h.querySelector("[data-name]") as HTMLElement | null;
    const role = h.querySelector("[data-role]") as HTMLElement | null;

    if (counter) counter.textContent = `${idx + 1} / ${total}`;
    if (prev) {
      prev.style.opacity = idx === 0 ? "0.3" : "1";
      prev.style.pointerEvents = idx === 0 ? "none" : "auto";
    }
    if (next) {
      next.style.opacity = idx === total - 1 ? "0.3" : "1";
      next.style.pointerEvents = idx === total - 1 ? "none" : "auto";
    }
    if (avatar) avatar.textContent = (comment.name?.[0] ?? "?").toUpperCase();
    if (name) name.textContent = comment.name ?? "Anonymous";
    if (role) role.textContent = comment.role;
  }

  private navigate(dir: 1 | -1) {
    const next = this.currentIndex + dir;
    if (next < 0 || next >= this.comments.length) return;

    const outX = dir === 1 ? "-100%" : "100%";
    const inX = dir === 1 ? "100%" : "-100%";
    const el = this.contentEl!;

    const nextEl = el.cloneNode(false) as HTMLElement;
    Object.assign(nextEl.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      transform: `translateX(${inX})`,
      transition: "none",
    });
    this.slideWrapEl!.appendChild(nextEl);

    this.currentIndex = next;
    this.renderContentInto(nextEl);
    this.updateHeader();

    void nextEl.offsetHeight;

    const ease = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    el.style.transition = `transform 240ms ${ease}`;
    nextEl.style.transition = `transform 240ms ${ease}`;
    el.style.transform = `translateX(${outX})`;
    nextEl.style.transform = "translateX(0)";

    nextEl.addEventListener(
      "transitionend",
      () => {
        el.remove();
        this.contentEl = nextEl;
        nextEl.style.position = "";
        nextEl.style.top = "";
        nextEl.style.left = "";
        nextEl.style.width = "";
        nextEl.style.transition = "";
      },
      { once: true },
    );
  }

  private renderContent() {
    const el = this.contentEl!;
    el.style.transition = "none";
    el.style.transform = "translateX(0)";
    this.renderContentInto(el);
  }

  private renderContentInto(el: HTMLElement) {
    const comment = this.comments[this.currentIndex];
    el.innerHTML = `<div style="font-size:13px;color:#444;line-height:1.6;">${comment.text ?? ""}</div>`;
  }

  private close() {
    if (!this.isOpen) return;
    const el = this.popUpEl!;
    el.style.opacity = "0";
    el.style.transform = "translateY(4px) scale(0.98)";
    el.addEventListener(
      "transitionend",
      () => {
        el.style.display = "none";
        this.isOpen = false;
      },
      { once: true },
    );
  }

  private createPopUp() {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      zIndex: "9999",
      width: "260px",
      padding: "12px 14px",
      background: "#ffffff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "14px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI",
      display: "none",
      opacity: "0",
      transform: "translateY(4px) scale(0.98)",
      transition: "opacity 180ms ease, transform 180ms ease",
      willChange: "opacity, transform",
    });

    const header = document.createElement("div");

    const slideWrap = document.createElement("div");
    Object.assign(slideWrap.style, {
      position: "relative",
      overflow: "hidden",
    });

    const content = document.createElement("div");
    const arrow = document.createElement("div");
  Object.assign(arrow.style, {
    position: "absolute",
    width: "0",
    height: "0",
    borderLeft: "8px solid transparent",
    borderRight: "8px solid transparent",
    borderBottom: "8px solid #ffffff",    
    filter: "drop-shadow(0 -1px 1px rgba(0,0,0,0.08))",
    pointerEvents: "none",
  });
el.appendChild(arrow);
this.arrowEl = arrow;
    slideWrap.appendChild(content);

    el.appendChild(header);
    el.appendChild(slideWrap);

    this.popUpEl = el;
    this.headerEl = header;
    this.slideWrapEl = slideWrap;
    this.contentEl = content;
    this.root.body.appendChild(el);
  }

  destroy() {
    this.root.removeEventListener("click", this.listener as EventListener);
    this.root.defaultView?.removeEventListener("scroll", this.scrollListener);
    this.popUpEl?.remove();
    this.popUpEl = null;
    this.headerEl = null;
    this.slideWrapEl = null;
    this.contentEl = null;
    this.arrowEl=null;;
  }
}
