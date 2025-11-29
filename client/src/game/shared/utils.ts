import * as Phaser from 'phaser';
import { DIRECTION, LEVEL_NAME } from './common';
import { CustomGameObject, Direction, GameObject, LevelName, Position } from './types';

export function exhaustiveGuard(_value: never): never {
  throw new Error(`Error! Reached forbidden guard function with unexpected value: ${JSON.stringify(_value)}`);
}

export function isArcadePhysicsBody(
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | MatterJS.BodyType | null,
): body is Phaser.Physics.Arcade.Body {
  if (body === undefined || body === null) {
    return false;
  }
  return body instanceof Phaser.Physics.Arcade.Body;
}

export function isDirection(direction: string): direction is Direction {
  return (direction as keyof typeof DIRECTION) in DIRECTION;
}

export function isCustomGameObject(gameObject: GameObject): gameObject is GameObject & CustomGameObject {
  const obj = gameObject as Partial<CustomGameObject>;
  return typeof obj.disableObject === 'function' && typeof obj.enableObject === 'function';
}


export function getDirectionOfObjectFromAnotherObject(object: Position, targetObject: Position): Direction {
  if (object.y < targetObject.y) {
    return DIRECTION.DOWN;
  }
  if (object.y > targetObject.y) {
    return DIRECTION.UP;
  }
  if (object.x < targetObject.x) {
    return DIRECTION.RIGHT;
  }
  return DIRECTION.LEFT;
}

export function isLevelName(levelName: string): levelName is LevelName {
  return (levelName as keyof typeof LEVEL_NAME) in LEVEL_NAME;
}