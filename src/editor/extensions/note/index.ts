import { Mark } from "@tiptap/core";
import { UUIDAttributes } from "../uuid";
import { ReactMarkViewRenderer } from "@tiptap/react";
import { NoteComponent } from "./component";

export const Note = Mark.create({
    name:"note",
    addAttributes(){
        return {
            ...this.parent?.(),
            note:{
                default:"",
                parseHTML(element) {
                    return element.getAttribute("data-note")
                },
                renderHTML(attributes) {
                    return {
                        "data-note":attributes.note
                    }
                },
            },
            created:{
                default:new Date().toISOString(),
                parseHTML(element) {
                    return new Date(element.getAttribute("data-created") || new Date).toISOString()
                },
                    renderHTML(attributes) {
                    return {
                        "data-created":attributes.created
                    }
                },

            },
            ...UUIDAttributes()
            
        }
    },
    addMarkView() {
        return ReactMarkViewRenderer(NoteComponent)
    },
})