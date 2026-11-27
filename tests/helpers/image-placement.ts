import { PaginationImageError } from "@/exception/pagination-image-error";
import type { PaginationImageRect } from "@/types/pagination/image-issue";
import type { PaginationGeometry } from "../../src/editor/pagination/options";

const rectData = ({
  left,
  top,
  right,
  bottom,
  width,
  height,
}: PaginationImageRect): PaginationImageRect => ({
  left,
  top,
  right,
  bottom,
  width,
  height,
});

/** Fixture audit only. Production fitting/planning owns placement without a post-layout export gate. */
export function assertPageImagePlacement(
  bounds: PaginationImageRect,
  paper: PaginationImageRect,
  geometry: PaginationGeometry,
  image: number,
) {
  const page = Math.floor((bounds.top - paper.top) / geometry.stride);
  const top = paper.top + page * geometry.stride + geometry.margins.top;
  const left = paper.left + geometry.margins.left;
  const right = paper.right - geometry.margins.right;
  const bottom = top + geometry.contentHeight;
  if (
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.left >= left - 1 &&
    bounds.right <= right + 1 &&
    bounds.top >= top - 1 &&
    bounds.bottom <= bottom + 1
  )
    return;
  throw new PaginationImageError({
    code: "pagination.image.outside-page",
    image,
    page: page + 1,
    reason:
      !bounds.width || !bounds.height
        ? "unmeasurable"
        : bounds.width > geometry.contentWidth + 1 ||
            bounds.height > geometry.contentHeight + 1
          ? "size"
          : "position",
    bounds: rectData(bounds),
    content: {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    },
    overflow: {
      left: Math.max(0, left - bounds.left),
      right: Math.max(0, bounds.right - right),
      top: Math.max(0, top - bounds.top),
      bottom: Math.max(0, bounds.bottom - bottom),
    },
  });
}
