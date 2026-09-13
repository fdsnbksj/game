import Phaser from 'phaser';

/** Lets Phaser scenes notify React without either side importing the other. */
export const EventBus = new Phaser.Events.EventEmitter();

/** Payload: RunResult */
export const RUN_FINISHED = 'run-finished';
