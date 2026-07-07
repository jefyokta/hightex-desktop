import { ApplicationError } from "./application-error";

export class ThrowByMain extends ApplicationError {
    onMainThrowing(msg:string){
        return this.setMessage(msg)
    }
    setMessage(message:string):this{
        this.message = message;
        return this
    }

}