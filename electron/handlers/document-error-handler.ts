import { IPCMain } from "@main/utilities/ipc-main";
import { app } from "electron";
import { mkdir, writeFile } from "fs/promises";
import path from "path";


export class DocumentErrorHandler {
    static dir:string =path.join(app.getPath("home"),".hightex","errors");

    static register(){
        
        IPCMain.handle("content:error",async (_,{content,fileName,error}:Parameters<Window['hightex']['saveContentError']>[0])=>{
            await mkdir(this.dir,{recursive:true})
            await writeFile(path.join(this.dir,fileName),JSON.stringify({content,error:String(error)}))
        })
    }
}