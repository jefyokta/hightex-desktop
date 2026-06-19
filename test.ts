import {Select} from "./electron/database/builder/select"

const select =new Select ({getTableName:()=>"test"})

select.select('name').where("age",17)


console.log(select.toString())