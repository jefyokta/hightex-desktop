import { Controller } from "@main/server/application-hosts/controller";
import { HightexProtocol } from "@main/server/hightex-protocol";

export class DeepLinkService {
  private url: URL;
  constructor(url: string | URL) {
    this.url = new URL(url);
  }
  /**
   * 
   * @platfrom "windows"|"linux"
   */
  static isDeepLink(args:string[]){
   const url = args.find(a=>a.startsWith(HightexProtocol.SCHEME+"://"))
   if(!url){
    return undefined;
   }
   return new DeepLinkService(url)
  }
  
  handle(){
    return Controller.handle(this.url)
  }
}
