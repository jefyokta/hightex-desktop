import { Engine } from "../engine";
import { Resolver } from "./resolver";
import katex from "katex";

export class KatexResolver implements Resolver{
    async resolve(engine: Engine): Promise<any> {
        
        const maths =Array.from(engine.root.querySelectorAll("[data-latex]"))
        for(const math of maths){
            const latex=math.getAttribute("data-latex")
            if(!latex) continue;
            // console.log(latex)
            const parentNode = math.parentElement
            const inline = parentNode && parentNode.tagName == "P";
            katex.render(latex, math as HTMLElement, { throwOnError: false,displayMode:!inline ,trust:true});


        }
    }
}