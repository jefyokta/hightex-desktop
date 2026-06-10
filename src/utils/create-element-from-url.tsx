export const createElementFromUrl = async (
  url: string
): Promise<HTMLStyleElement | HTMLScriptElement | undefined> => {
  const response = await fetch(url);

  if (!response.ok) return undefined;

  const contentType = response.headers.get("content-type") || "";
  // console.log(contentType)
  const isCss =
    contentType.includes("text/css") || url.endsWith(".css");

  const isJs =
    contentType.includes("javascript") || url.endsWith(".js");
  const text = await response.text();
  if (isJs) {
    const script = document.createElement("script");
    script.text = text;
    script.type = 'module'
    return script;
  }
  if (isCss) {
    const style = document.createElement("style");
    style.textContent = text;
    return style;
  }



  return undefined;
};