const assert = require("node:assert/strict");

const channels = (color) => color;
const luminance = (color) => {
  const [r, g, b] = channels(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
};
const contrast = (a, b) => {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

/** Check rendered readability against the user-selected theme, not CSS class names. */
async function assertGuideVisuals(execute, announcement = false) {
  // Theme changes animate dialog/button colors for 100–150 ms.
  await execute("new Promise(resolve => setTimeout(resolve, 180))");
  const colors = await execute(`(()=>{
    const surface=document.querySelector(${JSON.stringify(announcement ? "[data-guide-announcement]" : "[data-tour-panel]")});
    const backdrop=document.querySelector(${JSON.stringify(announcement ? ".guide-announcement-scrim" : "[data-tour-scrim]")});
    const description=document.getElementById(surface.getAttribute('aria-describedby'));
    const action=surface.querySelector('button[data-variant="default"]');
    const toast=document.querySelector('[data-sonner-toast]');
    const rect=toast?.getBoundingClientRect();
    const toastInView=rect && rect.width>0 && rect.height>0 && rect.top>=0 && rect.bottom<=innerHeight;
    const toastCovered=!toastInView || !!document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)?.closest('[data-tour-scrim],[data-tour-panel],[data-guide-announcement],.guide-announcement-scrim');
    // Canvas converts theme colors (including OKLCH) to sRGB for contrast checks.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    const rgba=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);const [r,g,b,a]=context.getImageData(0,0,1,1).data;return [r,g,b,a/255]};
    return {toastCovered,dark:document.documentElement.classList.contains('dark'),
      background:rgba(getComputedStyle(surface).backgroundColor),text:rgba(getComputedStyle(description).color),
      backdrop:rgba(getComputedStyle(backdrop).backgroundColor),blur:getComputedStyle(backdrop).backdropFilter,
      actionBackground:rgba(getComputedStyle(action).backgroundColor),actionText:rgba(getComputedStyle(action).color)};
  })()`);
  assert.ok(
    colors.dark
      ? luminance(colors.background) < 0.1
      : luminance(colors.background) > 0.85,
    `tour surface must follow the selected application theme: ${JSON.stringify(colors)}`,
  );
  assert.ok(
    contrast(colors.background, colors.text) >= 4.5,
    "tour explanation must have readable text contrast",
  );
  assert.ok(
    contrast(colors.actionBackground, colors.actionText) >= 4.5,
    "tour action label must remain readable",
  );
  const [, , , alpha] = channels(colors.backdrop);
  assert.ok(
    alpha >= (colors.dark ? 0.5 : 0.25),
    "the temporary backdrop must reduce the prominence of surrounding UI",
  );
  assert.ok(
    colors.toastCovered,
    "incidental notifications must stay behind the tour",
  );
  assert.notEqual(
    colors.blur,
    "none",
    "the surrounding workspace should lose visual prominence",
  );
}
module.exports = { assertGuideVisuals };
