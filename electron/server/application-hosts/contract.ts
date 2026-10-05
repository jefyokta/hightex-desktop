type ResponseType = Response | void | undefined;
export abstract class Router {
  abstract handle(url: URL): Promisable<ResponseType>;
}
