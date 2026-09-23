export class ExportTimeout extends Error {
    public logFile:string ;
    public timeout:number;
    public docId:string;
    constructor({logFile,timeout,docId}:{logFile:string,timeout:number,docId:string},...args:any[]){
        super(`Export timeout exceed ${timeout}ms for ${docId} `,...args)
        this.logFile = logFile
        this.timeout = timeout
        this.docId = docId
    }

}