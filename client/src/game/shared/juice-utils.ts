import { GameObjects } from 'phaser';

export function flash(target: GameObjects.Image | GameObjects.Sprite, callback?: () => void): void {
  const timeEvent = target.scene.time.addEvent({
    delay: 250,
    callback: () => {
      target.setTintFill(0xffffff);
      target.setAlpha(0.7);

      target.scene.time.addEvent({
        delay: 150,
        callback: () => {
          target.setTint(0xffffff);
          target.setAlpha(1);
          if (timeEvent.getOverallProgress() === 1 && callback) {
            callback();
          }
        },
      });
    },
    startAt: 150,
    repeat: 3,
  });
}
