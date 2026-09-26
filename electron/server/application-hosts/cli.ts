import { Router } from "./contract";

export class CliRouter extends Router{
    handle(url: URL): Response {
        return new Response(url.toString())
    }

    
}