export const isStaticVar = (varName: string) => {
  return (
    /^chapter\d+$/.test(varName) ||
    ["altTitle", "title", "name", "nim", "advisorName", "advisorNip"].includes(
      varName,
    )
  );
};
