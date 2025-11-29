import { DIRECTION } from '../../shared/common';
import { THROW_ITEM_DELAY_BEFORE_CALLBACK, THROW_ITEM_SPEED } from '../../shared/config';
import { Direction, GameObject } from '../../shared/types';
import { exhaustiveGuard, isArcadePhysicsBody, isCustomGameObject } from '../../shared/utils';
import { BaseGameObjectComponent } from './base-game-object-component';

export class ThrowableObjectComponent extends BaseGameObjectComponent {
  #callback: () => void;

  constructor(gameObject: GameObject, callback = () => undefined) {
    super(gameObject);
    this.#callback = callback;
  }

  public drop(): void {
    this.#callback();
  }

  public throw(direction: Direction): void {
    if (!isArcadePhysicsBody(this.gameObject.body) || !isCustomGameObject(this.gameObject)) {
      this.#callback();
      return;
    }

    const body = this.gameObject.body;
    body.velocity.x = 0;
    body.velocity.y = 0;

    const throwSpeed = THROW_ITEM_SPEED;
    switch (direction) {
      case DIRECTION.DOWN:
        this.gameObject.y += 20;
        body.velocity.y = throwSpeed;
        break;
      case DIRECTION.UP:
        body.velocity.y = throwSpeed * -1;
        break;
      case DIRECTION.LEFT:
        body.velocity.x = throwSpeed * -1;
        break;
      case DIRECTION.RIGHT:
        body.velocity.x = throwSpeed;
        break;
      default:
        exhaustiveGuard(direction);
    }

    this.gameObject.enableObject();
    this.gameObject.scene.time.delayedCall(THROW_ITEM_DELAY_BEFORE_CALLBACK, () => {
      body.velocity.x = 0;
      body.velocity.y = 0;
      this.#callback();
    });
  }
}
