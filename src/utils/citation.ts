export const formatManual = (text: string, year: string, citeA?: boolean) => {
  return citeA ? `${text} (${year})` : `(${text}, ${year})`;
};
