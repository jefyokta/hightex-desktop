export default Hook;
/**
 * Hooks allow for injecting functions that must all complete in order before finishing
 * They will execute in parallel but all must finish before continuing
 * Functions may return a promise if they are asycn.
 * From epubjs/src/utils/hooks
 * @param {any} context scope of this
 * @example this.content = new Hook(this);
 */
declare class Hook {
  constructor(context: any);
  context: any;
  hooks: any[];
  /**
   * Adds a function to be run before a hook completes
   * @example this.content.register(function(){...});
   * @return {undefined} void
   */
  register(...args: any[]): undefined;
  /**
   * Triggers a hook to run all functions
   * @example this.content.trigger(args).then(function(){...});
   * @return {Promise} results
   */
  trigger(...args: any[]): Promise<any>;
  /**
   * Triggers a hook to run all functions synchronously
   * @example this.content.trigger(args).then(function(){...});
   * @return {Array} results
   */
  triggerSync(...args: any[]): any[];
  list(): any[];
  clear(): any[];
}
