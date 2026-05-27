import { ApplicationError } from "@/exception/interfaces/application-error";
import { Engine } from "../engine";
import { FrameManager } from "@/frame/manager";

export class Interactable {
  async resolve(engine: Engine) {
    const pagesWrapper = engine.config.paged?.renderTo || document.body;
    if (!pagesWrapper) {
      throw new ApplicationError("emnyenenennee");
    }
    pagesWrapper
      .querySelectorAll<HTMLElement>(".pagedjs_page_content")
      .forEach((page, i) => {
        const height = page.getBoundingClientRect().height;
        const tolerance = height + 15;
        const contentHeight = page.scrollHeight;
        const overflow = contentHeight > tolerance;

        if (overflow) {
          console.log("overflow on %s", i + 1);
          FrameManager.sendMessage("page:overflow", {
            page: i + 1,
          });
        }
      });
    FrameManager.onMessaged((e) => {
      if (e.type == "node:clicked") {
        const target = pagesWrapper.querySelector(
          `[data-uuid="${e.data.uuid}"]`,
        );
        if (!target) {
          console.warn("node %s not found", e.data.uuid);
        }
        target?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
      if (e.type == "page:requested") {
        const target = pagesWrapper.querySelector(`#${e.data.pageId}`);
        target?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    });

    pagesWrapper
      .querySelectorAll("[href]")
      .forEach((e) => e.addEventListener("click", (ev) => ev.preventDefault()));
    pagesWrapper.querySelectorAll<HTMLElement>("[data-uuid]").forEach((e) => {
      const uuid = e.getAttribute("data-uuid")!;

      e.addEventListener("click", (ev) => {
        console.log("clicked", uuid);
        ev.preventDefault();
        engine.config.parser.mode == "full";
        FrameManager.sendMessage("node:clicked", {
          uuid,
          type: e.nodeName,
        });
      });
    });
  }
}
