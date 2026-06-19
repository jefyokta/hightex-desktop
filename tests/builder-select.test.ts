import { Select } from "@main/database/builder/select"
import { Grammar } from "@main/database/core/grammar"
import {expect, test} from "bun:test"


const testClass =new class Test implements Queryable{
    getTableName(): string {
        return new Grammar().pluralize(this.constructor.name)
    }
}
test("select test",()=>{
    const select = new Select(testClass)
    expect(String(select)).toBe("SELECT * FROM tests")

})

test("binding test",()=>{
    const select = new Select(testClass)
    select.where("name","okta");
    expect(String(select)).toBe("SELECT * FROM tests WHERE tests.name = ?")
    expect(select.getBindings()).not.toBeEmpty()

})