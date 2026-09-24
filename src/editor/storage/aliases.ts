import { Document } from "../document";
import { HighTexDB } from "./hightex-db";

export class AliasStorage {
    private map:Map<string,string>;
    private static _instance?:AliasStorage;
    private constructor(){
        this.map = new Map()
    }
    public get size(){
        return this.map.size
    }
    public static get instance(){
        if(!this._instance) {
            this._instance = new AliasStorage;
        }
        return this._instance;

    }


    set(key:string,value:string){
        this.map.set(key,value)
        
    }

    async prefetch(){
        const documentId = Document.instance?.id
        if(!documentId) return;

        const aliases =(await HighTexDB.getInstance().getAliases(documentId))
        for(const {key,value}of aliases){
            this.map.set(key,value)
        }
    }
    isEmpty(){
        return this.size === 0;
    }

    keys(){
        return this.map.keys()
    }

    get(key:string){
        return this.map.get(key)
    }
    entries(){
        return this.map.entries()
    }
    del(key:string){
        if(this.map.has(key)){
            this.map.delete(key)
        }
    }
}