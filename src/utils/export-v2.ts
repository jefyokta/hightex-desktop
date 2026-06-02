import { HighTexDB } from "@/editor/storage/hightex-db"
import { HighTexExportError } from "@/exception/hightex-export"

export const exportDocumentV2 =async(documentId:string)=>{
    const db = HighTexDB.getInstance()
    const doc = await db.documents.get(documentId)
    if(!doc){
        throw new HighTexExportError("Document not found");
    }
    const manifest:Record<string,any> = {}
    manifest['scheme'] = 'json'
    manifest['version'] =2;
    manifest['document'] = buildDocumentSection(doc)
    

}

const buildDocumentSection = (doc:HighTexDocument)=>{
    const document:any ={}
    document.title = {
        id:doc.title,
        en:doc.altTitle
    }
    document.keywords = doc.keywords
    document.category = {
        id:doc.category,
        fallback
    }
    document.min = Boolean(doc.min) 

    return document
}
const fallback ={
                "name":"Rancang Bangun",
                "min":false,
                "chapters":[
                    {"title":"Pendahuluan"},
                    {"title":"Landasan Teori"},
                    {"title":"Metodologi penelitian"},
                    {"title":"Analisan dan Perancangan"},
                    {"title":"Implementasi dan Pengujian"},
                    {"title":"Penutup"}
                ]
            }