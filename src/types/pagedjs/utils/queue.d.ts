export default Queue;
/**
 * Queue for handling tasks one at a time
 * @class
 * @param {scope} context what this will resolve to in the tasks
 */
declare class Queue {
  constructor(context: any);
  _q: any[];
  context: any;
  tick: typeof requestAnimationFrame;
  running: boolean;
  paused: boolean;
  /**
   * Add an item to the queue
   * @return {Promise} enqueued
   */
  enqueue(...args: any[]): Promise<any>;
  /**
   * Run one item
   * @return {Promise} dequeued
   */
  dequeue(): Promise<any>;
  dump(): void;
  /**
   * Run all tasks sequentially, at convince
   * @return {Promise} all run
   */
  run(): Promise<any>;
  defered: defer;
  /**
   * Flush all, as quickly as possible
   * @return {Promise} ran
   */
  flush(): Promise<any>;
  /**
   * Clear all items in wait
   * @return {void}
   */
  clear(): void;
  /**
   * Get the number of tasks in the queue
   * @return {number} tasks
   */
  length(): number;
  /**
   * Pause a running queue
   * @return {void}
   */
  pause(): void;
  /**
   * End the queue
   * @return {void}
   */
  stop(): void;
}
/**
 * Create a new task from a callback
 * @class
 * @private
 * @param {function} task task to complete
 * @param {array} args arguments for the task
 * @param {scope} context scope of the task
 * @return {function} task
 */
export class Task {
  constructor(task: any, args: any, context: any);
}
import { defer } from "./utils.js";
