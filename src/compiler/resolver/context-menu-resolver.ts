export class ContextMenuResolver {


    resolve(){
        document.querySelectorAll<HTMLDivElement>(".pagedjs_page").forEach((e)=>{

            e.addEventListener("contextmenu",()=>{
                console.log(e.getAttribute("data-page-number"),e.id)
            })
        })
    }
}