import { expect, test } from "bun:test";
import {
  mergePaginationOptions,
  paginationGeometry,
} from "../src/editor/pagination/options";
import {
  PAGE_NUMBER_POSITIONS,
  pageNumberStyle,
  pageNumberOptions,
} from "../src/editor/pagination/presentation/page-number";

test("introduction defaults to bottom center; chapters and appendices to bottom right", () => {
  expect(paginationGeometry().pageNumbers).toEqual({
    introduction: "bottom-center",
    chapters: "bottom-right",
    appendix: "bottom-right",
  });
});

test("partial position updates preserve the other groups and reject invalid placements", () => {
  const previous = {
    pageNumbers: {
      introduction: "top-left" as const,
      chapters: "top-right" as const,
    },
  };
  const merged = mergePaginationOptions(previous, {
    pageNumbers: { appendix: "bottom-left" },
  });
  expect(paginationGeometry(merged).pageNumbers).toEqual({
    introduction: "top-left",
    chapters: "top-right",
    appendix: "bottom-left",
  });
  expect(previous.pageNumbers).toEqual({
    introduction: "top-left",
    chapters: "top-right",
  });
  expect(() => pageNumberOptions({ introduction: "left" as never })).toThrow(
    RangeError,
  );
});

test("all six placements use the physical paper and explicit offsets under asymmetric margins", () => {
  const geometry = paginationGeometry({
    margins: { top: 20, right: 20, bottom: 40, left: 40 },
  });
  for (const position of PAGE_NUMBER_POSITIONS) {
    const style = pageNumberStyle(geometry, position, geometry.stride);
    expect(parseFloat(style.top)).toBeCloseTo(
      geometry.stride +
        (position.startsWith("top")
          ? geometry.margins.top / 2
          : geometry.height - geometry.margins.bottom / 2),
    );
    if (position.endsWith("center")) {
      expect(parseFloat(style.left)).toBeCloseTo(geometry.width / 2);
      expect(style.right).toBe("auto");
      expect(style.transform).toBe("translateX(-50%)");
    } else if (position.endsWith("left")) {
      expect(parseFloat(style.left)).toBeCloseTo(geometry.margins.left);
      expect(style.right).toBe("auto");
    } else {
      expect(parseFloat(style.right)).toBeCloseTo(geometry.margins.right);
      expect(style.left).toBe("auto");
    }
  }
});
