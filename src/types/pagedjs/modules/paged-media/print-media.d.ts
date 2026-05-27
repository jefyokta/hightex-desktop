export default PrintMedia;
declare class PrintMedia extends Handler {
  onAtMedia(node: any, item: any, list: any): void;
  getMediaName(node: any): any[];
}
import Handler from "../handler.js";
