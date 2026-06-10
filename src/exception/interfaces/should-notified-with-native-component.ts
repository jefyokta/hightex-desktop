import { ApplicationError } from "./application-error";

export class ShouldNotifiedWithNativeComponent extends ApplicationError{

    constructor(message:string,private redirect='/'){

        super(message)
        this.redirect =redirect
    }
    showNotification(){
        alert(this.message)
        location.href = this.redirect
    }
}