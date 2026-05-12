export const isBase64 = (str: string): boolean => {
  return /^data:image\/[a-zA-Z]+;base64,/.test(str);
};
export const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const base64ToPngBlob = async (base64: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No context");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject("Failed to convert to PNG");
      }, "image/png");
    };
    img.onerror = reject;
    img.src = base64;
  });
};
