const getNumber = (text: string) => {
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : 3;
};

export const matchFigureTable = (text: string) => {
  const rowMatch = text.match(/^tab\.(\d+)\.(\d+)\.?$/i);
  const colsMatch = text.match(/^tab\.(\d+)\.?$/i);
  const captionMatch = text.match(/^tab\.(\d+)\.(\d+)\.([\p{L}\p{N}_]+)$/iu);

  if (captionMatch) {
    return {
      cols: getNumber(captionMatch[1]),
      rows: getNumber(captionMatch[2]),
      caption: captionMatch[3].replace(/_/g, " "),
    };
  }

  if (rowMatch) {
    return {
      cols: getNumber(rowMatch[1]),
      rows: getNumber(rowMatch[2]),
      caption: "",
    };
  }
  if (colsMatch) {
    return { cols: getNumber(colsMatch[1]), rows: 3, caption: "" };
  }
  if (!text || "tab.".startsWith(text.toLowerCase())) {
    return { cols: 3, rows: 3, caption: "" };
  }

  return false;
};

export const matchFigureImage = (text: string) => {
  if (!text || "fig.".startsWith(text.toLowerCase())) return true;

  const captionMatch = text.match(/^fig\.([\p{L}\p{N}_]+)$/iu);
  return captionMatch ? { caption: captionMatch[1].replace(/_/g, " ") } : false;
};
