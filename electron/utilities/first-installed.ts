import { app } from "electron";
import { join } from "path";
import fs from "fs";
export const firstInstalled = () => {
  const file = join(app.getPath("userData"), "installed.json");
  if (fs.existsSync(file)) {
    return {
      time: new Date(fs.readFileSync(file).toString()).toISOString(),
      firstInstalled: false,
    };
  }
  const date = new Date();
  fs.writeFileSync(file, date.toISOString());
  return {
    time: date.toISOString(),
    firstInstalled: true,
  };
};
