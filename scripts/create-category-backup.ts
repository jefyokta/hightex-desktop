import { mkdir } from "node:fs/promises";
import path from "node:path";

const SERVER_INFO_URL =
  "https://raw.githubusercontent.com/jefyokta/hightex-project/main/info.json";

 ( async ()=>{

    const response = await fetch(SERVER_INFO_URL, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const info = (await response.json()) as any;

    const host:string|undefined =info.serverHost;

    if (!host) {
      throw new Error("serverHost is missing from info.json");
    }

    
    const json =await fetch(host+(host.endsWith("/") ? "" :"/")+"/categories",{
        headers:{
            "content-type":"application/json"
        }
    }).then(r=>r.json());

  const folder = path.resolve(process.cwd(), "resources");
  const output = path.join(folder, "category-backup.json");

  await mkdir(folder, { recursive: true });

  await Bun.write(
    output,
    JSON.stringify(json, null, 2),
  );

    //save categories backup
  })()