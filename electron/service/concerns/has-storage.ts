import ElectronStore from "electron-store";

class Storage<T> {
  private store: ElectronStore;

  constructor(private name: string) {
    this.store = new ElectronStore();
  }

  get(): T | undefined {
    return this.store.get(this.name) as T |undefined;
  }

  set(value: T) {
    this.store.set(this.name, value);
  }

  has(): boolean {
    return this.store.has(this.name);
  }

  delete() {
    this.store.delete(this.name);
  }


}

export abstract class HasStorage<T = any> {
  protected abstract storageName: string;

  private _storage?: Storage<T>;

  protected get storage(): Storage<T> {
    if (!this._storage) {
      this._storage = new Storage<T>(this.storageName);
    }
    return this._storage;
  }
  protected getStorage():Storage<T>{
    return new Storage(this.storageName)
  }
 static instance<T extends HasStorage<any>>(this: new () => T): T {
    return new this();
  }

  


}