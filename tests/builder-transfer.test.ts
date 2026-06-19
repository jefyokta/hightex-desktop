import { Select } from "@main/database/builder/select"
import { Unkown } from "@main/database/builder/unknown"
import {expect,test} from "bun:test"


const model ={
    getTableName() {
        return "test"
    }
}
test("transefer wheres and bindings",()=>{
    const unknownBuilder = new Unkown(model)
    unknownBuilder.where("id",1)
    unknownBuilder.where("name","okta");

    const selectBuilder = new Select(model)

    selectBuilder.import(unknownBuilder)

    expect(String(selectBuilder)).toBe("SELECT * FROM test WHERE test.id = ? AND test.name = ?")
    expect(JSON.stringify(selectBuilder.getBindings())).toBe(JSON.stringify([1,"okta"]))

})



test("merged wheres and bindings",()=>{
     const unknownBuilder = new Unkown(model)
    unknownBuilder.where("id",1)
    unknownBuilder.where("name","okta");

    const selectBuilder = new Select(model)

    selectBuilder.import(unknownBuilder)

    selectBuilder.where("email","okta@icloud.com")

    expect(String(selectBuilder)).toBe("SELECT * FROM test WHERE test.id = ? AND test.name = ? AND test.email = ?")
    expect(JSON.stringify(selectBuilder.getBindings())).toBe(JSON.stringify([1,"okta",'okta@icloud.com']))

})