import Phaser from 'phaser';

/** Lets Phaser scenes notify React without either side importing the other. */
export const EventBus = new Phaser.Events.EventEmitter();

/** Payload: RunResult */
export const RUN_FINISHED = 'run-finished';

/** No payload. Play again: restarts the scene without rebuilding the game. */
export const RESTART_RUN = 'restart-run';
