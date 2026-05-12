export const parseItalic = (text: string) => {
  return text
    .split(/(\_[^_]+\_)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("_") && part.endsWith("_")
        ? { type: "italic", text: part.slice(1, -1) }
        : { type: "text", text: part },
    );
};

export const ParsedItalic: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span>
      {parseItalic(text).map((t, i) =>
        t.type === "italic" ? (
          <em key={i}>{t.text}</em>
        ) : (
          <span key={i}>{t.text}</span>
        ),
      )}
    </span>
  );
};
