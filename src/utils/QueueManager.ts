import { Task, TaskPayload } from '../actions/performTask';

export default class QueueManager {
  taskQueue: TaskPayload[] = [];
  currentTask: TaskPayload;
  paused = false;
  pausedTimer: null | ReturnType<typeof setTimeout>;

  public removeTasksOfType = (taskType: Task) => {
    this.taskQueue = this.taskQueue.filter((task) => task.type === taskType);
  };

  public hasTask = (task: Task) => this.taskQueue.find((i) => i.type === task);

  public addTask = (task: TaskPayload, atEnd = false) => {
    if (atEnd) this.taskQueue.push(task);
    else this.taskQueue.unshift(task);
  };

  public addTasks = (tasks: TaskPayload[], atEnd = false) => {
    if (atEnd) {
      tasks.forEach((task) => this.addTask(task, atEnd));
    } else {
      tasks.reverse().forEach((task) => this.addTask(task));
    }
  };

  public finishCurrentTask = () => {
    this.currentTask = null;
  };

  public blockTasksForMs = (delay: number) => {
    if (this.pausedTimer) clearTimeout(this.pausedTimer);
    this.paused = true;
    this.pausedTimer = setTimeout(() => {
      this.pausedTimer = null;
      this.paused = false;
    }, delay);
  };

  public dropAllTasks = () => {
    this.finishCurrentTask();
    this.taskQueue = [];
  };

  public firstTaskIs = (task: Task) => {
    return this.taskQueue[0]?.type === task;
  };

  public nextTask = () => {
    if (this.paused) return null;
    return this.taskQueue.shift();
  };

  public isEmpty = () => this.taskQueue.length === 0;
}
