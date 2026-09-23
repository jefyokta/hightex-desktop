import { OpenFileButton } from "@/components/ui/open-file-button";
import { ShouldNotified } from "./interfaces/should-notified";

export class ExportTimeout extends ShouldNotified {
    constructor(desc:string,logFile:string){
        super({
            message:"Export Timeout!",
            description:desc,
            action:<OpenFileButton title="open log" filePath={logFile} />
        })
    }
}