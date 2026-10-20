import { isProfileVariable } from "./document-profile";

export const isStaticVar = (varName: string) => {
  return (
    isProfileVariable(varName) ||
    /^chapter\d+$/.test(varName) ||
    ["altTitle", "title", "name", "nim", "advisorName", "advisorNip"].includes(
      varName,
    )
  );
};
