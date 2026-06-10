interface IClassName {
  name: string;
}
const ClassName = function (this: IClassName) {
  this.name = "jefy";
};
//@ts-ignore
const c = new ClassName();
console.log(c.name);
