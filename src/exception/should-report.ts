import { ShouldNotified } from "./interfaces/should-notified";

export class ShouldReport extends ShouldNotified{
    constructor(description:string){
        //also make action here to report error as issue, its requiring login
        super({message:"Unexpected Error",description})
    }
}