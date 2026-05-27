export const truncate = (text: string, max = 30) => {
  return text.length > max ? text.slice(0, max) + "..." : text;
};
