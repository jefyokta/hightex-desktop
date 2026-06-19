import { Select } from "@main/database/builder/select"
import { Grammar } from "@main/database/core/grammar"
import {expect, test} from "bun:test"


class Test implements Queryable{
    getTableName(): string {
        return new Grammar().pluralize(this.constructor.name)
    }
}
test("select test",()=>{
    const select = new Select(new Test)
    expect(String(select)).toBe("SELECT * FROM tests")

})

test("binding test",()=>{
    const select = new Select(new Test)
    select.where("name","okta");


    expect(String(select)).toBe("SELECT * FROM tests WHERE tests.name = ?")
    expect(select.getBindings()).not.toBeEmpty()

})